(() => {
  "use strict";

  const STORAGE_KEY = "ontology3-canvas-first-review-v17";
  const C008_PROJECTION_KEY = "ontology3-c008-authoritative-projection-v1";
  const SEED_VERSION = "S002-M01-BUDGET-PUBLISHED-v8";
  const IMPLEMENTATION_BASE_DATE = "2026-08-15";
  const ACTUAL_FORMED_AT = "2026-08-15T08:00:00.000Z";
  const PUBLISHED_AT = "2026-08-15 16:00:00";
  const EFFECTIVE_FROM = "2026-08-15T00:00:00+08:00";
  const DATA_BUNDLE_VERSION = "S002-DATA-v1";
  const COMPONENT_ASSET_VERSIONS = ["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"];
  const COMPONENT_ASSET_CONTRACTS = [
    {
      assetId: "S002-BUDGET-EXECUTION-ASSET",
      assetVersion: "S002-BUDGET-EXEC-v1",
      pipelineId: "S002-PIPE-BUDGET-v1",
      runId: "RUN-S002-PIPE-BUDGET-v1",
      sourceIds: ["DS-ACTUAL-EXECUTION", "DS-APPROVED-BUDGET", "DS-INITIAL-SUBMISSION"],
      sourceSnapshotIds: ["SRC-2024-ACTUAL", "SRC-2025-ACTUAL", "SRC-2024-BUDGET", "SRC-2025-BUDGET", "SRC-2025-SUBMISSION", "SRC-2026-SUBMISSION"],
    },
    {
      assetId: "S002-PROJECT-OCCUPANCY-ASSET",
      assetVersion: "S002-PROJECT-OCC-v1",
      pipelineId: "S002-PIPE-PROJECT-v1",
      runId: "RUN-S002-PIPE-PROJECT-v1",
      sourceIds: ["DS-ACTUAL-EXECUTION", "DS-INITIAL-SUBMISSION", "DS-PROJECT-COMMITMENT", "DS-PROJECT-USE"],
      sourceSnapshotIds: ["SRC-2024-ACTUAL", "SRC-2025-ACTUAL", "SRC-2025-SUBMISSION", "SRC-2026-SUBMISSION", "SRC-2025-COMMITMENT", "SRC-PROJECT-USE"],
    },
  ];

  function runtimeContext() {
    const params = new URLSearchParams(location.search);
    return {
      scenarioId: params.get("scenarioId") || "S002",
      scenarioVersion: params.get("scenarioVersion") || "S002-v1",
      scenarioRunId: params.get("scenarioRunId") || "S002-RUN-20260815235500000-a07fd209d423",
      scenarioName: "预算监督管理",
      formedAt: params.get("formedAt") || ACTUAL_FORMED_AT,
      status: params.get("status") || "active",
    };
  }

  function runtimeReadiness() {
    const params = new URLSearchParams(location.search);
    return {
      assetPublished: params.get("m02AssetPublished") === "1",
      mappingApplied: params.get("m01MappingApplied") === "1",
      ontologyPublished: params.get("m01OntologyPublished") === "1",
      ready: params.get("m01Ready") === "1",
    };
  }

  function sameScenarioContext(left, right) {
    return Boolean(left && right
      && left.scenarioId === right.scenarioId
      && left.scenarioVersion === right.scenarioVersion
      && left.scenarioRunId === right.scenarioRunId
      && left.formedAt === right.formedAt
      && left.status === right.status);
  }

  function sameEvidenceContext(evidenceContext, viewContext) {
    if (sameScenarioContext(evidenceContext, viewContext)) return true;
    return Boolean(evidenceContext && viewContext
      && viewContext.status === "historical-readonly"
      && ["active", "restored", "regression"].includes(evidenceContext.status)
      && evidenceContext.scenarioId === viewContext.scenarioId
      && evidenceContext.scenarioVersion === viewContext.scenarioVersion
      && evidenceContext.scenarioRunId === viewContext.scenarioRunId
      && evidenceContext.formedAt === viewContext.formedAt);
  }

  function exactArray(actual, expected) {
    return Array.isArray(actual)
      && actual.length === expected.length
      && actual.every((value, index) => value === expected[index]);
  }

  function assetVersionOf(asset) {
    return asset?.assetVersion || asset?.version || null;
  }

  function exactComponentVersions(assets) {
    return Array.isArray(assets)
      && exactArray(assets.map(assetVersionOf), COMPONENT_ASSET_VERSIONS);
  }

  function componentAssetMatches(asset, contract, options = {}) {
    if (!asset || asset.assetId !== contract.assetId || assetVersionOf(asset) !== contract.assetVersion) return false;
    if (options.requireSources && !exactArray(asset.sourceIds, contract.sourceIds)) return false;
    if (options.requireSnapshots && !exactArray(asset.sourceSnapshotIds, contract.sourceSnapshotIds)) return false;
    if (options.requirePipeline && asset.pipelineId !== contract.pipelineId) return false;
    if (options.requireRun && asset.runId !== contract.runId) return false;
    return true;
  }

  function exactComponentAssets(assets, options = {}) {
    return Array.isArray(assets)
      && assets.length === COMPONENT_ASSET_CONTRACTS.length
      && COMPONENT_ASSET_CONTRACTS.every((contract, index) => componentAssetMatches(assets[index], contract, options));
  }

  function exactPipelineDefinitions(definitions) {
    return Array.isArray(definitions)
      && definitions.length === COMPONENT_ASSET_CONTRACTS.length
      && COMPONENT_ASSET_CONTRACTS.every((contract, index) => {
        const definition = definitions[index];
        return definition?.pipelineId === contract.pipelineId
          && definition?.targetAssetVersion === contract.assetVersion
          && exactArray(definition?.sourceIds, contract.sourceIds);
      });
  }

  function exactPipelineRuns(runs) {
    return Array.isArray(runs)
      && runs.length === COMPONENT_ASSET_CONTRACTS.length
      && COMPONENT_ASSET_CONTRACTS.every((contract, index) => {
        const run = runs[index];
        return run?.runId === contract.runId
          && (run?.pipelineId || run?.definitionVersion) === contract.pipelineId
          && run?.targetAssetVersion === contract.assetVersion
          && (!run?.status || run.status === "completed");
      });
  }

  function exactBundle(bundle) {
    return Boolean(bundle
      && bundle.assetId === "S002-DATA-BUNDLE"
      && bundle.version === DATA_BUNDLE_VERSION
      && bundle.role === "compatibility-delivery-pointer"
      && exactComponentVersions(bundle.componentAssets));
  }

  function exactC003Receipt(receipt, context) {
    return Boolean(receipt
      && receipt.contractCode === "C003"
      && receipt.receiptId === "RECEIPT-C003-S002-DATA-v1"
      && receipt.deliveryId === "C003-S002-DATA-v1"
      && receipt.status === "accepted"
      && receipt.t006Id === "S002-DATA-BUNDLE"
      && receipt.t007Version === DATA_BUNDLE_VERSION
      && receipt.targetDraftId === "DRAFT-S002-BUDGET-v1"
      && receipt.targetDraftRevision === 1
      && exactComponentVersions(receipt.componentAssets)
      && sameEvidenceContext(receipt.scenarioContext, context));
  }

  function exactDraftBinding(binding) {
    return Boolean(binding
      && binding.deliveryId === "C003-S002-DATA-v1"
      && binding.sourceDeliveryId === "C003-S002-DATA-v1"
      && binding.assetVersion === DATA_BUNDLE_VERSION
      && binding.sourceAssetVersion === DATA_BUNDLE_VERSION
      && binding.targetDraftId === "DRAFT-S002-BUDGET-v1"
      && binding.targetDraftRevision === 1
      && exactArray(binding.componentAssetVersions, COMPONENT_ASSET_VERSIONS));
  }

  function exactMappingVersion(mapping) {
    return Boolean(mapping
      && mapping.mappingId === "S002-MAPPING-v1"
      && mapping.dataAssetVersion === DATA_BUNDLE_VERSION
      && exactArray(mapping.componentAssetVersions, COMPONENT_ASSET_VERSIONS)
      && exactComponentVersions(mapping.assetBindings)
      && Array.isArray(mapping.crossAssetRelations)
      && mapping.crossAssetRelations.length === 2);
  }

  function exactPublishedOntology(published, context) {
    const consumption = published?.consumptionContext;
    return Boolean(published
      && published.status === "published-for-scenario"
      && published.ontologyVersion === "S002-ONTO-v1"
      && published.publishedPointer === "T019-S002-v1"
      && published.dataAssetVersion === DATA_BUNDLE_VERSION
      && exactArray(published.componentAssetVersions, COMPONENT_ASSET_VERSIONS)
      && published.metricVersion === "S002-METRIC-v1"
      && published.ruleVersion === "S002-RULE-v1"
      && published.actionTypeVersion === "S002-ACTION-TYPE-v1"
      && consumption?.dataBundleVersion === DATA_BUNDLE_VERSION
      && exactArray(consumption?.componentAssetVersions, COMPONENT_ASSET_VERSIONS)
      && consumption?.ontologyVersion === "S002-ONTO-v1"
      && consumption?.publishedPointer === "T019-S002-v1"
      && consumption?.c003DeliveryId === "C003-S002-DATA-v1"
      && consumption?.c003ReceiptId === "RECEIPT-C003-S002-DATA-v1"
      && consumption?.targetDraftId === "DRAFT-S002-BUDGET-v1"
      && consumption?.targetDraftRevision === 1
      && consumption?.status === "ready-for-current-scenario-run"
      && consumption?.readOnly === true
      && sameEvidenceContext(consumption?.scenarioContext, context));
  }

  function ownerReadiness(ownerStates, context) {
    const m02Envelope = ownerStates?.m02;
    const m01Envelope = ownerStates?.m01;
    const m02 = m02Envelope?.payload;
    const m01 = m01Envelope?.payload;
    const contextMatches = sameScenarioContext(m02Envelope?.scenarioContext, context)
      && sameScenarioContext(m01Envelope?.scenarioContext, context);
    const assetPublished = Boolean(contextMatches
      && m02?.progress?.assetPublished
      && exactBundle(m02?.dataAsset)
      && exactComponentAssets(m02?.dataAssets, { requireSources: true })
      && exactPipelineDefinitions(m02?.pipelineDefinitions)
      && exactPipelineRuns(m02?.pipelineRuns)
      && m02?.sourceSnapshot?.snapshotId === "S002-SOURCE-SNAPSHOT-v1"
      && m02?.sourceSnapshot?.logicalSources === 5
      && m02?.sourceSnapshot?.snapshotCount === 8
      && m02?.qualityReceipt?.receiptId === "S002-QUALITY-RECEIPT-v1"
      && m02?.qualityReceipt?.status === "passed-for-demo");
    const mappingApplied = Boolean(contextMatches
      && assetPublished
      && m01?.progress?.mappingApplied
      && exactC003Receipt(m01?.c003Receipt, context)
      && exactDraftBinding(m01?.targetDraftBinding)
      && exactMappingVersion(m01?.mappingVersion));
    const ontologyPublished = Boolean(contextMatches
      && mappingApplied
      && m01?.progress?.ontologyPublished
      && exactPublishedOntology(m01?.publishedOntology, context));
    return { assetPublished, mappingApplied, ontologyPublished, ready: assetPublished && mappingApplied && ontologyPublished };
  }

  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }

  function fingerprint(value) {
    return JSON.stringify(canonical(value));
  }

  function c003PayloadFingerprint(value) {
    const snapshot = { ...value };
    delete snapshot.payloadFingerprint;
    const content = fingerprint(snapshot);
    let hash = 2166136261;
    for (let index = 0; index < content.length; index += 1) {
      hash ^= content.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `C003-PF-${(hash >>> 0).toString(16).padStart(8, "0").toUpperCase()}-${content.length}`;
  }

  function exactCrossAssetRelations(relations) {
    const expected = [
      ["REL-LINK-S002-VOUCHER-PROJECT", "S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1", "项目标识"],
      ["REL-LINK-S002-PROJECT-VERSION", "S002-PROJECT-OCC-v1", "S002-BUDGET-EXEC-v1", "预算版本标识"],
    ];
    return Array.isArray(relations)
      && relations.length === expected.length
      && expected.every(([relationId, sourceAssetVersion, targetAssetVersion, stableKey], index) => {
        const relation = relations[index];
        return relation?.relationId === relationId
          && relation?.sourceAssetVersion === sourceAssetVersion
          && relation?.targetAssetVersion === targetAssetVersion
          && relation?.stableKey === stableKey;
      });
  }

  function exactComponentSourceChains(chains) {
    return Boolean(chains
      && exactArray(chains["S002-BUDGET-EXEC-v1"], [
        "SRC-2024-ACTUAL + SRC-2025-ACTUAL + SRC-2024-BUDGET + SRC-2025-BUDGET + SRC-2025-SUBMISSION + SRC-2026-SUBMISSION",
        "S002-PIPE-BUDGET-v1",
        "RUN-S002-PIPE-BUDGET-v1",
        "S002-QUALITY-RECEIPT-v1",
        "S002-BUDGET-EXEC-v1",
      ])
      && exactArray(chains["S002-PROJECT-OCC-v1"], [
        "SRC-2024-ACTUAL + SRC-2025-ACTUAL + SRC-2025-SUBMISSION + SRC-2026-SUBMISSION + SRC-2025-COMMITMENT + SRC-PROJECT-USE",
        "S002-PIPE-PROJECT-v1",
        "RUN-S002-PIPE-PROJECT-v1",
        "S002-QUALITY-RECEIPT-v1",
        "S002-PROJECT-OCC-v1",
      ]));
  }

  function exactSourceDelivery(delivery, context) {
    return Boolean(delivery
      && delivery.contractSchemaVersion === 2
      && delivery.contractCode === "C003"
      && delivery.deliveryId === "C003-S002-DATA-v1"
      && delivery.deliveryStatus === "已交付"
      && delivery.assetId === "S002-DATA-BUNDLE"
      && delivery.assetRole === "compatibility-delivery-pointer"
      && delivery.assetVersion === DATA_BUNDLE_VERSION
      && delivery.sourceSnapshotId === "S002-SOURCE-SNAPSHOT-v1"
      && delivery.publicationState === "已发布"
      && exactComponentAssets(delivery.componentAssets, { requireSources: true, requireSnapshots: true, requirePipeline: true, requireRun: true })
      && exactPipelineRuns(delivery.runEvidence?.runs)
      && exactCrossAssetRelations(delivery.crossAssetRelations)
      && exactComponentSourceChains(delivery.componentSourceChains)
      && exactArray(delivery.sourceChain, [
        "S002-SOURCE-SNAPSHOT-v1",
        "S002-PIPE-BUDGET-v1 + S002-PIPE-PROJECT-v1",
        "RUN-S002-PIPE-BUDGET-v1 + RUN-S002-PIPE-PROJECT-v1",
        "S002-QUALITY-RECEIPT-v1",
        DATA_BUNDLE_VERSION,
      ])
      && delivery.qualitySummary?.status === "通过"
      && delivery.qualitySummary?.resultId === "S002-QUALITY-RECEIPT-v1"
      && delivery.mappingEligibility?.status === "可供本体映射"
      && delivery.t008Confirmation?.snapshotId === "S002-SOURCE-SNAPSHOT-v1"
      && sameScenarioContext(delivery.t008Confirmation?.scenarioContext, context)
      && sameScenarioContext(delivery.scenarioContext, context)
      && delivery.payloadFingerprintValid === true
      && delivery.payloadFingerprint === c003PayloadFingerprint(delivery));
  }

  function exactDataContract(contract, delivery) {
    return Boolean(contract
      && contract.contractCode === "C003"
      && contract.mappingVersionId === "S002-MAPPING-v1"
      && contract.assetId === "S002-DATA-BUNDLE"
      && contract.assetRole === "compatibility-delivery-pointer"
      && contract.assetVersion === DATA_BUNDLE_VERSION
      && contract.sourceSnapshotId === "S002-SOURCE-SNAPSHOT-v1"
      && contract.publicationState === "已发布"
      && contract.sourceContractFingerprint === fingerprint(delivery)
      && exactComponentAssets(contract.componentAssets, { requireSources: true, requireSnapshots: true, requirePipeline: true, requireRun: true })
      && exactCrossAssetRelations(contract.crossAssetRelations)
      && exactComponentSourceChains(contract.componentSourceChains)
      && exactArray(contract.sourceChain, delivery.sourceChain)
      && contract.qualitySummary?.resultId === "S002-QUALITY-RECEIPT-v1"
      && contract.mappingEligibility?.status === "可供本体映射");
  }

  function exactVersionConsumptionContext(consumption, context) {
    return Boolean(consumption
      && sameScenarioContext(consumption.scenarioContext, context)
      && consumption.baselineVersion === "v1.0.3"
      && consumption.dataBundle?.assetId === "S002-DATA-BUNDLE"
      && consumption.dataBundle?.assetRole === "compatibility-delivery-pointer"
      && consumption.dataBundle?.version === DATA_BUNDLE_VERSION
      && exactComponentAssets(consumption.componentAssets, { requirePipeline: true })
      && consumption.ontologyVersion === "S002-ONTO-v1"
      && consumption.semanticVersionId === "SEM-S002-BUDGET-v1"
      && consumption.publishedPointer === "T019-S002-v1"
      && consumption.metricVersion === "S002-METRIC-v1"
      && consumption.ruleVersion === "S002-RULE-v1"
      && consumption.actionTypeVersion === "S002-ACTION-TYPE-v1"
      && consumption.contracts?.sourceDelivery === "C003-S002-DATA-v1"
      && consumption.contracts?.sourceReceipt === "RECEIPT-C003-S002-DATA-v1"
      && consumption.contracts?.mappingCheck === "REC-S002-M01-C029-001"
      && consumption.contracts?.eligibility === "REC-S002-M01-T018-001"
      && consumption.contracts?.queryValidation === "EV-S002-M03-FIXED-QUESTIONS-v1"
      && consumption.contracts?.adoption === "T019-S002-v1"
      && consumption.status === "ready-for-current-scenario-run"
      && consumption.readOnly === true);
  }

  function exactBinding(binding, context) {
    const consumption = binding?.consumptionContext;
    return Boolean(binding
      && binding.semanticVersion === "S002-ONTO-v1"
      && binding.dataVersion === DATA_BUNDLE_VERSION
      && exactArray(binding.dataVersions, COMPONENT_ASSET_VERSIONS)
      && binding.adoptionRecordId === "T019-S002-v1"
      && binding.adoptionEvidenceLocator === "EV-T019-S002-v1"
      && binding.validationEvidenceRef === "EV-S002-M03-FIXED-QUESTIONS-v1"
      && sameScenarioContext(binding.scenarioContext, context)
      && sameScenarioContext(binding.candidateValidationReference?.scenarioContext, context)
      && binding.candidateValidationReference?.status === "passed"
      && binding.candidateValidationReference?.semanticVersionId === "SEM-S002-BUDGET-v1"
      && binding.candidateValidationReference?.dataVersion === DATA_BUNDLE_VERSION
      && exactArray(binding.candidateValidationReference?.dataVersions, COMPONENT_ASSET_VERSIONS)
      && sameScenarioContext(consumption?.scenarioContext, context)
      && consumption?.dataBundleVersion === DATA_BUNDLE_VERSION
      && exactArray(consumption?.componentAssetVersions, COMPONENT_ASSET_VERSIONS)
      && consumption?.ontologyVersion === "S002-ONTO-v1"
      && consumption?.semanticVersionId === "SEM-S002-BUDGET-v1"
      && consumption?.publishedPointer === "T019-S002-v1"
      && consumption?.c003DeliveryId === "C003-S002-DATA-v1"
      && consumption?.c003ReceiptId === "RECEIPT-C003-S002-DATA-v1"
      && consumption?.targetDraftId === "DRAFT-S002-BUDGET-v1"
      && consumption?.targetDraftRevision === 1
      && consumption?.status === "ready-for-current-scenario-run"
      && consumption?.readOnly === true);
  }

  function exactC033Receipt(current, context) {
    const contextId = `C033-${context?.scenarioRunId || ""}`;
    const exchange = current?.scenarioContextReceipts?.[contextId];
    return Boolean(exchange
      && exchange.envelope?.contractCode === "C033"
      && exchange.envelope?.contextId === contextId
      && sameScenarioContext(exchange.envelope?.scenarioContext, context)
      && exchange.receipt?.contractCode === "C033"
      && exchange.receipt?.contextId === contextId
      && exchange.receipt?.status === "accepted"
      && sameScenarioContext(exchange.receipt?.scenarioContext, context));
  }

  const OBJECT_SPECS = [
    {
      id: "OBJ-S002-BUDGET-SUBJECT", name: "预算主体", memberId: "MEM-S002-BUDGET-SUBJECT", count: 3,
      definition: "承担预算申报、执行监督与异常整改责任的单位或公司。",
      identity: "PROP-S002-SUBJECT-CODE", title: "PROP-S002-SUBJECT-NAME",
      properties: [
        ["PROP-S002-SUBJECT-CODE", "主体编码", "文本", "主体编码", "身份", ""],
        ["PROP-S002-SUBJECT-NAME", "主体名称", "文本", "主体名称", "标题", ""],
        ["PROP-S002-SUBJECT-TYPE", "主体类型", "枚举", "主体类型", "普通属性", ""],
      ],
    },
    {
      id: "OBJ-S002-BUDGET-VERSION", name: "预算版本", memberId: "MEM-S002-BUDGET-VERSION", count: 188,
      definition: "按主体、年度、版本、科目和期间承载最终批准预算与部门初始申报事实。",
      identity: "PROP-S002-VERSION-DETAIL-ID", title: "PROP-S002-VERSION-NAME",
      properties: [
        ["PROP-S002-VERSION-DETAIL-ID", "预算版本明细标识", "文本", "预算版本明细标识", "身份", ""],
        ["PROP-S002-VERSION-ID", "预算版本标识", "文本", "预算版本标识", "普通属性", ""],
        ["PROP-S002-VERSION-NAME", "预算版本名称", "文本", "预算版本名称", "标题", ""],
        ["PROP-S002-VERSION-YEAR", "预算年度", "整数", "预算年度", "普通属性", "年"],
        ["PROP-S002-VERSION-TYPE", "版本类型", "枚举", "版本类型", "普通属性", ""],
        ["PROP-S002-VERSION-SCENARIO", "预算情景", "枚举", "预算情景", "普通属性", ""],
        ["PROP-S002-VERSION-STATUS", "批准状态", "枚举", "批准状态", "普通属性", ""],
        ["PROP-S002-VERSION-CURRENCY", "币种", "文本", "币种", "普通属性", ""],
        ["PROP-S002-VERSION-UNIT", "金额单位", "文本", "金额单位", "普通属性", ""],
        ["PROP-S002-VERSION-SUBJECT", "主体编码", "文本", "主体编码", "普通属性", ""],
        ["PROP-S002-VERSION-ACCOUNT", "科目编码", "文本", "科目编码", "普通属性", ""],
        ["PROP-S002-VERSION-PERIOD", "期间", "文本", "期间", "普通属性", ""],
        ["PROP-S002-VERSION-AMOUNT", "预算金额", "数值", "预算金额", "普通属性", "万元"],
        ["PROP-S002-VERSION-TAX-BASIS", "税口径", "枚举", "税口径", "普通属性", ""],
        ["PROP-S002-VERSION-MARKER", "数据标识", "枚举", "数据标识", "普通属性", ""],
      ],
    },
    {
      id: "OBJ-S002-BUDGET-ACCOUNT", name: "预算科目", memberId: "MEM-S002-BUDGET-ACCOUNT", count: 10,
      definition: "用于承接收入、费用和成本事实的稳定预算科目。",
      identity: "PROP-S002-ACCOUNT-CODE", title: "PROP-S002-ACCOUNT-NAME",
      properties: [
        ["PROP-S002-ACCOUNT-CODE", "科目编码", "文本", "科目编码", "身份", ""],
        ["PROP-S002-ACCOUNT-NAME", "科目名称", "文本", "科目名称", "标题", ""],
        ["PROP-S002-ACCOUNT-CATEGORY", "科目类别", "枚举", "科目类别", "普通属性", ""],
        ["PROP-S002-ACCOUNT-TAX-BASIS", "税口径", "枚举", "税口径", "普通属性", ""],
      ],
    },
    {
      id: "OBJ-S002-ACTUAL-VOUCHER", name: "实际凭证", memberId: "MEM-S002-ACTUAL-VOUCHER", count: 420,
      definition: "记录期间、业务日期、入账日期、金额以及合法修正标识的实际执行事实。",
      identity: "PROP-S002-VOUCHER-ID", title: "PROP-S002-VOUCHER-NO",
      properties: [
        ["PROP-S002-VOUCHER-ID", "凭证行标识", "文本", "凭证行标识", "身份", ""],
        ["PROP-S002-VOUCHER-NO", "凭证号", "文本", "凭证号", "标题", ""],
        ["PROP-S002-VOUCHER-SUBJECT", "主体编码", "文本", "主体编码", "普通属性", ""],
        ["PROP-S002-VOUCHER-ACCOUNT", "科目编码", "文本", "科目编码", "普通属性", ""],
        ["PROP-S002-VOUCHER-PROJECT", "项目标识", "文本", "项目标识", "普通属性", ""],
        ["PROP-S002-VOUCHER-PERIOD", "会计期间", "文本", "会计期间", "普通属性", ""],
        ["PROP-S002-VOUCHER-BUSINESS-DATE", "业务日期", "日期", "业务日期", "普通属性", ""],
        ["PROP-S002-VOUCHER-POSTING-DATE", "入账日期", "日期", "入账日期", "普通属性", ""],
        ["PROP-S002-VOUCHER-AMOUNT", "实际金额", "数值", "实际金额", "普通属性", "万元"],
        ["PROP-S002-VOUCHER-ACCRUAL-AMOUNT", "未结计提金额", "数值", "未结计提金额", "普通属性", "万元"],
        ["PROP-S002-VOUCHER-SOURCE", "源值", "文本", "源值", "普通属性", ""],
        ["PROP-S002-VOUCHER-CORRECTED", "修正值", "文本", "修正值", "普通属性", ""],
        ["PROP-S002-VOUCHER-MARKER", "数据标识", "枚举", "数据标识", "普通属性", ""],
      ],
    },
    {
      id: "OBJ-S002-PROJECT-OCCUPANCY", name: "项目占用", memberId: "MEM-S002-PROJECT-OCCUPANCY", count: 21,
      definition: "按项目记录立项金额、源已使用值以及从实际执行回链的实际与未结计提原子事实。",
      identity: "PROP-S002-PROJECT-ID", title: "PROP-S002-PROJECT-NAME",
      properties: [
        ["PROP-S002-PROJECT-ID", "项目标识", "文本", "项目标识", "身份", ""],
        ["PROP-S002-PROJECT-NAME", "项目名称", "文本", "项目名称", "标题", ""],
        ["PROP-S002-PROJECT-SUBJECT", "主体编码", "文本", "主体编码", "普通属性", ""],
        ["PROP-S002-PROJECT-VERSION", "预算版本标识", "文本", "预算版本标识", "普通属性", ""],
        ["PROP-S002-PROJECT-AMOUNT", "立项金额", "数值", "立项金额", "普通属性", "万元"],
        ["PROP-S002-PROJECT-SOURCE-USED", "源已使用金额", "数值", "源已使用金额", "普通属性", "万元"],
        ["PROP-S002-PROJECT-ACTUAL", "实际已使用", "数值", "实际已使用", "普通属性", "万元"],
        ["PROP-S002-PROJECT-ACCRUED", "未结计提", "数值", "未结计提", "普通属性", "万元"],
        ["PROP-S002-PROJECT-MARKER", "数据标识", "枚举", "数据标识", "普通属性", ""],
      ],
    },
    {
      id: "OBJ-S002-PURCHASE-INITIATION", name: "采购发起", memberId: "MEM-S002-PURCHASE-INITIATION", count: 108,
      definition: "记录正向采购发起、占用或释放事件，并保留业务支持费-技术配置成本的供应商、人员分类、人员级别、采购净额、人月、币种和税率等原子字段。",
      identity: "PROP-S002-PURCHASE-ID", title: "PROP-S002-PURCHASE-NAME",
      properties: [
        ["PROP-S002-PURCHASE-ID", "采购发起标识", "文本", "采购发起标识", "身份", ""],
        ["PROP-S002-PURCHASE-NAME", "采购事项", "文本", "采购事项", "标题", ""],
        ["PROP-S002-PURCHASE-PROJECT", "项目标识", "文本", "项目标识", "普通属性", ""],
        ["PROP-S002-PURCHASE-SUPPLIER", "供应商编码", "文本", "供应商编码", "普通属性", ""],
        ["PROP-S002-PURCHASE-DATE", "发起日期", "日期", "发起日期", "普通属性", ""],
        ["PROP-S002-PURCHASE-DIRECTION", "变动方向", "枚举", "变动方向", "普通属性", ""],
        ["PROP-S002-PURCHASE-AMOUNT", "采购净额", "数值", "采购净额", "普通属性", "万元"],
        ["PROP-S002-PURCHASE-SERVICE-CATEGORY", "预算二级科目", "文本", "预算二级科目", "普通属性", ""],
        ["PROP-S002-PURCHASE-SERVICE-LEVEL", "人员级别", "文本", "人员级别", "普通属性", ""],
        ["PROP-S002-PURCHASE-PRICING-UNIT", "人员分类", "文本", "人员分类", "普通属性", ""],
        ["PROP-S002-PURCHASE-TAX-RATE", "税率", "数值", "税率", "普通属性", "%"],
        ["PROP-S002-PURCHASE-SERVICE-MONTHS", "人月", "数值", "人月", "普通属性", "人月"],
        ["PROP-S002-PURCHASE-UNIT-PRICE", "来源单价", "数值", "来源单价", "普通属性", "万元/人月"],
        ["PROP-S002-PURCHASE-CURRENCY", "币种", "文本", "币种", "普通属性", ""],
        ["PROP-S002-PURCHASE-MARKER", "数据标识", "枚举", "数据标识", "普通属性", ""],
      ],
    },
    {
      id: "OBJ-S002-SUPPLIER", name: "供应商", memberId: "MEM-S002-SUPPLIER", count: 4,
      definition: "为采购事项提供商品或服务，并接受同年度、同类同级人员跨部门人月成本复核的供应商。",
      identity: "PROP-S002-SUPPLIER-CODE", title: "PROP-S002-SUPPLIER-NAME",
      properties: [
        ["PROP-S002-SUPPLIER-CODE", "供应商编码", "文本", "供应商编码", "身份", ""],
        ["PROP-S002-SUPPLIER-NAME", "供应商名称", "文本", "供应商名称", "标题", ""],
        ["PROP-S002-SUPPLIER-CATEGORY", "供应商类别", "枚举", "供应商类别", "普通属性", ""],
      ],
    },
  ];

  const LINK_SPECS = [
    ["LINK-S002-VERSION-SUBJECT", "预算版本归属主体", "OBJ-S002-BUDGET-VERSION", "OBJ-S002-BUDGET-SUBJECT", "PROP-S002-VERSION-SUBJECT", "PROP-S002-SUBJECT-CODE", "多对一"],
    ["LINK-S002-VERSION-ACCOUNT", "预算版本对应科目", "OBJ-S002-BUDGET-VERSION", "OBJ-S002-BUDGET-ACCOUNT", "PROP-S002-VERSION-ACCOUNT", "PROP-S002-ACCOUNT-CODE", "多对一"],
    ["LINK-S002-VOUCHER-SUBJECT", "实际凭证归属主体", "OBJ-S002-ACTUAL-VOUCHER", "OBJ-S002-BUDGET-SUBJECT", "PROP-S002-VOUCHER-SUBJECT", "PROP-S002-SUBJECT-CODE", "多对一"],
    ["LINK-S002-VOUCHER-ACCOUNT", "实际凭证对应科目", "OBJ-S002-ACTUAL-VOUCHER", "OBJ-S002-BUDGET-ACCOUNT", "PROP-S002-VOUCHER-ACCOUNT", "PROP-S002-ACCOUNT-CODE", "多对一"],
    ["LINK-S002-VOUCHER-PROJECT", "实际凭证关联项目占用", "OBJ-S002-ACTUAL-VOUCHER", "OBJ-S002-PROJECT-OCCUPANCY", "PROP-S002-VOUCHER-PROJECT", "PROP-S002-PROJECT-ID", "多对一"],
    ["LINK-S002-PROJECT-VERSION", "项目占用使用预算版本", "OBJ-S002-PROJECT-OCCUPANCY", "OBJ-S002-BUDGET-VERSION", "PROP-S002-PROJECT-VERSION", "PROP-S002-VERSION-ID", "多对一"],
    ["LINK-S002-PURCHASE-PROJECT", "采购发起关联项目占用", "OBJ-S002-PURCHASE-INITIATION", "OBJ-S002-PROJECT-OCCUPANCY", "PROP-S002-PURCHASE-PROJECT", "PROP-S002-PROJECT-ID", "多对一"],
    ["LINK-S002-PURCHASE-SUPPLIER", "采购发起关联供应商", "OBJ-S002-PURCHASE-INITIATION", "OBJ-S002-SUPPLIER", "PROP-S002-PURCHASE-SUPPLIER", "PROP-S002-SUPPLIER-CODE", "多对一"],
  ];

  const METRIC_SPECS = [
    ["MET-S002-BUDGET-EXECUTION-RATE", "MET-007", "预算执行率", "%", "实际金额 ÷ 最终批准预算", "按年度、主体、科目和期间观察预算实际执行程度。", ["PROP-S002-VOUCHER-AMOUNT", "PROP-S002-VERSION-AMOUNT", "PROP-S002-VERSION-TYPE", "PROP-S002-VERSION-SUBJECT", "PROP-S002-VERSION-ACCOUNT", "PROP-S002-VERSION-PERIOD"]],
    ["MET-S002-ACTUAL-BUDGET-VARIANCE", "MET-008", "预算差异额", "万元", "实际金额 - 最终批准预算", "按金额观察实际执行与最终批准预算之间的差异；收入与费用分别绑定版本和情景。", ["PROP-S002-VOUCHER-AMOUNT", "PROP-S002-VERSION-AMOUNT", "PROP-S002-VERSION-TYPE", "PROP-S002-VERSION-SCENARIO"]],
    ["MET-S002-COST-TO-REVENUE", "MET-001", "成本占收比", "%", "总成本 ÷ 收入净额", "按不含税费用口径计算成本对收入的占比。", ["PROP-S002-ACCOUNT-CATEGORY", "PROP-S002-VOUCHER-AMOUNT", "PROP-S002-VERSION-TAX-BASIS"]],
    ["MET-S002-GROSS-MARGIN", "MET-002", "真正毛利率", "%", "（收入净额 - 总成本）÷ 收入净额", "与成本占收比分开定义的经营毛利率。", ["MET-S002-COST-TO-REVENUE"]],
    ["MET-S002-NET-IN-TRANSIT", "MET-003", "净在途占用", "万元", "PR/PO 占用变动金额带符号累计", "正向采购占用与负向释放按同一项目累计。", ["PROP-S002-PURCHASE-PROJECT", "PROP-S002-PURCHASE-DIRECTION", "PROP-S002-PURCHASE-AMOUNT"]],
    ["MET-S002-POSITIVE-PURCHASE", "MET-004", "正向采购发起量", "万元", "正向 PR 金额合计", "只统计正向采购发起，不重复累计后续 PO。", ["PROP-S002-PURCHASE-DIRECTION", "PROP-S002-PURCHASE-AMOUNT"]],
    ["MET-S002-DEC-POSITIVE-PURCHASE-SHARE", "MET-005", "12月正向采购发起占比", "%", "12月正向 PR ÷ 全年正向 PR", "观察年末采购发起集中程度。", ["PROP-S002-PURCHASE-DATE", "MET-S002-POSITIVE-PURCHASE"]],
    ["MET-S002-YEAR-END-OCCUPANCY-CONCENTRATION", "MET-009", "年末采购/预算占用集中度", "%（双分量）", "分别计算12月正向PR占比与12月净在途占用占比", "采购发起与预算占用分别使用同口径年度分母。", ["MET-S002-DEC-POSITIVE-PURCHASE-SHARE", "MET-S002-NET-IN-TRANSIT"]],
    ["MET-S002-PROJECT-AVAILABLE-BALANCE", "MET-006", "项目可用立项余额", "万元", "立项金额 - 实际 - 净在途占用 - 未结计提", "不使用合同额，展示项目仍可使用的立项余额。", ["PROP-S002-PROJECT-AMOUNT", "PROP-S002-PROJECT-ACTUAL", "MET-S002-NET-IN-TRANSIT", "PROP-S002-PROJECT-ACCRUED"]],
  ];

  const RULE_SPECS = [
    ["RULE-S002-PROJECT-COVERAGE", "RULE-001", "项目预算覆盖风险", "项目可用立项余额 < 0 万元", ["MET-S002-PROJECT-AVAILABLE-BALANCE"]],
    ["RULE-S002-EXECUTION-DEVIATION", "RULE-002", "费用预算执行偏离合理区间", "费用预算执行率 ≥ 95% 或 ≤ 70%；>100%为高优先级", ["MET-S002-BUDGET-EXECUTION-RATE"]],
    ["RULE-S002-COST-TO-REVENUE", "RULE-003", "成本占收比异常", "成本占收比 ≥ 100%；≥120%为高优先级", ["MET-S002-COST-TO-REVENUE", "MET-S002-GROSS-MARGIN"]],
    ["RULE-S002-YEAR-END-CONCENTRATION", "RULE-004", "年末采购/预算占用集中", "12月正向采购发起占比 ≥ 10%，或12月净在途占用占比 ≥ 10%", ["MET-S002-DEC-POSITIVE-PURCHASE-SHARE", "MET-S002-YEAR-END-OCCUPANCY-CONCENTRATION", "MET-S002-NET-IN-TRANSIT"]],
    ["RULE-S002-SUPPLIER-PRICE", "RULE-005", "供应商服务人员人月成本差异", "同一年度、预算二级科目为“业务支持费-技术配置”、同一人员分类、同一供应商、同一人员级别、同一币种且同一税率的可比组至少覆盖2个部门且人月均大于0；各部门人月成本=采购净额÷人月，最高部门人月成本÷最低部门人月成本 > 1.2 时异常", ["PROP-S002-PURCHASE-DATE", "PROP-S002-PURCHASE-SERVICE-CATEGORY", "PROP-S002-PURCHASE-PRICING-UNIT", "PROP-S002-PURCHASE-SUPPLIER", "PROP-S002-PURCHASE-SERVICE-LEVEL", "PROP-S002-PURCHASE-CURRENCY", "PROP-S002-PURCHASE-TAX-RATE", "PROP-S002-PROJECT-SUBJECT", "PROP-S002-PURCHASE-AMOUNT", "PROP-S002-PURCHASE-SERVICE-MONTHS"]],
  ];
  const LEGACY_ACTION_TYPE_ID_BY_CANONICAL = Object.freeze({
    "ACT-BUDGET-EXECUTION-RECTIFICATION": "ACT-BUDGET-INCREASE",
    "ACT-NEXT-YEAR-BUDGET-REASONABLENESS-REVIEW": "ACT-BUDGET-DECREASE",
    "ACT-EXPENSE-MANAGEMENT-OPTIMIZATION-REVIEW": "ACT-SUBJECT-TRANSFER",
    "ACT-BUDGET-SUBMISSION-EVIDENCE-SUPPLEMENT": "ACT-SUBMISSION-RETURN",
    "ACT-PROCUREMENT-COMMITMENT-CLEANUP": "ACT-RELEASE-COMMITMENT",
    "ACT-SUPPLIER-PRICE-REVIEW": "ACT-PRICE-REVIEW"
  });
  const ACTION_SPECS = [
    ["ACTION-S002-BUDGET-INCREASE", "ACT-BUDGET-EXECUTION-RECTIFICATION", "预算执行整改", ["RULE-S002-PROJECT-COVERAGE", "RULE-S002-EXECUTION-DEVIATION"], "形成预算执行整改提醒，人工确认后生成平台内待办；如需预算调增仅保留为下游草稿，不反写外部预算系统。"],
    ["ACTION-S002-BUDGET-DECREASE", "ACT-NEXT-YEAR-BUDGET-REASONABLENESS-REVIEW", "下一年度预算合理性复核", ["RULE-S002-EXECUTION-DEVIATION"], "形成下一年度预算测算与依据复核提醒，人工确认后生成平台内待办；不覆盖最终批准预算。"],
    ["ACTION-S002-SUBJECT-TRANSFER", "ACT-EXPENSE-MANAGEMENT-OPTIMIZATION-REVIEW", "费用管理优化核查", ["RULE-S002-EXECUTION-DEVIATION", "RULE-S002-COST-TO-REVENUE"], "形成收入确认、费用结构和可优化空间核查提醒，人工确认后生成平台内待办；不自动调账。"],
    ["ACTION-S002-SUBMISSION-RETURN", "ACT-BUDGET-SUBMISSION-EVIDENCE-SUPPLEMENT", "预算申报依据补充", [], "由获准的初始申报分析建议形成收入依据、成本拆解和测算说明补充待办；不冒充正式 Rule 命中，不自动退回申报。"],
    ["ACTION-S002-RELEASE-COMMITMENT", "ACT-PROCUREMENT-COMMITMENT-CLEANUP", "采购占用清理", ["RULE-S002-YEAR-END-CONCENTRATION"], "形成长期采购占用逐笔核查提醒，人工确认后生成平台内待办；不直接释放外部占用。"],
    ["ACTION-S002-PRICE-REVIEW", "ACT-SUPPLIER-PRICE-REVIEW", "供应商价格复核", ["RULE-S002-SUPPLIER-PRICE"], "形成供应商价格复核草稿，人工确认后生成平台内待办；不触发供应商系统。"],
  ];
  const RULE_ACTION_ROUTES = Object.freeze({
    "RULE-001": [{ branch: "项目可用立项余额 < 0", actionTypeId: "ACT-BUDGET-EXECUTION-RECTIFICATION", actionType: "预算执行整改" }],
    "RULE-002": [
      { branch: "费用预算执行率 > 100%", actionTypeId: "ACT-EXPENSE-MANAGEMENT-OPTIMIZATION-REVIEW", actionType: "费用管理优化核查" },
      { branch: "费用预算执行率 >= 95% 且 <= 100%", actionTypeId: "ACT-BUDGET-EXECUTION-RECTIFICATION", actionType: "预算执行整改" },
      { branch: "费用预算执行率 <= 70%", actionTypeId: "ACT-NEXT-YEAR-BUDGET-REASONABLENESS-REVIEW", actionType: "下一年度预算合理性复核" },
    ],
    "RULE-003": [{ branch: "成本占收比 >= 100%", actionTypeId: "ACT-EXPENSE-MANAGEMENT-OPTIMIZATION-REVIEW", actionType: "费用管理优化核查" }],
    "RULE-004": [{ branch: "任一同口径年末集中度分量 >= 10%", actionTypeId: "ACT-PROCUREMENT-COMMITMENT-CLEANUP", actionType: "采购占用清理" }],
    "RULE-005": [{ branch: "同供应商同类同级人员跨部门人月成本最高/最低倍率 > 1.2", actionTypeId: "ACT-SUPPLIER-PRICE-REVIEW", actionType: "供应商价格复核" }],
  });

  const POSITIONS = {
    // Object layer: order follows the six relationship hops so the baseline
    // link nodes can sit between adjacent objects without crossing the grid.
    "OBJ-S002-BUDGET-ACCOUNT": [70, 70],
    "OBJ-S002-ACTUAL-VOUCHER": [300, 70],
    "OBJ-S002-BUDGET-SUBJECT": [530, 70],
    "OBJ-S002-BUDGET-VERSION": [760, 70],
    "OBJ-S002-PROJECT-OCCUPANCY": [990, 70],
    "OBJ-S002-PURCHASE-INITIATION": [1220, 70],
    "OBJ-S002-SUPPLIER": [1450, 70],

    // Link layer: every Published Link Type has a deterministic position.
    "LINK-S002-VOUCHER-ACCOUNT": [185, 190],
    "LINK-S002-VOUCHER-SUBJECT": [415, 190],
    "LINK-S002-VERSION-SUBJECT": [645, 190],
    "LINK-S002-PROJECT-VERSION": [875, 190],
    "LINK-S002-PURCHASE-PROJECT": [1105, 190],
    "LINK-S002-PURCHASE-SUPPLIER": [1335, 190],
    "LINK-S002-VERSION-ACCOUNT": [510, 290],
    "LINK-S002-VOUCHER-PROJECT": [760, 290],

    // Metric layer: two centered rows keep all nine metrics readable at the
    // v1.0.3 Published-canvas default zoom.
    "MET-S002-BUDGET-EXECUTION-RATE": [280, 390],
    "MET-S002-ACTUAL-BUDGET-VARIANCE": [500, 390],
    "MET-S002-COST-TO-REVENUE": [720, 390],
    "MET-S002-GROSS-MARGIN": [940, 390],
    "MET-S002-NET-IN-TRANSIT": [1160, 390],
    "MET-S002-POSITIVE-PURCHASE": [390, 490],
    "MET-S002-DEC-POSITIVE-PURCHASE-SHARE": [610, 490],
    "MET-S002-YEAR-END-OCCUPANCY-CONCENTRATION": [830, 490],
    "MET-S002-PROJECT-AVAILABLE-BALANCE": [1050, 490],

    // Rule and Action layers preserve the existing dependency direction.
    "RULE-S002-PROJECT-COVERAGE": [280, 590],
    "RULE-S002-EXECUTION-DEVIATION": [500, 590],
    "RULE-S002-COST-TO-REVENUE": [720, 590],
    "RULE-S002-YEAR-END-CONCENTRATION": [940, 590],
    "RULE-S002-SUPPLIER-PRICE": [1160, 590],
    "ACTION-S002-BUDGET-INCREASE": [50, 690],
    "ACTION-S002-BUDGET-DECREASE": [290, 690],
    "ACTION-S002-SUBJECT-TRANSFER": [530, 690],
    "ACTION-S002-SUBMISSION-RETURN": [770, 690],
    "ACTION-S002-RELEASE-COMMITMENT": [1010, 690],
    "ACTION-S002-PRICE-REVIEW": [1250, 690],
  };

  function publishedMetadata(kind, definition) {
    return {
      kind,
      definition,
      owner: "本体管理",
      publicationState: "Published",
      lifecycleState: "Published",
      bindability: "可新绑定",
      effectiveFrom: EFFECTIVE_FROM,
      effectiveTo: null,
      changeType: "新增",
      changeReason: "S002 预算监督管理语义首次发布",
      lastChangedAt: PUBLISHED_AT,
      applicableScenario: "S002 预算监督管理",
      controlledEvidenceLocator: "EV-S002-M01-PUBLISH-001",
    };
  }

  function buildSeedState(context) {
    const members = OBJECT_SPECS.map((spec) => ({
      id: spec.memberId,
      name: `${spec.name}资产成员`,
      grain: spec.name === "实际凭证" ? "一行合法凭证记录" : spec.name === "采购发起" ? "一笔采购发起或释放记录" : `一个${spec.name}`,
      identity: spec.properties.find((property) => property[0] === spec.identity)?.[1] || "稳定身份",
      identityFieldId: spec.identity,
      identityCheckStatus: "通过",
      identityMissingCount: 0,
      identityDuplicateCount: 0,
      identityEvidenceLocator: `EV-S002-M02-IDENTITY-${spec.memberId}`,
      rows: spec.count,
      fields: spec.properties.map(([id, name, dataType, , , unit]) => [name, dataType, unit || "", id]),
    }));

    const objects = OBJECT_SPECS.map((spec) => {
      const properties = spec.properties.map(([id, name, dataType, sourceField, role, unit]) => ({
        id, name, dataType, unit: unit || "", role, nullable: role === "身份" ? "否" : "是",
        sourceFieldId: id, sourceField, status: "已映射", memberId: spec.memberId,
        parentId: spec.id, parentName: spec.name,
        ...publishedMetadata("property", `${spec.name}的${name}。`),
      }));
      return {
        id: spec.id, name: spec.name, memberId: spec.memberId, count: spec.count,
        identity: spec.identity, title: spec.title, objectKind: "业务实体", linkEndpointFields: [], properties,
        ...publishedMetadata("object", spec.definition),
      };
    });
    const propertyById = new Map(objects.flatMap((object) => object.properties.map((property) => [property.id, property])));
    const objectById = new Map(objects.map((object) => [object.id, object]));

    const links = LINK_SPECS.map(([id, name, source, target, sourcePropertyId, targetPropertyId, cardinality]) => ({
      id, name, reverseName: `${objectById.get(target).name}关联${objectById.get(source).name}`,
      source, target, sourceName: objectById.get(source).name, targetName: objectById.get(target).name,
      sourceEndpoint: { kind: "property", id: sourcePropertyId }, targetEndpoint: { kind: "property", id: targetPropertyId },
      sourceEndpointLabel: propertyById.get(sourcePropertyId).name, targetEndpointLabel: propertyById.get(targetPropertyId).name,
      sourceEndpointType: propertyById.get(sourcePropertyId).dataType, targetEndpointType: propertyById.get(targetPropertyId).dataType,
      endpointCompatible: true, allowedDirection: "双向导航", coverage: "覆盖当前 S002 数据资产中的稳定键关系", cardinality,
      ...publishedMetadata("link", `${objectById.get(source).name}通过稳定键关联${objectById.get(target).name}。`),
    }));

    const metrics = METRIC_SPECS.map(([id, code, name, unit, calculation, definition, dependencyIds]) => ({
      id, code, aliases: [code], name, unit, calculation, definition, dependencyIds, type: "Metric",
      sourceObjectId: "OBJ-S002-ACTUAL-VOUCHER", subjectObjectId: "OBJ-S002-BUDGET-SUBJECT",
      scope: "年度、单位、科目、项目和期间", time: "预算年度与会计期间", zeroHandling: "分母为零或证据不足时返回无法计算",
      ...publishedMetadata("metric", definition),
    }));
    const rules = RULE_SPECS.map(([id, code, name, condition, dependencyIds]) => {
      const isCostToRevenue = code === "RULE-003";
      const isSupplierPersonMonth = code === "RULE-005";
      const definition = isCostToRevenue
        ? "识别成本高于收入净额的预算主体，并同时保留成本占收比、真正毛利率及收入费用证据。"
        : isSupplierPersonMonth
          ? "仅对预算二级科目“业务支持费-技术配置”进行比较；以发起日期提取年度，通过采购发起→项目占用取得部门，按人员分类、供应商、人员级别、币种和税率形成可比组，以采购净额÷人月重算各部门人月成本，最高/最低倍率大于1.2时保留部门级明细证据。"
          : `识别${name}并保留同版指标与数据证据。`;
      return {
        id, name, code, aliases: [code], type: "Rule",
        objectId: isSupplierPersonMonth ? "OBJ-S002-PURCHASE-INITIATION" : "OBJ-S002-BUDGET-SUBJECT",
        appliesTo: isSupplierPersonMonth ? "供应商、人员分类、人员级别及部门可比组" : "预算主体或项目",
        condition, dependencyIds, metricIds: dependencyIds.filter((item) => item.startsWith("MET-")), dependency: dependencyIds.join("、"), validity: "随 T019-S002-v1 生效",
        actionRoutes: (RULE_ACTION_ROUTES[code] || []).map((route) => ({ ...route })),
        definition, testSample: "S002 演示异常样本与正常对照样本",
        evaluationPurpose: isCostToRevenue ? "费用管理与收入确认合理性复核" : isSupplierPersonMonth ? "供应商服务人员跨部门人月成本一致性复核" : "业务异常识别",
        actionPolicy: isCostToRevenue ? "命中后可形成费用管理优化核查候选" : isSupplierPersonMonth ? "命中后可形成供应商价格复核候选并支持部门级明细穿透" : "命中后可进入受控Action候选",
        currentEvaluationStatus: "evaluated-with-hit-samples",
        businessBasis: "confirmed", decisionRefs: ["D034"],
        ...publishedMetadata("rule", definition),
      };
    });
    const actions = ACTION_SPECS.map(([id, code, name, ruleIds, result]) => ({
      id, code, legacyCompatibleId: LEGACY_ACTION_TYPE_ID_BY_CANONICAL[code], aliases: [code, LEGACY_ACTION_TYPE_ID_BY_CANONICAL[code]].filter(Boolean), name, type: "Action Type", targetObjectId: "OBJ-S002-BUDGET-SUBJECT", target: "预算主体或项目", ruleIds,
      parameters: "目标主体、年度、科目或项目、异常证据、整改或复核要求与原因",
      prerequisite: "Published Rule 命中或获准分析建议可追溯，且目标对象稳定身份完整。",
      result, failure: "证据、目标对象或人工确认缺失时不生成待办。", confirmation: "必须人工确认",
      defaultDue: "人工确认后 5 个工作日内处理", businessBasis: "confirmed", decisionRefs: ["D034"],
      definition: `${name}仅生成受控草稿和平台内待办，不自动审批、过账或调用外部预算系统。`,
      ...publishedMetadata("action", `${name}仅生成受控草稿和平台内待办，不自动审批、过账或调用外部预算系统。`),
    }));

    const relations = links.map((link) => {
      const sourceObject = objectById.get(link.source);
      const targetObject = objectById.get(link.target);
      return {
        id: `REL-${link.id}`, name: link.name,
        sourceMemberId: sourceObject.memberId, sourceFieldId: link.sourceEndpoint.id,
        targetMemberId: targetObject.memberId, targetFieldId: link.targetEndpoint.id,
        cardinality: link.cardinality, endpointCheckStatus: "通过", unmatchedSourceCount: 0, unmatchedTargetCount: 0,
        scope: ["LINK-S002-VOUCHER-PROJECT", "LINK-S002-PROJECT-VERSION"].includes(link.id) ? "cross-asset" : "asset-internal",
        endpointEvidenceLocator: `EV-S002-M02-${link.id}`,
      };
    });

    const sourceDelivery = {
      contractSchemaVersion: 2,
      sourceModule: "数据工程", contractCode: "C003",
      deliveryId: "C003-S002-DATA-v1", deliverySeriesId: "C003-S002-DATA-v1", attemptNumber: 1,
      retryOf: null, previousDeliveryId: null, deliveryStatus: "已交付", deliveredAt: ACTUAL_FORMED_AT,
      scenarioContext: { ...context }, evidenceLocator: "EV-S002-M02-DATA-ASSET-v1",
      assetId: "S002-DATA-BUNDLE", t006Id: "S002-DATA-BUNDLE", assetName: "S002 预算监督数据资产发布组合",
      assetRole: "compatibility-delivery-pointer", assetVersion: DATA_BUNDLE_VERSION, t007Version: DATA_BUNDLE_VERSION, asOf: "2025-12-31", t008AsOf: "2025-12-31",
      componentAssets: [
        {
          assetId: "S002-BUDGET-EXECUTION-ASSET", assetName: "预算编制与执行数据资产", assetVersion: "S002-BUDGET-EXEC-v1", asOf: "2025-12-31", publicationState: "已发布",
          sourceIds: ["DS-ACTUAL-EXECUTION", "DS-APPROVED-BUDGET", "DS-INITIAL-SUBMISSION"], sourceSnapshotIds: ["SRC-2024-ACTUAL", "SRC-2025-ACTUAL", "SRC-2024-BUDGET", "SRC-2025-BUDGET", "SRC-2025-SUBMISSION", "SRC-2026-SUBMISSION"],
          memberIds: ["MEM-S002-BUDGET-SUBJECT", "MEM-S002-BUDGET-VERSION", "MEM-S002-BUDGET-ACCOUNT", "MEM-S002-ACTUAL-VOUCHER"],
          internalRelationIds: ["REL-LINK-S002-VERSION-SUBJECT", "REL-LINK-S002-VERSION-ACCOUNT", "REL-LINK-S002-VOUCHER-SUBJECT", "REL-LINK-S002-VOUCHER-ACCOUNT"], crossAssetRelationIds: ["REL-LINK-S002-VOUCHER-PROJECT"],
          pipelineId: "S002-PIPE-BUDGET-v1", runId: "RUN-S002-PIPE-BUDGET-v1", qualityResultId: "S002-QUALITY-RECEIPT-v1", evidenceLocator: "EV-S002-M02-BUDGET-EXEC-v1"
        },
        {
          assetId: "S002-PROJECT-OCCUPANCY-ASSET", assetName: "项目预算占用与余额数据资产", assetVersion: "S002-PROJECT-OCC-v1", asOf: "2025-12-31", publicationState: "已发布",
          sourceIds: ["DS-ACTUAL-EXECUTION", "DS-INITIAL-SUBMISSION", "DS-PROJECT-COMMITMENT", "DS-PROJECT-USE"], sourceSnapshotIds: ["SRC-2024-ACTUAL", "SRC-2025-ACTUAL", "SRC-2025-SUBMISSION", "SRC-2026-SUBMISSION", "SRC-2025-COMMITMENT", "SRC-PROJECT-USE"],
          memberIds: ["MEM-S002-PROJECT-OCCUPANCY", "MEM-S002-PURCHASE-INITIATION", "MEM-S002-SUPPLIER"],
          internalRelationIds: ["REL-LINK-S002-PURCHASE-PROJECT", "REL-LINK-S002-PURCHASE-SUPPLIER"], crossAssetRelationIds: ["REL-LINK-S002-PROJECT-VERSION"],
          pipelineId: "S002-PIPE-PROJECT-v1", runId: "RUN-S002-PIPE-PROJECT-v1", qualityResultId: "S002-QUALITY-RECEIPT-v1", evidenceLocator: "EV-S002-M02-PROJECT-OCC-v1"
        }
      ],
      crossAssetRelations: [
        { relationId: "REL-LINK-S002-VOUCHER-PROJECT", name: "实际凭证关联项目占用", sourceAssetVersion: "S002-BUDGET-EXEC-v1", targetAssetVersion: "S002-PROJECT-OCC-v1", stableKey: "项目标识", endpointCheckStatus: "通过", evidenceLocator: "EV-S002-M02-LINK-VOUCHER-PROJECT" },
        { relationId: "REL-LINK-S002-PROJECT-VERSION", name: "项目占用使用预算版本", sourceAssetVersion: "S002-PROJECT-OCC-v1", targetAssetVersion: "S002-BUDGET-EXEC-v1", stableKey: "预算版本标识", endpointCheckStatus: "通过", evidenceLocator: "EV-S002-M02-LINK-PROJECT-VERSION" }
      ],
      sourceSnapshotId: "S002-SOURCE-SNAPSHOT-v1",
      sourceFingerprint: { algorithm: "SHA-256", value: "a283fabf23f63506f33c5900d0f3643c82734659a890ee504d7394bdb0244599", sizeBytes: 184320 },
      processingModuleVersion: "M02-S002-v1 · 2条管道", publishedAt: ACTUAL_FORMED_AT,
      versionDescription: "分别发布预算编制与执行、项目预算占用与余额两个数据资产，并以S002-DATA-v1作为C003兼容交付组合指针",
      source: "预算监督管理权威资料与明确标识的演示加工数据",
      publicationState: "已发布", purpose: "S002 预算监督管理", consumptionRestriction: "仅限本场景模拟演示；加工和修正记录保留标识",
      lineageCheckStatus: "通过", lineageEvidenceLocator: "EV-S002-M02-LINEAGE-v1",
      mappingEligibility: { status: "可供本体映射", evidenceLocator: "EV-S002-M02-MAPPING-ELIGIBLE-v1" },
      qualitySummary: { status: "通过", resultId: "S002-QUALITY-RECEIPT-v1", checkedAt: ACTUAL_FORMED_AT, evidenceLocator: "EV-S002-M02-QUALITY-v1" },
      runEvidence: {
        qualityResultId: "S002-QUALITY-RECEIPT-v1", evidenceLocator: "EV-S002-M02-RUN-v1",
        runs: [
          { runId: "RUN-S002-PIPE-BUDGET-v1", definitionVersion: "S002-PIPE-BUDGET-v1", targetAssetVersion: "S002-BUDGET-EXEC-v1" },
          { runId: "RUN-S002-PIPE-PROJECT-v1", definitionVersion: "S002-PIPE-PROJECT-v1", targetAssetVersion: "S002-PROJECT-OCC-v1" }
        ]
      },
      sourceChain: ["S002-SOURCE-SNAPSHOT-v1", "S002-PIPE-BUDGET-v1 + S002-PIPE-PROJECT-v1", "RUN-S002-PIPE-BUDGET-v1 + RUN-S002-PIPE-PROJECT-v1", "S002-QUALITY-RECEIPT-v1", DATA_BUNDLE_VERSION],
      componentSourceChains: {
        "S002-BUDGET-EXEC-v1": ["SRC-2024-ACTUAL + SRC-2025-ACTUAL + SRC-2024-BUDGET + SRC-2025-BUDGET + SRC-2025-SUBMISSION + SRC-2026-SUBMISSION", "S002-PIPE-BUDGET-v1", "RUN-S002-PIPE-BUDGET-v1", "S002-QUALITY-RECEIPT-v1", "S002-BUDGET-EXEC-v1"],
        "S002-PROJECT-OCC-v1": ["SRC-2024-ACTUAL + SRC-2025-ACTUAL + SRC-2025-SUBMISSION + SRC-2026-SUBMISSION + SRC-2025-COMMITMENT + SRC-PROJECT-USE", "S002-PIPE-PROJECT-v1", "RUN-S002-PIPE-PROJECT-v1", "S002-QUALITY-RECEIPT-v1", "S002-PROJECT-OCC-v1"]
      },
      t008Confirmation: {
        snapshotId: "S002-SOURCE-SNAPSHOT-v1", asOf: "2025-12-31", confirmedBy: "平台管理员",
        confirmedAt: ACTUAL_FORMED_AT, basis: "5个逻辑数据源、8个年度/确认快照、14个逻辑成员",
        evidenceId: "T008-S002-v1", evidenceLocator: "EV-T008-S002-v1", sizeBytes: 184320, scenarioContext: { ...context },
      },
      members, relations,
    };
    sourceDelivery.payloadFingerprintValid = true;
    sourceDelivery.payloadFingerprint = c003PayloadFingerprint(sourceDelivery);
    const sourceDeliveryFingerprint = fingerprint(sourceDelivery);

    const objectMappings = objects.map((object) => ({
      objectId: object.id, memberId: object.memberId, identityPropertyId: object.identity, titlePropertyId: object.title,
      propertyMappings: object.properties.map((property) => ({
        propertyId: property.id, sourceFieldId: property.sourceFieldId, dataType: property.dataType,
      })),
    }));
    const linkMappings = links.map((link, index) => ({
      linkId: link.id, sourceObjectId: link.source, targetObjectId: link.target,
      sourceEndpoint: { ...link.sourceEndpoint }, targetEndpoint: { ...link.targetEndpoint },
      sourceField: link.sourceEndpointLabel, targetField: link.targetEndpointLabel,
      cardinality: link.cardinality, assetRelationId: relations[index].id,
    }));
    const dataContract = {
      sourceModule: "数据工程", contractCode: "C003", deliveredAt: sourceDelivery.deliveredAt,
      evidenceLocator: sourceDelivery.evidenceLocator, sourceContractFingerprint: sourceDeliveryFingerprint,
      mappingVersionId: "S002-MAPPING-v1", assetId: sourceDelivery.assetId, assetName: sourceDelivery.assetName,
      assetRole: sourceDelivery.assetRole, assetVersion: sourceDelivery.assetVersion, asOf: sourceDelivery.asOf, sourceSnapshotId: sourceDelivery.sourceSnapshotId,
      componentAssets: sourceDelivery.componentAssets.map((asset) => ({ ...asset })),
      crossAssetRelations: sourceDelivery.crossAssetRelations.map((relation) => ({ ...relation })),
      componentSourceChains: Object.fromEntries(Object.entries(sourceDelivery.componentSourceChains).map(([version, chain]) => [version, [...chain]])),
      processingModuleVersion: sourceDelivery.processingModuleVersion, publishedAt: sourceDelivery.publishedAt,
      versionDescription: sourceDelivery.versionDescription, source: sourceDelivery.source,
      sourceChain: [...sourceDelivery.sourceChain], publicationState: sourceDelivery.publicationState,
      purpose: sourceDelivery.purpose, consumptionRestriction: sourceDelivery.consumptionRestriction,
      lineageCheckStatus: sourceDelivery.lineageCheckStatus, lineageEvidenceLocator: sourceDelivery.lineageEvidenceLocator,
      mappingEligibility: { ...sourceDelivery.mappingEligibility }, qualitySummary: { ...sourceDelivery.qualitySummary },
      businessContext: { currency: "CNY", unit: "万元", expenseBasis: "费用不含税", incomeSign: "源负号代表收益，展示转正", dataAsOf: "2025-12-31" },
      scope: `2 个已发布数据资产、${members.length} 个资产成员、6 条资产内关系与 2 条跨资产关系`, members, relations, objectMappings, linkMappings,
    };

    const properties = objects.flatMap((object) => object.properties.map((property) => ({ ...property })));
    const resources = [...objects, ...properties, ...links, ...metrics, ...rules, ...actions];
    const resourceAliases = Object.fromEntries([...metrics, ...rules, ...actions].flatMap((resource) => (resource.aliases || []).map((alias) => [alias, resource.id])));
    const versionId = "SEM-S002-BUDGET-v1";
    const semanticVersion = "S002-ONTO-v1";
    const version = {
      id: versionId, ontologyStableId: "ONT-S002-BUDGET-SUPERVISION", name: "S002 预算监督管理本体",
      definition: "统一组织最终批准预算、部门初始申报、实际执行、项目余额、采购占用、异常规则与受控行动类型。",
      scenario: "S002 预算监督管理", scenarioContext: { ...context }, semanticVersion,
      status: "Published", publicationState: "Published", lifecycleState: "Published", owner: "本体管理", bindability: "可新绑定",
      effectiveFrom: EFFECTIVE_FROM, effectiveTo: null, replacementDeclaration: "首次发布，无替代版本",
      publishedAt: PUBLISHED_AT, lastChangedAt: PUBLISHED_AT, sourceDraftId: "DRAFT-S002-BUDGET-v1", sourceDraftName: "S002 预算本体初始 Draft",
      sourceDeliveryId: sourceDelivery.deliveryId, sourceDeliverySnapshot: sourceDelivery,
      sourceDeliveryReceiptSnapshot: {
        sourceModule: "本体管理", contractCode: "C003", receiptId: `RECEIPT-${sourceDelivery.deliveryId}`,
        deliveryId: sourceDelivery.deliveryId, status: "accepted",
        receivedAt: ACTUAL_FORMED_AT, reason: null, t006Id: sourceDelivery.assetId,
        t007Version: sourceDelivery.assetVersion, t008AsOf: sourceDelivery.asOf,
        componentAssets: sourceDelivery.componentAssets.map((asset) => ({ assetId: asset.assetId, name: asset.assetName, version: asset.assetVersion, asOf: asset.asOf })),
        targetDraftId: "DRAFT-S002-BUDGET-v1", targetDraftRevision: 1,
        scenarioContext: { ...context },
      },
      sourceDeliveryFingerprint, draftRevision: 1, basedOnVersion: null, basedOnVersionId: null,
      changeSummary: "预算监督语义首次发布：7类对象、9项指标、5项规则。",
      consumptionContext: {
        scenarioContext: { ...context }, baselineVersion: "v1.0.3", baselineSnapshotId: "BSL-S001-V103-DE0119608E26",
        dataBundle: { assetId: sourceDelivery.assetId, assetRole: sourceDelivery.assetRole, version: DATA_BUNDLE_VERSION, asOf: sourceDelivery.asOf },
        componentAssets: sourceDelivery.componentAssets.map((asset) => ({ assetId: asset.assetId, name: asset.assetName, version: asset.assetVersion, asOf: asset.asOf, pipelineId: asset.pipelineId })),
        ontologyVersion: semanticVersion, semanticVersionId: versionId, publishedPointer: "T019-S002-v1",
        metricVersion: "S002-METRIC-v1", ruleVersion: "S002-RULE-v1", actionTypeVersion: "S002-ACTION-TYPE-v1", resourceAliases,
        businessContext: { currency: "CNY", unit: "万元", expenseBasis: "费用不含税", incomeSign: "源负号代表收益，展示转正" },
        contracts: { sourceDelivery: sourceDelivery.deliveryId, sourceReceipt: `RECEIPT-${sourceDelivery.deliveryId}`, mappingCheck: "REC-S002-M01-C029-001", eligibility: "REC-S002-M01-T018-001", queryValidation: "EV-S002-M03-FIXED-QUESTIONS-v1", adoption: "T019-S002-v1" },
        consumers: ["智能问数", "决策中心", "Agent 应用", "报告中心"], status: "ready-for-current-scenario-run", readOnly: true
      },
      validationSnapshot: {
        status: "passed", draftId: "DRAFT-S002-BUDGET-v1", fingerprint: "S002-BUDGET-v1",
        checkedAt: PUBLISHED_AT, scopeSummary: `${resources.length} 项语义资源与映射合同`,
        groups: ["稳定身份", "对象与属性", "关系端点", "Metric", "Rule 与 Action Type", "发布合同"].map((name) => ({ name, status: "passed" })),
        mapping: { complete: true, detail: `2个数据资产、${members.length}个资产成员、6条资产内关系与2条跨资产关系已冻结` },
        resourceManifest: resources.map((resource) => resource.id),
      },
      dataContract, resourceAliases, positions: { ...POSITIONS }, objects, properties, links, metrics, rules, actions,
      publishRecordId: "REC-S002-M01-PUBLISH-001", publishEvidenceRef: "EV-S002-M01-PUBLISH-001",
      controlledEvidenceLocator: "EV-S002-M01-PUBLISH-001",
      resourceManifestSnapshot: {
        versionId, semanticVersion, capturedAt: PUBLISHED_AT,
        resources: resources.map((resource) => ({
          id: resource.id, name: resource.name, type: resource.type || ({ object: "Object Type", property: "Property", link: "Link Type", metric: "Metric", rule: "Rule", action: "Action Type" })[resource.kind],
          kind: resource.kind, publicationState: "Published", businessValidityAtPublish: "有效", owner: "本体管理",
          effectiveFrom: EFFECTIVE_FROM, effectiveTo: null, bindability: "可新绑定", changeType: "新增",
          changeReason: "S002 预算监督管理语义首次发布", replacementDetail: "无", lastChangedAt: PUBLISHED_AT,
          applicableScenario: "S002 预算监督管理", controlledEvidenceLocator: `EV-S002-M01-PUBLISH-001 / ${resource.id}`, capturedAt: PUBLISHED_AT,
        })),
      },
    };

    const candidateKey = `${versionId}|${DATA_BUNDLE_VERSION}|2025-12-31|1`;
    const validationReference = {
      sourceModule: "智能问数", contractCode: "C008", decisionRef: "D064", runId: "RUN-S002-M03-FIXED-QUESTIONS-v1", status: "passed",
      evidenceLocator: "EV-S002-M03-FIXED-QUESTIONS-v1", questionSetVersion: "QS-S002-v1",
      semanticVersionId: versionId, semanticVersion, dataVersion: DATA_BUNDLE_VERSION, dataVersions: sourceDelivery.componentAssets.map((asset) => asset.assetVersion), asOf: "2025-12-31",
      candidateKey, scenarioContext: { ...context },
    };
    const records = [
      {
        id: "REC-S002-M01-PUBLISH-001", title: "语义版本已发布", detail: "预算监督语义资源已形成不可变 Published 快照。",
        status: "成功", tone: "green", time: PUBLISHED_AT, semanticVersionId: versionId, semanticVersion, dataVersion: null,
        candidateKey: null, scenarioContext: { ...context }, evidenceCode: "EV-S002-M01-PUBLISH-001", contractCode: "C007",
        resourceRef: null, sourceModule: "本体管理", formsContract: true,
      },
      {
        id: "REC-S002-M01-C029-001", title: "数据与本体匹配检查通过", detail: "S002-BUDGET-EXEC-v1与S002-PROJECT-OCC-v1均已纳入S002-DATA-v1交付组合，和预算本体对象、稳定键及关系映射一致。",
        status: "成功", tone: "green", time: PUBLISHED_AT, semanticVersionId: versionId, semanticVersion, dataVersion: "S002-DATA-v1",
        candidateKey, scenarioContext: { ...context }, evidenceCode: "EV-S002-M01-C029-001", contractCode: "C029",
        resourceRef: null, sourceModule: "本体管理", formsContract: true,
      },
      {
        id: "REC-S002-M01-T018-001", title: "候选具备消费验证条件", detail: "精确双版本、时点、质量和资源合同均已冻结。",
        status: "成功", tone: "green", time: PUBLISHED_AT, semanticVersionId: versionId, semanticVersion, dataVersion: "S002-DATA-v1",
        candidateKey, scenarioContext: { ...context }, evidenceCode: "EV-S002-M01-T018-001", contractCode: "T018",
        resourceRef: "T018", sourceModule: "本体管理", formsContract: true,
      },
      {
        id: "REC-S002-M03-C008-001", title: "智能问数固定题验证已通过", detail: "6 个获准预算问题均返回同版结构化结果、Rule Hit 与证据下钻。",
        status: "通过", tone: "green", time: PUBLISHED_AT, semanticVersionId: versionId, semanticVersion, dataVersion: "S002-DATA-v1",
        candidateKey, scenarioContext: { ...context }, evidenceCode: null, contractCode: "C008",
        resourceRef: null, sourceModule: "智能问数", formsContract: false,
        externalValidationContractRef: "C008", decisionRef: "D064", externalRunId: validationReference.runId,
        externalEvidenceRef: validationReference.evidenceLocator, externalValidationSnapshot: { ...validationReference },
      },
      {
        id: "T019-S002-v1", title: "已切换为正式数据", detail: "预算编制与执行、项目预算占用与余额两个资产版本已通过S002-DATA-v1组合指针与S002-ONTO-v1形成当前正式使用版本。",
        status: "成功", tone: "green", time: PUBLISHED_AT, semanticVersionId: versionId, semanticVersion, dataVersion: "S002-DATA-v1",
        candidateKey, scenarioContext: { ...context }, evidenceCode: "EV-T019-S002-v1", contractCode: "",
        resourceRef: "T019", sourceModule: "本体管理", formsContract: true, decisionRef: "D034",
      },
    ];
    const binding = {
      semanticVersion, dataVersion: DATA_BUNDLE_VERSION, dataVersions: sourceDelivery.componentAssets.map((asset) => asset.assetVersion), asOf: "2025-12-31", switchedAt: PUBLISHED_AT,
      scenarioContext: { ...context }, candidateKey, candidateValidationReference: validationReference,
      validationEvidenceRef: validationReference.evidenceLocator, questionSetVersion: validationReference.questionSetVersion,
      adoptionRecordId: "T019-S002-v1", adoptionEvidenceLocator: "EV-T019-S002-v1",
      consumptionContext: {
        scenarioContext: { ...context }, dataBundleVersion: DATA_BUNDLE_VERSION,
        componentAssetVersions: [...COMPONENT_ASSET_VERSIONS], ontologyVersion: semanticVersion,
        semanticVersionId: versionId, publishedPointer: "T019-S002-v1", asOf: "2025-12-31",
        currency: "CNY", unit: "万元", expenseBasis: "费用不含税", incomeSign: "源负号代表收益，展示转正",
        c003DeliveryId: sourceDelivery.deliveryId, c003ReceiptId: `RECEIPT-${sourceDelivery.deliveryId}`,
        targetDraftId: "DRAFT-S002-BUDGET-v1", targetDraftRevision: 1,
        status: "ready-for-current-scenario-run", readOnly: true
      },
    };
    const contextId = `C033-${context.scenarioRunId}`;
    const contextEnvelope = {
      sourceModule: "平台公共层", contractCode: "C033", contextId,
      deliveredAt: context.formedAt, evidenceLocator: `EV-${contextId}`, scenarioContext: { ...context },
    };
    const contextReceipt = {
      sourceModule: "本体管理", contractCode: "C033", contextId, status: "accepted",
      receivedAt: context.formedAt, reason: null, scenarioContext: { ...context },
    };
    const deliveryReceipt = { ...version.sourceDeliveryReceiptSnapshot };

    return {
      s002BusinessSeedVersion: SEED_VERSION,
      drafts: [], activeDraftId: null, publishedVersions: [version], selectedVersionId: versionId,
      updatesByVersion: {}, bindingsByVersion: { [versionId]: { current: binding, previous: null } },
      recordsByVersion: { [versionId]: records },
      externalDataAssets: {
        [`${sourceDelivery.assetId}::${sourceDelivery.assetVersion}`]: sourceDelivery
      },
      externalComponentAssetReferences: Object.fromEntries(sourceDelivery.componentAssets.map((asset) => [`${asset.assetId}::${asset.assetVersion}`, { ...asset, bundleAssetId: sourceDelivery.assetId, bundleVersion: sourceDelivery.assetVersion, scenarioContext: { ...context }, readOnly: true }])),
      externalRefreshRequests: {}, externalQualityFacts: {},
      externalConsumerCompatibility: {
        [`CFG-S002-M03-v1|1.0.0|${versionId}|${DATA_BUNDLE_VERSION}`]: {
          sourceModule: "智能问数", contractCode: "C009", consumer: "智能问数", configId: "CFG-S002-M03-v1", configVersion: "1.0.0",
          semanticVersionId: versionId, semanticVersion, dataVersion: DATA_BUNDLE_VERSION, status: "compatible",
          checkedAt: ACTUAL_FORMED_AT, evidenceLocator: "EV-S002-M03-C009-v1", scenarioContext: { ...context },
        },
      },
      externalDeliveryIssues: [], dataAssetDeliveryReceipts: { [sourceDelivery.deliveryId]: deliveryReceipt },
      dataAssetDeliveryFingerprints: { [sourceDelivery.deliveryId]: sourceDeliveryFingerprint },
      scenarioContexts: { [context.scenarioId]: { ...context } }, activeScenarioId: context.scenarioId, scenarioHistory: [],
      scenarioContextReceipts: { [contextId]: { envelope: contextEnvelope, receipt: contextReceipt } },
      pendingScenarioReset: null, scenarioActivationIntent: null, isolatedLegacyState: [],
      implementationBaseDate: IMPLEMENTATION_BASE_DATE,
      storageMigration: { status: "clean", checkedAt: ACTUAL_FORMED_AT, reason: "S002 预算监督管理运行状态已就绪" },
      refreshTargetBindingsByVersion: {}, refreshTargetDiscoveries: {}, externalValidationRequirements: {}, externalValidationInbox: {},
      validationRetryRequests: {}, qualityIncidentsByVersion: {}, combinationIncidents: {}, formalHistory: [],
      currentFormalVersionIdsByOntology: { "ONT-S002-BUDGET-SUPERVISION": versionId }, currentFormalVersionId: versionId,
      c008ProjectionRevision: 1, c008ProjectionFormedAt: ACTUAL_FORMED_AT, c008ProjectionFault: null, serial: 1,
    };
  }

  function ensureBudgetRuntime(ownerStates, suppliedContext) {
    const context = suppliedContext || runtimeContext();
    const readiness = ownerStates ? ownerReadiness(ownerStates, context) : runtimeReadiness();
    let current = null;
    try { current = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch (_) {}
    if (!readiness.ready) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(C008_PROJECTION_KEY);
      return false;
    }
    const currentVersion = current?.publishedVersions?.find((version) => version.id === "SEM-S002-BUDGET-v1");
    const currentBinding = current?.bindingsByVersion?.[currentVersion?.id]?.current || null;
    const currentDelivery = currentVersion?.sourceDeliverySnapshot || null;
    const valid = current?.s002BusinessSeedVersion === SEED_VERSION
      && current?.activeScenarioId === context.scenarioId
      && sameScenarioContext(current?.scenarioContexts?.[context.scenarioId], context)
      && sameScenarioContext(currentVersion?.scenarioContext, context)
      && currentVersion?.metrics?.length === 9
      && currentVersion?.rules?.length === 5
      && currentVersion?.actions?.length === 6
      && currentVersion?.links?.length === 8
      && currentVersion?.resourceAliases?.["MET-007"] === "MET-S002-BUDGET-EXECUTION-RATE"
      && currentVersion?.resourceAliases?.["RULE-002"] === "RULE-S002-EXECUTION-DEVIATION"
      && currentVersion?.resourceAliases?.["ACT-EXPENSE-MANAGEMENT-OPTIMIZATION-REVIEW"] === "ACTION-S002-SUBJECT-TRANSFER"
      && currentVersion?.resourceAliases?.["ACT-SUBJECT-TRANSFER"] === "ACTION-S002-SUBJECT-TRANSFER"
      && currentVersion?.rules?.find((rule) => rule.code === "RULE-005")?.condition === RULE_SPECS.find((rule) => rule[1] === "RULE-005")?.[3]
      && currentVersion?.status === "Published"
      && exactSourceDelivery(currentDelivery, context)
      && exactC003Receipt(currentVersion?.sourceDeliveryReceiptSnapshot, context)
      && exactDataContract(currentVersion?.dataContract, currentDelivery)
      && exactVersionConsumptionContext(currentVersion?.consumptionContext, context)
      && exactBinding(currentBinding, context)
      && exactC033Receipt(current, context);
    if (valid) return true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buildSeedState(context)));
    localStorage.removeItem(C008_PROJECTION_KEY);
    return true;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function currentConsumptionProjection() {
    let current = null;
    try { current = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch (_) {}
    const version = current?.publishedVersions?.find((item) => item.id === "SEM-S002-BUDGET-v1");
    const binding = current?.bindingsByVersion?.[version?.id]?.current || null;
    const context = version?.consumptionContext || null;
    const scenarioContext = version?.scenarioContext || null;
    const contractAssets = version?.dataContract?.componentAssets || [];
    const contextAssets = context?.componentAssets || [];
    const componentAssets = contextAssets.map((asset) => ({
      ...(contractAssets.find((candidate) => candidate.assetId === asset.assetId || candidate.assetVersion === asset.version) || {}),
      ...asset,
    }));
    const sourceDelivery = version?.sourceDeliverySnapshot || null;
    const sourceReceipt = version?.sourceDeliveryReceiptSnapshot || null;
    const complete = Boolean(
      version?.status === "Published"
      && sameScenarioContext(current?.scenarioContexts?.[current?.activeScenarioId], scenarioContext)
      && exactSourceDelivery(sourceDelivery, scenarioContext)
      && exactC003Receipt(sourceReceipt, scenarioContext)
      && exactDataContract(version?.dataContract, sourceDelivery)
      && exactVersionConsumptionContext(context, scenarioContext)
      && exactBinding(binding, scenarioContext)
      && exactC033Receipt(current, scenarioContext)
      && exactComponentAssets(componentAssets, { requireSources: true, requireSnapshots: true, requirePipeline: true, requireRun: true })
    );
    return complete ? { version, binding, context, componentAssets, sourceDelivery, sourceReceipt } : null;
  }

  function projectPublishedConsumptionContext() {
    const projection = currentConsumptionProjection();
    if (projection) {
      document.querySelectorAll(".result-banner.warning, .notice.warning, .empty").forEach((node) => {
        if (/等待工作场景就绪|工作场景尚未就绪|等待新的场景轮次/.test(node.textContent || "")) node.remove();
      });
    }
    // v1.0.3 uses .published-ontology-detail for the version directory and
    // .data-consumption for the selected Published version's consumption tab.
    // The S002 projection belongs on the latter when it is present.
    const page = document.querySelector(".data-consumption") || document.querySelector(".published-ontology-detail");
    if (!projection || !page) return;
    const contextPanel = [...page.querySelectorAll(".panel")].find((panel) => panel.querySelector("h2")?.textContent?.trim() === "消费上下文完整性");
    const facts = contextPanel?.querySelector("dl.definition-grid");
    const runtime = projection.context?.scenarioContext || projection.version.scenarioContext || runtimeContext();
    const componentVersions = projection.componentAssets.map((asset) => asset.version || asset.assetVersion).filter(Boolean);
    const pipelineRuns = (projection.sourceDelivery?.runEvidence?.runs || []).map((run) => run.runId).filter(Boolean);
    const signature = `${runtime.scenarioRunId}:${projection.binding.dataVersion}:${componentVersions.join(",")}`;
    if (facts && contextPanel.dataset.s002ConsumptionContext !== signature) {
      contextPanel.dataset.s002ConsumptionContext = signature;
      facts.querySelectorAll("[data-s002-consumption-context]").forEach((node) => node.remove());
      const fragment = document.createDocumentFragment();
      const rows = [
        ["场景运行上下文", `${runtime.scenarioId} / ${runtime.scenarioVersion} / ${runtime.scenarioRunId}`],
        ["独立数据资产", componentVersions.join(" ＋ ")],
        ["预算编制与执行资产", "S002-BUDGET-EXEC-v1 · 4个成员 · 4条资产内关系 · 实际执行/预算下达/预算申报 · S002-PIPE-BUDGET-v1"],
        ["项目占用与余额资产", "S002-PROJECT-OCC-v1 · 3个成员 · 2条资产内关系 · 实际执行/预算申报/项目预算占用/项目预算使用 · S002-PIPE-PROJECT-v1"],
        ["C003兼容组合指针", `${DATA_BUNDLE_VERSION}（只引用两项资产，不作为第三项业务资产）`],
        ["逻辑数据源", "DS-ACTUAL-EXECUTION、DS-APPROVED-BUDGET、DS-INITIAL-SUBMISSION、DS-PROJECT-COMMITMENT、DS-PROJECT-USE"],
        ["8个不可变快照", "2024/2025实际、2024/2025最终批准预算、2025/2026初始申报、2025项目占用、项目使用确认快照"],
        ["来源快照组合", projection.sourceDelivery?.sourceSnapshotId || "S002-SOURCE-SNAPSHOT-v1"],
        ["正式质量回执", projection.sourceDelivery?.qualitySummary?.resultId || "S002-QUALITY-RECEIPT-v1"],
        ["组件正式运行", pipelineRuns.join(" ＋ ") || "RUN-S002-PIPE-BUDGET-v1 ＋ RUN-S002-PIPE-PROJECT-v1"],
        ["C003交付 / 接收回执", `${projection.sourceDelivery?.deliveryId || "C003-S002-DATA-v1"} / ${projection.sourceReceipt?.receiptId || "RECEIPT-C003-S002-DATA-v1"}`],
        ["目标 Draft", `${projection.sourceReceipt?.targetDraftId || "DRAFT-S002-BUDGET-v1"} · R${projection.sourceReceipt?.targetDraftRevision || 1}`],
        ["Published本体 / T019", `${projection.version.semanticVersion} / ${projection.binding.adoptionRecordId}`],
        ["资源稳定别名", "MET-001…009、RULE-001…005、ACT-* 均解析到当前 Published 资源标识"],
        ["资产关系范围", "6条资产内稳定键关系 ＋ 2条跨资产关系（实际凭证→项目、项目→预算版本）"],
        ["业务口径", "人民币（CNY）· 万元 · 费用不含税 · 收入源负号按收益展示"],
        ["消费合同", "C003接收 → C029匹配 → T018资格 → C008固定题验证 → C009兼容 → T019采用"],
        ["下游范围", "M03智能问数、M04决策提醒、M05受约束Agent、M06报告与预算驾驶舱只读消费"]
      ];
      rows.forEach(([label, value]) => {
        const term = document.createElement("dt");
        const detail = document.createElement("dd");
        term.dataset.s002ConsumptionContext = "true";
        detail.dataset.s002ConsumptionContext = "true";
        term.textContent = label;
        detail.textContent = value;
        fragment.append(term, detail);
      });
      facts.append(fragment);
    }

    const bindingPanel = [...page.querySelectorAll(".panel")].find((panel) => /正式数据|当前正式/.test(panel.querySelector("h2")?.textContent || ""));
    if (bindingPanel && !bindingPanel.querySelector("[data-s002-component-assets]")) {
      const note = document.createElement("div");
      note.className = "boundary-note";
      note.dataset.s002ComponentAssets = "true";
      note.innerHTML = `<b>当前正式组合包含 2 个独立数据资产</b><p>组合指针 <span class="mono">${DATA_BUNDLE_VERSION}</span> 仅用于跨模块精确引用，不作为第三个业务数据资产。</p><div class="mapping-contracts">${projection.componentAssets.map((asset) => {
        const memberCount = Array.isArray(asset.memberIds) ? asset.memberIds.length : (asset.version === "S002-BUDGET-EXEC-v1" ? 4 : 3);
        const internalRelations = Array.isArray(asset.internalRelationIds) ? asset.internalRelationIds.length : (asset.version === "S002-BUDGET-EXEC-v1" ? 4 : 2);
        const sources = Array.isArray(asset.sourceIds) ? asset.sourceIds.join("、") : (asset.version === "S002-BUDGET-EXEC-v1" ? "DS-ACTUAL-EXECUTION、DS-APPROVED-BUDGET、DS-INITIAL-SUBMISSION" : "DS-ACTUAL-EXECUTION、DS-INITIAL-SUBMISSION、DS-PROJECT-COMMITMENT、DS-PROJECT-USE");
        return `<article><b>${escapeHtml(asset.name || asset.assetName)}</b><span class="mono">${escapeHtml(asset.version || asset.assetVersion)}</span><small>${memberCount} 个成员 · ${internalRelations} 条资产内关系 · ${escapeHtml(asset.pipelineId || "管道待定位")}</small><small>来源：${escapeHtml(sources)}</small></article>`;
      }).join("")}</div>`;
      bindingPanel.append(note);
    }
  }

  function schedulePublishedProjection() {
    if (typeof document?.querySelector !== "function") return;
    const clearTimer = window.clearTimeout || globalThis.clearTimeout;
    const setTimer = window.setTimeout || globalThis.setTimeout;
    if (typeof clearTimer === "function") clearTimer(schedulePublishedProjection.timer);
    if (typeof setTimer === "function") schedulePublishedProjection.timer = setTimer(projectPublishedConsumptionContext, 30);
    else projectPublishedConsumptionContext();
  }

  ensureBudgetRuntime();
  if (!location.hash) history.replaceState(null, "", `${location.pathname}${location.search}#published`);
  schedulePublishedProjection();
  window.addEventListener("hashchange", schedulePublishedProjection);
  try { new MutationObserver(schedulePublishedProjection).observe(document.documentElement, { childList: true, subtree: true }); } catch (_) {}
  window.addEventListener("message", (event) => {
    if (event.origin !== location.origin || event.data?.channel !== "ofw.s002") return;
    if (event.data.type === "restore-view-context" && event.data.context) {
      window.__S002_PARENT_OWNER_STATES = event.data.ownerStates || null;
      const readiness = ownerReadiness(window.__S002_PARENT_OWNER_STATES, event.data.context);
      const url = new URL(location.href);
      const needsReload = url.searchParams.get("scenarioRunId") !== event.data.context.scenarioRunId
        || url.searchParams.get("m01Ready") !== (readiness.ready ? "1" : "0")
        || url.searchParams.get("m02AssetPublished") !== (readiness.assetPublished ? "1" : "0")
        || url.searchParams.get("m01MappingApplied") !== (readiness.mappingApplied ? "1" : "0")
        || url.searchParams.get("m01OntologyPublished") !== (readiness.ontologyPublished ? "1" : "0");
      if (needsReload && typeof location.replace === "function") {
        url.searchParams.set("scenarioId", event.data.context.scenarioId);
        url.searchParams.set("scenarioVersion", event.data.context.scenarioVersion);
        url.searchParams.set("scenarioRunId", event.data.context.scenarioRunId);
        url.searchParams.set("formedAt", event.data.context.formedAt || ACTUAL_FORMED_AT);
        url.searchParams.set("status", event.data.context.status || "active");
        url.searchParams.set("m02AssetPublished", readiness.assetPublished ? "1" : "0");
        url.searchParams.set("m01MappingApplied", readiness.mappingApplied ? "1" : "0");
        url.searchParams.set("m01OntologyPublished", readiness.ontologyPublished ? "1" : "0");
        url.searchParams.set("m01Ready", readiness.ready ? "1" : "0");
        location.replace(url.toString());
        return;
      }
      ensureBudgetRuntime(window.__S002_PARENT_OWNER_STATES, event.data.context);
      document.documentElement.dataset.s002ScenarioRunId = event.data.context.scenarioRunId || runtimeContext().scenarioRunId;
      schedulePublishedProjection();
    }
  });
})();
