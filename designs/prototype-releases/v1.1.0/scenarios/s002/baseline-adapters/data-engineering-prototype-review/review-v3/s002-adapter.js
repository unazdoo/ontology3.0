(() => {
  "use strict";

  // M02 remains the v1.0.3 data-engineering workbench. This adapter only
  // supplies S002 source/quality evidence and explicitly leaves Metric/Rule
  // semantics to M01.
  const S002 = Object.freeze({
    id: "S002",
    version: "S002-v1",
    runId: "S002-RUN-20260815160000000-9f72297443c6",
    baseline: "v1.0.3",
    dataAsOf: "2025-12-31",
  });
  const DATA_BUNDLE_VERSION = "S002-DATA-v1";
  const COMPONENT_ASSET_VERSIONS = Object.freeze(["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"]);
  const CORE = window.S002_CORE_DATA;
  if (!CORE) return;

  const SOURCE_FILES_FALLBACK = Object.freeze([
    {
      sourceId: "SRC-2024-ACTUAL", baselineSourceId: "finance-workbook", file: "2024年实际执行.xlsx",
      logicalMembers: ["Sheet"], range: "Sheet!A1:L162", version: "data_v5", asOf: "2024-12-31", rows: 161,
      purpose: "2024实际执行、年末计提", sensitivity: "内部财务中高敏感", sizeBytes: 20966,
      sha256: "5064556a172d2e91dbc33454987ae12caab2849f00a2888c6646559b50ba92a7"
    },
    {
      sourceId: "SRC-2025-ACTUAL", baselineSourceId: "finance-workbook", file: "2025年实际执行.xlsx",
      logicalMembers: ["Sheet"], range: "Sheet!A1:L204", version: "data_v5", asOf: "2025-12-31", rows: 203,
      purpose: "2025实际执行、次年确认", sensitivity: "内部财务中高敏感", sizeBytes: 23249,
      sha256: "2714661fa34651bc01332fa6f58c2f0259357385ac5ef77a2dacaae6b1eb69d2"
    },
    {
      sourceId: "SRC-2024-BUDGET", baselineSourceId: "finance-workbook", file: "2024年预算下达明细.xlsx",
      logicalMembers: ["Sheet"], range: "Sheet!A1:I31", version: "FY2024-APPROVED-FINAL-v1", asOf: "2024-01-15", rows: 30,
      purpose: "2024最终批准预算", sensitivity: "内部财务中高敏感", sizeBytes: 10929,
      sha256: "29b6a7060f504ba8c96c019e0cb9a295c734e02e6afc70f86d59d628590d3438"
    },
    {
      sourceId: "SRC-2025-BUDGET", baselineSourceId: "finance-workbook", file: "2025年预算下达明细.xlsx",
      logicalMembers: ["Sheet"], range: "Sheet!A1:I31", version: "FY2025-APPROVED-FINAL-v1", asOf: "2025-01-15", rows: 30,
      purpose: "2025最终批准预算", sensitivity: "内部财务中高敏感", sizeBytes: 11012,
      sha256: "e194594c61cb27a5c4355a6e8f75d9c463ccf1686e0def5715921eca8d137c79"
    },
    {
      sourceId: "SRC-2025-SUBMISSION", baselineSourceId: "finance-workbook", file: "2025年预算申报明细汇总.xlsx",
      logicalMembers: ["收入成本预算汇总表", "市场项目预算明细", "部门公共费用明细", "技术配置"], range: "4个逻辑成员", version: "FY2025-INITIAL-SUBMISSION-v1", asOf: "2024-10-31", rows: 64,
      purpose: "2025部门最初申报", sensitivity: "内部财务中高敏感", sizeBytes: 22622,
      sha256: "850af12aaece5fe14adb7c2609018a618e64018fc36724ff7f5f3ea3b51e441a"
    },
    {
      sourceId: "SRC-2026-SUBMISSION", baselineSourceId: "finance-workbook", file: "2026年预算申报明细汇总.xlsx",
      logicalMembers: ["收入成本预算汇总表", "市场项目预算明细", "部门公共费用明细", "技术配置"], range: "4个逻辑成员", version: "FY2026-INITIAL-SUBMISSION-v1", asOf: "2025-10-31", rows: 64,
      purpose: "2026部门最初申报", sensitivity: "内部财务中高敏感", sizeBytes: 22929,
      sha256: "85f0ce556faad8d0ef51b3bf7a5f49dc73508321d75f419db6f6bafd8427827f"
    },
    {
      sourceId: "SRC-2025-COMMITMENT", baselineSourceId: "s003-workbook", file: "2025年预算占用.XLSX",
      logicalMembers: ["Sheet"], range: "Sheet!A1:L109", version: "data_v5", asOf: "2025-12-31", rows: 108,
      purpose: "PR/PO占用及释放事件；源覆盖3个项目", sensitivity: "内部采购财务中高敏感", sizeBytes: 15900,
      sha256: "af94789f3ac8238ffd076c9006f5a29a096978ce182284efd5478994f249d20a"
    },
    {
      sourceId: "SRC-PROJECT-USE", baselineSourceId: "s003-workbook", file: "项目预算使用情况表.xlsx",
      logicalMembers: ["Sheet"], range: "Sheet!A1:D22", version: "derived-2025-12-31", asOf: "2025-12-31", rows: 21,
      purpose: "项目立项金额及源已使用值", sensitivity: "内部项目财务中高敏感", sizeBytes: 5605,
      sha256: "36bbb71e67f995ce815703528b9cb1a062df02caa4f816581369a00b7b536d1c"
    }
  ].map((item) => Object.freeze({ ...item, marker: "SOURCE", copyKind: "ORIGINAL_SOURCE_COPY" })));

  const SOURCE_FILES = Object.freeze(CORE.sourceFiles.map((item) => Object.freeze({
    ...item,
    sourceId: item.snapshotId || item.sourceId,
    logicalSourceId: item.logicalSourceId || item.sourceId,
    baselineSourceId: item.logicalSourceId || item.sourceId,
    file: item.fileName || item.file,
    sha256: item.hash || item.sha256,
    logicalMembers: item.logicalMembers || ["Sheet"],
    range: item.range || "已核验范围",
    purpose: item.scope || item.purpose,
    sensitivity: item.sensitivity || "内部财务中高敏感"
  })));

  const LOGICAL_SOURCES_FALLBACK = Object.freeze([
    {
      id: "DS-ACTUAL-EXECUTION", name: "实际执行明细", sourceType: "财务执行明细", connection: "手工工作簿",
      purpose: "形成2024/2025实际执行、计提与跨期确认事实", snapshotIds: ["SRC-2024-ACTUAL", "SRC-2025-ACTUAL"],
      baselineSourceId: "finance-workbook", pipelineId: "S002-PIPE-BUDGET-v1", assetVersion: "S002-BUDGET-EXEC-v1"
    },
    {
      id: "DS-APPROVED-BUDGET", name: "预算下达明细", sourceType: "最终批准预算", connection: "手工工作簿",
      purpose: "形成2024/2025最终批准预算；场景Action不得覆盖该来源", snapshotIds: ["SRC-2024-BUDGET", "SRC-2025-BUDGET"],
      baselineSourceId: "finance-workbook", pipelineId: "S002-PIPE-BUDGET-v1", assetVersion: "S002-BUDGET-EXEC-v1"
    },
    {
      id: "DS-INITIAL-SUBMISSION", name: "预算申报明细", sourceType: "部门初始申报", connection: "手工工作簿",
      purpose: "形成2025/2026部门最初申报及合理性评价输入", snapshotIds: ["SRC-2025-SUBMISSION", "SRC-2026-SUBMISSION"],
      baselineSourceId: "finance-workbook", pipelineId: "S002-PIPE-BUDGET-v1", assetVersion: "S002-BUDGET-EXEC-v1"
    },
    {
      id: "DS-PROJECT-COMMITMENT", name: "项目预算占用", sourceType: "采购占用事件", connection: "手工工作簿",
      purpose: "形成PR/PO占用、释放和年末集中度事实", snapshotIds: ["SRC-2025-COMMITMENT"],
      baselineSourceId: "s003-workbook", pipelineId: "S002-PIPE-PROJECT-v1", assetVersion: "S002-PROJECT-OCC-v1"
    },
    {
      id: "DS-PROJECT-USE", name: "项目预算使用表", sourceType: "项目预算余额", connection: "手工工作簿",
      purpose: "形成项目立项金额、实际、占用、计提与可用余额事实", snapshotIds: ["SRC-PROJECT-USE"],
      baselineSourceId: "s003-workbook", pipelineId: "S002-PIPE-PROJECT-v1", assetVersion: "S002-PROJECT-OCC-v1"
    }
  ].map((item) => Object.freeze({ ...item, snapshotCount: item.snapshotIds.length, sensitivity: "内部财务中高敏感" })));

  const LOGICAL_SOURCES = Object.freeze(CORE.logicalSources.map((item) => Object.freeze({
    ...item,
    pipelineId: item.pipelineId || item.pipelineIds?.[0] || "",
    assetVersion: item.assetVersion || item.assetVersions?.[0] || ""
  })));

  const ASSET_SPECS_FALLBACK = Object.freeze([
    {
      assetId: "S002-BUDGET-EXECUTION-ASSET", version: "S002-BUDGET-EXEC-v1", name: "预算编制与执行数据资产",
      memberCount: 4, relationshipCount: 4, sourceCount: 3, pipelineId: "S002-PIPE-BUDGET-v1",
      internalRelationshipCount: 3, crossAssetRelationshipCount: 1,
      purpose: "支撑预算执行、差异、初始申报、跨年趋势与单位对比"
    },
    {
      assetId: "S002-PROJECT-OCCUPANCY-ASSET", version: "S002-PROJECT-OCC-v1", name: "项目预算占用与余额数据资产",
      memberCount: 3, relationshipCount: 3, sourceCount: 2, pipelineId: "S002-PIPE-PROJECT-v1",
      internalRelationshipCount: 2, crossAssetRelationshipCount: 1,
      purpose: "支撑项目可用立项余额、净在途占用、采购集中度与供应商价格复核"
    }
  ].map(Object.freeze));

  const ASSET_SPECS = Object.freeze(CORE.assetSpecs.map(Object.freeze));

  const PIPELINE_SPECS_FALLBACK = Object.freeze([
    {
      pipelineId: "S002-PIPE-BUDGET-v1", name: "预算编制与执行标准化管道", targetAssetVersion: "S002-BUDGET-EXEC-v1",
      sourceIds: ["DS-ACTUAL-EXECUTION", "DS-APPROVED-BUDGET", "DS-INITIAL-SUBMISSION"],
      sourceFileIds: ["SRC-2024-ACTUAL", "SRC-2025-ACTUAL", "SRC-2024-BUDGET", "SRC-2025-BUDGET", "SRC-2025-SUBMISSION", "SRC-2026-SUBMISSION"],
      sourceNodeCount: 3, totalNodeCount: 7, snapshotCount: 6, logicalMemberCount: 12,
      purpose: "锁定年度预算、初始申报与实际执行快照，完成修正映射、通用质量门和数据资产发布。"
    },
    {
      pipelineId: "S002-PIPE-PROJECT-v1", name: "项目预算余额与采购占用标准化管道", targetAssetVersion: "S002-PROJECT-OCC-v1",
      sourceIds: ["DS-ACTUAL-EXECUTION", "DS-INITIAL-SUBMISSION", "DS-PROJECT-COMMITMENT", "DS-PROJECT-USE"],
      sourceFileIds: ["SRC-2024-ACTUAL", "SRC-2025-ACTUAL", "SRC-2025-SUBMISSION", "SRC-2026-SUBMISSION", "SRC-2025-COMMITMENT", "SRC-PROJECT-USE"],
      sourceNodeCount: 4, totalNodeCount: 8, snapshotCount: 6, logicalMemberCount: 12,
      purpose: "锁定实际执行、初始申报、项目占用与项目使用快照，完成稳定键校验、带符号占用标准化和数据资产发布。"
    }
  ].map(Object.freeze));

  const PIPELINE_SPECS = Object.freeze(CORE.pipelineSpecs.map(Object.freeze));

  const FILE_LOGICAL_SOURCE = Object.freeze(Object.fromEntries(
    LOGICAL_SOURCES.flatMap((source) => source.snapshotIds.map((snapshotId) => [snapshotId, source.id]))
  ));

  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

  function contextFromUrl() {
    const params = new URLSearchParams(location.search);
    return {
      id: params.get("scenarioId") || S002.id,
      version: params.get("scenarioVersion") || S002.version,
      runId: params.get("scenarioRunId") || S002.runId,
      formedAt: params.get("formedAt") || params.get("scenarioContextFormedAt") || "2026-08-15T08:00:00.000Z",
      status: params.get("status") || "active",
    };
  }

  // Read the M02 Owner projection from the current S002 run only.  The
  // baseline workbench keeps its own S001 storage key; this adapter must not
  // write to or silently reinterpret that state.  A missing/mismatched
  // envelope intentionally leaves the baseline's not-ready view untouched.
  function readJson(key) {
    try { return JSON.parse(window.localStorage.getItem(key) || "null"); } catch (_) { return null; }
  }

  function readOwnedState(context, scope = "m02", moduleId = "M02", moduleVersion = "S002-M02-1.0.0") {
    // The parent workbench may be showing an immutable historical/clone
    // checkpoint.  In that mode there is intentionally no localStorage write;
    // consume the same-origin read-only envelope delivered with the frame
    // context before falling back to the live namespaced store.
    try {
      const parentEnvelope = window.__S002_PARENT_OWNER_STATES?.[scope];
      const parentBound = parentEnvelope?.scenarioContext;
      const parentPayload = parentEnvelope?.payload;
      if (parentEnvelope?.schemaVersion === "ofw.namespaced-storage.v1"
        && parentBound?.scenarioId === context.id
        && parentBound?.scenarioVersion === context.version
        && parentBound?.scenarioRunId === context.runId
        && parentBound?.formedAt === context.formedAt
        && parentBound?.status === context.status
        && parentPayload?.moduleId === moduleId
        && parentPayload?.moduleVersion === moduleVersion) {
        return { payload: parentPayload, scenarioContext: parentBound };
      }
    } catch (_) {}
    if (["historical-readonly", "closed"].includes(context.status)) return null;
    const key = `ofw:v1.1.0:${encodeURIComponent(context.id)}:${encodeURIComponent(context.version)}:${encodeURIComponent(context.runId)}:${scope}:owned-state`;
    const envelope = readJson(key);
    const bound = envelope?.scenarioContext;
    const payload = envelope?.payload;
    if (envelope?.schemaVersion !== "ofw.namespaced-storage.v1" || !bound || !payload) return null;
    if (bound.scenarioId !== context.id || bound.scenarioVersion !== context.version || bound.scenarioRunId !== context.runId || bound.formedAt !== context.formedAt || bound.status !== context.status) return null;
    if (payload.moduleId !== moduleId || payload.moduleVersion !== moduleVersion) return null;
    return { payload, scenarioContext: bound };
  }

  function m01AdoptionProjection(context, assetVersion) {
    const record = readOwnedState(context, "m01", "M01", "S002-M01-1.0.0");
    const issues = [];
    if (!record) return { ready: false, claimPresent: false, issues: ["同轮 M01 Owner State 尚未读取"] };
    const owner = record.payload;
    const published = owner.publishedOntology || {};
    const mapping = owner.mappingVersion || {};
    const sameStringSet = (left, right) => {
      const a = [...new Set((Array.isArray(left) ? left : []).filter(Boolean))].sort();
      const b = [...new Set((Array.isArray(right) ? right : []).filter(Boolean))].sort();
      return a.length === b.length && a.every((value, index) => value === b[index]);
    };
    const sameContext = (value) => {
      const identityMatches = ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt"]
        .every((field) => value?.[field] === ({ scenarioId: context.id, scenarioVersion: context.version, scenarioRunId: context.runId, formedAt: context.formedAt })[field]);
      // 查看历史快照只改变展示语义，不改写原运行形成 C003 回执时的
      // active 状态。相同 runId/formedAt 的只读查看应继续认可原回执，
      // 但恢复或回归产生的新 runId 仍会被严格拒绝。
      const statusMatches = context.status === "historical-readonly"
        ? ["active", "historical-readonly"].includes(value?.status)
        : value?.status === context.status;
      return identityMatches && statusMatches;
    };
    if (owner.progress?.mappingApplied !== true) issues.push("M01 映射尚未完成");
    if (owner.progress?.ontologyPublished !== true) issues.push("M01 Published 尚未切换");
    if (mapping.dataAssetVersion !== assetVersion) issues.push("M01 映射未绑定当前数据资产版本");
    if (!sameStringSet(mapping.componentAssetVersions, COMPONENT_ASSET_VERSIONS)) issues.push("M01 映射未完整绑定两个独立数据资产版本");
    if (published.ontologyVersion !== "S002-ONTO-v1" || published.publishedPointer !== "T019-S002-v1") issues.push("M01 Published/T019 精确身份不匹配");
    if (published.dataAssetVersion !== assetVersion || published.status !== "published-for-scenario") issues.push("M01 Published 未引用当前数据资产版本");
    if (!sameStringSet(published.componentAssetVersions, COMPONENT_ASSET_VERSIONS)) issues.push("M01 Published 未完整引用两个独立数据资产版本");
    const receipt = owner.c003Receipt || owner.dataAssetDeliveryReceipt || null;
    const target = owner.targetDraftBinding || owner.dataAssetTargetDraftBinding || null;
    if (!receipt || receipt.sourceModule !== "本体管理" || receipt.contractCode !== "C003" || receipt.status !== "accepted" || receipt.t007Version !== assetVersion) issues.push("M01 Owner State 未提供当前版本的完整 C003 已接收回执");
    if (receipt && !sameContext(receipt.scenarioContext)) issues.push("M01 C003回执未绑定当前完整场景运行上下文");
    const receiptComponentVersions = (receipt?.componentAssets || []).map((asset) => asset.version || asset.assetVersion);
    if (receipt && !sameStringSet(receiptComponentVersions, COMPONENT_ASSET_VERSIONS)) issues.push("M01 C003回执未列明两个独立数据资产版本");
    if (!target || !target.targetDraftId || !Number.isInteger(target.targetDraftRevision) || target.targetDraftRevision < 1 || target.assetVersion !== assetVersion || (receipt && target.deliveryId !== receipt.deliveryId)) issues.push("M01 Owner State 未提供目标 Draft 对 C003 与当前版本的精确绑定");
    if (target && !sameStringSet(target.componentAssetVersions, COMPONENT_ASSET_VERSIONS)) issues.push("目标Draft未完整绑定两个独立数据资产版本");
    return {
      ready: issues.length === 0,
      claimPresent: published.publishedPointer === "T019-S002-v1",
      issues: [...new Set(issues)],
      scenarioContext: { scenarioId: context.id, scenarioVersion: context.version, scenarioRunId: context.runId, formedAt: context.formedAt, status: context.status },
      dataBundleVersion: assetVersion,
      componentAssetVersions: [...COMPONENT_ASSET_VERSIONS],
      ontologyVersion: published.ontologyVersion || null,
      publishedPointer: published.publishedPointer || null,
      c003Receipt: receipt ? { deliveryId: receipt.deliveryId, receiptId: receipt.receiptId || null, status: receipt.status, targetDraftId: receipt.targetDraftId || null, targetDraftRevision: receipt.targetDraftRevision || null } : null,
      targetDraftBinding: target ? { deliveryId: target.deliveryId, targetDraftId: target.targetDraftId, targetDraftRevision: target.targetDraftRevision } : null,
      evidenceLocator: receipt?.deliveryId ? `M01 Owner State / ${receipt.deliveryId} / T019-S002-v1` : null
    };
  }

  function historicalCompletedOwnerState(context) {
    if (!context || !["historical-readonly", "closed"].includes(context.status)) return null;
    const formedAt = context.formedAt || "2026-08-15T08:00:00.000Z";
    const sourceSnapshot = {
      snapshotId: "S002-SOURCE-SNAPSHOT-v1",
      sourceFiles: 8,
      logicalSources: 5,
      snapshotCount: 8,
      logicalMembers: 14,
      sourcePackage: "S002预算监督管理_演示加工数据候选包_v0.1.xlsx",
      sourceSha256: "a283fabf23f63506f33c5900d0f3643c82734659a890ee504d7394bdb0244599",
      formedAt,
      dataMarkerPolicy: ["SOURCE", "CORRECTED", "SYNTHETIC_FOR_DEMO", "DERIVED_REVERSAL", "DERIVED", "IMPUTED_ZERO", "MIXED_SOURCE_AND_DEMO_MARKERS"]
    };
    const qualityReceipt = {
      receiptId: "S002-QUALITY-RECEIPT-v1",
      status: "passed-for-demo",
      checksPassed: 20,
      checksTotal: 20,
      repairedIssues: { duplicateVoucherGroups: 21, periodAnomalies: 13, dateInversions: 6 },
      formedAt,
      disclaimer: "演示加工通过，不等于生产数据验收。"
    };
    const dataAssets = [
      { assetId: "S002-BUDGET-EXECUTION-ASSET", name: "预算编制与执行数据资产", version: "S002-BUDGET-EXEC-v1", asOf: "2025-12-31", status: "published-for-scenario" },
      { assetId: "S002-PROJECT-OCCUPANCY-ASSET", name: "项目预算占用与余额数据资产", version: "S002-PROJECT-OCC-v1", asOf: "2025-12-31", status: "published-for-scenario" }
    ];
    return {
      moduleId: "M02", moduleVersion: "S002-M02-1.0.0",
      progress: { dataConnected: true, qualityPassed: true, assetPublished: true },
      sourceSnapshot,
      sourceCatalog: LOGICAL_SOURCES.map((source) => ({ ...source, snapshots: source.snapshotIds.map((id) => SOURCE_FILES.find((file) => file.sourceId === id)).filter(Boolean) })),
      qualityReceipt,
      dataAssets,
      dataAsset: {
        assetId: "S002-DATA-BUNDLE", version: "S002-DATA-v1", status: "published-for-scenario",
        componentAssets: dataAssets.map((asset) => ({ assetId: asset.assetId, name: asset.name, version: asset.version, asOf: asset.asOf })),
        snapshotId: sourceSnapshot.snapshotId, asOf: "2025-12-31", currency: "CNY", unit: "万元", formedAt
      },
      pipelineDefinitions: [
        { pipelineId: "S002-PIPE-BUDGET-v1", name: "预算编制与执行标准化管道", targetAssetVersion: "S002-BUDGET-EXEC-v1" },
        { pipelineId: "S002-PIPE-PROJECT-v1", name: "项目预算余额与采购占用标准化管道", targetAssetVersion: "S002-PROJECT-OCC-v1" }
      ],
      pipelineRuns: [
        { runId: "RUN-S002-PIPE-BUDGET-v1", pipelineId: "S002-PIPE-BUDGET-v1", status: "completed", formedAt },
        { runId: "RUN-S002-PIPE-PROJECT-v1", pipelineId: "S002-PIPE-PROJECT-v1", status: "completed", formedAt }
      ]
    };
  }

  function ownerProjection(context) {
    const record = readOwnedState(context);
    const state = record?.payload;
    if (!state || state.progress?.dataConnected !== true || state.progress?.qualityPassed !== true || state.progress?.assetPublished !== true) return null;
    const snapshot = state.sourceSnapshot || {};
    const receipt = state.qualityReceipt || {};
    const bundle = state.dataAsset || {};
    const componentAssets = Array.isArray(state.dataAssets) && state.dataAssets.length
      ? state.dataAssets
      : (Array.isArray(bundle.componentAssets) ? bundle.componentAssets : []);
    const sourceCatalog = Array.isArray(state.sourceCatalog) && state.sourceCatalog.length
      ? state.sourceCatalog
      : LOGICAL_SOURCES.map((source) => ({ ...source, snapshots: source.snapshotIds.map((id) => SOURCE_FILES.find((file) => file.sourceId === id)).filter(Boolean) }));
    const pipelineDefinitions = Array.isArray(state.pipelineDefinitions) ? state.pipelineDefinitions : [];
    const pipelineRuns = Array.isArray(state.pipelineRuns) ? state.pipelineRuns : [];
    const exactValues = (actual, expected) => Array.isArray(actual) && actual.length === expected.length && actual.every((value, index) => value === expected[index]);
    const completedContract = PIPELINE_SPECS.every((spec) => {
      const definition = pipelineDefinitions.find((item) => item.pipelineId === spec.pipelineId);
      const run = pipelineRuns.find((item) => item.pipelineId === spec.pipelineId);
      const asset = componentAssets.find((item) => item.version === spec.targetAssetVersion);
      return definition?.targetAssetVersion === spec.targetAssetVersion
        && exactValues(definition?.sourceIds, spec.sourceIds)
        && run?.runId === `RUN-${spec.pipelineId}`
        && run?.targetAssetVersion === spec.targetAssetVersion
        && run?.status === "completed"
        && asset?.status === "published-for-scenario"
        && asset?.qualityReceiptId === receipt.receiptId
        && asset?.snapshotId === snapshot.snapshotId;
    });
    if (!completedContract) return null;
    const adoption = m01AdoptionProjection(context, bundle.version || "S002-DATA-v1");
    return {
      runId: context.runId,
      sourceSnapshotId: snapshot.snapshotId || "S002-SOURCE-SNAPSHOT-v1",
      sourcePackage: snapshot.sourcePackage || "S002预算监督管理_演示加工数据候选包_v0.1.xlsx",
      sourceSha256: snapshot.sourceSha256 || "a283fabf23f63506f33c5900d0f3643c82734659a890ee504d7394bdb0244599",
      sourceFiles: Number(snapshot.sourceFiles || 8),
      logicalSources: Number(snapshot.logicalSources || sourceCatalog.length || 5),
      snapshotCount: Number(snapshot.snapshotCount || sourceCatalog.reduce((sum, source) => sum + Number(source.snapshotCount || source.snapshots?.length || 0), 0) || 8),
      logicalMembers: Number(snapshot.logicalMembers || 14),
      sourceCatalog,
      pipelineDefinitions,
      pipelineRuns,
      assets: componentAssets,
      bundle,
      snapshotFormedAt: snapshot.formedAt || "2026-08-15T08:00:00.000Z",
      qualityStatus: receipt.status === "passed-for-demo" ? "质量检查通过（演示）" : (receipt.status || "质量状态已记录"),
      qualityReceiptId: receipt.receiptId || "S002-QUALITY-RECEIPT-v1",
      qualityDetail: `${Number(receipt.checksPassed || 0)}/${Number(receipt.checksTotal || 0)} 项检查通过 · 重复凭证 ${Number(receipt.repairedIssues?.duplicateVoucherGroups || 0)} 组 · 期间异常 ${Number(receipt.repairedIssues?.periodAnomalies || 0)} 条 · 日期倒置 ${Number(receipt.repairedIssues?.dateInversions || 0)} 条`,
      assetVersion: bundle.version || "S002-DATA-v1",
      assetStatus: bundle.status === "published-for-scenario" ? "组合交付已发布" : (bundle.status || "待发布"),
      asOf: bundle.asOf || S002.dataAsOf,
      currency: bundle.currency || "CNY",
      unit: bundle.unit || "万元",
      disclaimer: receipt.disclaimer || "演示加工通过，不等于生产数据验收。",
      consumptionReady: adoption.ready,
      adoptionClaimPresent: adoption.claimPresent,
      adoptionIssues: adoption.issues,
      consumptionLabel: adoption.ready ? "可消费（演示数据）" : "已发布 · 待 M01 联合证据核对",
      consumptionContext: {
        scenarioContext: adoption.scenarioContext,
        dataBundleVersion: adoption.dataBundleVersion || bundle.version || DATA_BUNDLE_VERSION,
        componentAssetVersions: adoption.componentAssetVersions || componentAssets.map((asset) => asset.version).filter(Boolean),
        ontologyVersion: adoption.ontologyVersion,
        publishedPointer: adoption.publishedPointer,
        c003Receipt: adoption.c003Receipt,
        targetDraftBinding: adoption.targetDraftBinding,
        evidenceLocator: adoption.evidenceLocator,
        asOf: bundle.asOf || S002.dataAsOf,
        currency: bundle.currency || "CNY",
        unit: bundle.unit || "万元",
        expenseBasis: "费用不含税",
        incomeSign: "源负号代表收益，展示转正",
        sourceSnapshotId: snapshot.snapshotId || "S002-SOURCE-SNAPSHOT-v1",
        qualityReceiptId: receipt.receiptId || "S002-QUALITY-RECEIPT-v1",
        pipelineRuns: pipelineRuns.map((run) => ({ runId: run.runId, pipelineId: run.pipelineId, targetAssetVersion: run.targetAssetVersion || null, status: run.status })),
        status: adoption.ready ? "ready-for-current-scenario-run" : "evidence-pending"
      }
    };
  }

  function replaceText(root, replacements) {
    if (!root) return;
    const rewrite = (value) => replacements.reduce((text, pair) => text.split(pair[0]).join(pair[1]), String(value ?? ""));
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const next = rewrite(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    });
  }

  function projectOwnerStatus(context) {
    const projection = ownerProjection(context);
    if (!projection) return;
    const root = document.querySelector(".app-shell") || document.querySelector("#app") || document.body;
    if (!root) return;

    // Keep the baseline navigation and footer, but project the actual S002
    // owner state into its existing status slots. This must run again after
    // every baseline-internal route change; the SPA replaces the main view
    // while retaining the same app shell.
    const navFoot = root.querySelector(".product-nav-foot");
    if (navFoot) {
      const spans = navFoot.querySelectorAll("span");
      if (spans[0] && spans[0].textContent !== `${projection.runId} · 已完成`) spans[0].textContent = `${projection.runId} · 已完成`;
      if (spans[1] && spans[1].textContent !== `${projection.assetVersion} · ${projection.consumptionLabel}`) spans[1].textContent = `${projection.assetVersion} · ${projection.consumptionLabel}`;
      navFoot.dataset.s002OwnerState = projection.consumptionReady ? "ready" : "published-evidence-pending";
    }

    replaceText(root, [
      ["尚无正式运行", `${projection.runId} · 已完成`],
      ["消费状态未就绪", `${projection.assetVersion} · ${projection.consumptionLabel}`],
      ["尚无质量结论", projection.qualityStatus],
      ["数据截至 无", `数据截至 ${projection.asOf}`],
      ["融资数据标准化与发布", "预算数据标准化与发布"],
      ["S001 融资语义建模", "S002 预算监督语义建模"],
      ["只保留正式运行、正式失败重试和手工同步触发记录。", "保留 S002 正式运行、质量结果和场景发布证据。"],
      ["3 个当前来源 · 5 个规划来源", "8 份已上传来源工作簿 · 14 个逻辑成员 · 5 个规划连接器"],
      ["8 份已上传来源工作簿 · 14 个逻辑成员 · 5 个规划连接器", "5 个已接入逻辑数据源 · 8 个不可变快照 · 14 个逻辑成员 · 5 个规划连接器"],
      ["内容已核验，等待受控登记。", "内容已核验并在本轮完成受控登记。"],
      ["2025-12-31 · 已确认待登记", "2025-12-31 · 本轮已登记"],
    ]);

    // Keep the baseline resource-directory structure, but make the current
    // counters and registered source rows agree with the same M02 Owner
    // projection. S002 keeps five logical sources in the directory and
    // pipeline canvas; the eight physical workbooks remain immutable
    // snapshots inside their source. Planned connectors stay unconnected.
    const sourceColumn = root.querySelector(".source-column");
    if (sourceColumn) {
      const summary = sourceColumn.querySelector(".directory-toolbar > div:last-child, .directory-toolbar .toolbar-copy");
      if (summary && /当前来源|规划来源/.test(summary.textContent || "")) summary.textContent = "5 个已接入逻辑数据源 · 8 个不可变快照 · 14 个逻辑成员 · 5 个规划连接器";
      const rows = [...sourceColumn.querySelectorAll("tbody tr")];
      rows.slice(0, 2).forEach((row) => {
        const cells = row.querySelectorAll(":scope > td");
        if (cells.length < 9) return;
        const status = cells[3].querySelector(".badge") || cells[3];
        status.textContent = "已接入";
        status.classList?.remove("neutral", "warning", "danger");
        status.classList?.add("success");
        // The logical-source table is rebuilt by projectS002LogicalSourceDirectory
        // below. Do not write a synthetic one-snapshot count into the baseline
        // group rows before the authoritative 2/2/2/1/1 projection runs.
        cells[5].textContent = projection.asOf;
        cells[7].textContent = "本轮已登记";
      });
    }

    // The resource directory's existing card/list surface is projected below
    // from the two component assets. Do not create a temporary combined asset
    // card here: it can survive beside the baseline table long enough to imply
    // that S002-DATA-v1 is a third business asset.
    const assetColumn = root.querySelector(".asset-column");
    if (assetColumn) {
      const count = assetColumn.querySelector(".resource-column-head h2 em");
      if (count) count.textContent = "2";
      const toolbar = assetColumn.querySelector(".asset-toolbar");
      if (toolbar) {
        const badgeNode = toolbar.querySelector(".badge");
        const copyNode = toolbar.querySelector(".toolbar-copy");
        if (badgeNode) {
          badgeNode.textContent = "2 个数据资产";
          badgeNode.classList.remove("neutral", "warning", "danger");
          badgeNode.classList.add("success");
        }
        if (copyNode) copyNode.textContent = "预算编制与执行、项目预算占用与余额分别发布。";
      }
    }

    // 管道目录和正式运行历史由下方的双管道投影统一负责，避免先写入
    // 单管道/单资产的过渡状态后再覆盖，造成路由切换时短暂矛盾。
    projectS002PipelineDirectory(context, projection);
    projectS002RunHistory(context, projection);

    root.dataset.s002OwnerProjection = "ready";
    root.dataset.s002OwnerRunId = projection.runId;
  }

  function adaptVisibleBaselineLabels() {
    // Keep the v1.0.3 data-engineering structure and interactions, while
    // replacing only visible fixture labels with S002 budget semantics.
    // This is display/data injection; no Metric, Rule or threshold logic is
    // added to M02.
    const replacements = [
      ["保留真实司库连接器的扩展位置，当前不提供连接或同步。", "保留财务共享和采购管理连接器的扩展位置，当前不提供连接或同步。"],
      ["计划接入账户、日期和收支金额，当前仅保留来源目录信息。", "计划接入支付、收款、过账日期、预算主体及科目关联，当前仅保留来源目录信息。"],
      ["计划接入合同、借据和余额，当前仅保留来源目录信息。", "计划接入采购申请、项目预算占用、净在途占用和占用释放记录，当前仅保留来源目录信息。"],
      ["银行账户流水", "预算支付与收款流水"],
      ["司库连接器", "预算业务连接器"],
      ["司库系统", "财务共享/采购"],
      ["融资一览表", "预算与实际凭证工作簿"],
      ["持续接收融资明细和单位负责人映射；每次上传完整工作簿形成一份新快照。", "2024/2025最终批准预算、2025/2026部门初始申报与2025实际凭证的受控输入。"],
      ["企业债务风险评估模版_S003兼容版.xlsx", "项目与采购占用_演示数据.xlsx"],
      ["企业债务风险评估模版", "项目与采购占用工作簿"],
      ["债务风险输入准备", "项目与采购占用输入准备"],
      ["验证财务数据与调节因子双成员的受控接入和不可消费版本包络。", "验证项目余额、采购占用与价格复核资料的受控接入和版本隔离。"],
      ["已取得包含财务数据和调节因子的校正工作簿；内容已核验，等待受控登记。", "已取得项目余额、采购占用与价格复核资料；内容已核验，等待受控登记。"],
      ["融资数据共享文件夹", "预算资料共享文件夹"],
      ["从固定目录取得匹配文件；当前使用手工同步，不自动轮询。", "预算工作簿与实际凭证手工同步目录；当前不自动轮询。"],
      ["融资明细", "采购占用明细"],
      ["融资数据标准化与发布", "预算数据标准化与发布"],
      ["融资工作簿标准化", "预算工作簿标准化"],
      ["finance_standardize.py", "budget_standardize.py"],
      ["将确定来源快照经受控 Python、通用质量门、资产发布和提交本体刷新请求形成完整闭环。", "将预算、实际凭证和占用输入经受控处理、质量门与资产发布形成预算可引用版本。"],
      ["融资标准化数据资产", "预算监督数据资产"],
      ["3 个当前来源 · 5 个规划来源", "5 个已接入逻辑数据源 · 8 个不可变快照 · 14 个逻辑成员 · 5 个规划连接器"],
      ["S001", "S002"],
      ["S003", "项目与采购"],
      ["企业债务", "项目预算"],
      ["债务风险", "项目与采购占用"],
      ["融资主体", "预算主体"],
      ["融资负责人", "预算负责人"],
      ["融资机构", "供应商"],
      ["金融机构", "供应商"],
      ["借据", "预算明细"],
      ["利率", "价格偏差率"],
      ["司库", "财务共享"],
      ["融资", "预算"],
      ["FIN-", "S002-BUDGET-"],
    ];
    const root = document.querySelector(".main") || document.querySelector("#app") || document.body;
    if (!root) return;
    const rewrite = (value) => {
      let text = String(value ?? "");
      replacements.forEach(([from, to]) => { text = text.split(from).join(to); });
      return text;
    };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const text = rewrite(node.nodeValue);
      if (text !== node.nodeValue) node.nodeValue = text;
    });
    root.querySelectorAll("[aria-label],[title],[placeholder]").forEach((element) => {
      ["aria-label", "title", "placeholder"].forEach((attribute) => {
        const value = element.getAttribute(attribute);
        if (value === null) return;
        const text = rewrite(value);
        if (text !== value) element.setAttribute(attribute, text);
      });
    });
    root.querySelectorAll('input:not([type]),input[type="text"],textarea').forEach((field) => {
      const value = field.value;
      const text = rewrite(value);
      if (text !== value) field.value = text;
    });
  }

  function sourceFileHref(fileName) {
    return new URL(`../../../data/source-files/${encodeURIComponent(fileName)}`, location.href).href;
  }

  function activeBaselineSourceId() {
    const match = String(location.hash || "").match(/^#\/resources\/source\/([^?]+)/);
    if (!match) return "";
    try { return decodeURIComponent(match[1]); } catch (_) { return match[1]; }
  }

  function sourceFileRow(file) {
    const href = sourceFileHref(file.file);
    const memberSummary = file.logicalMembers.join("、");
    const size = `${new Intl.NumberFormat("zh-CN").format(file.sizeBytes)} 字节`;
    return `<article class="snapshot-row" data-s002-source-file="${esc(file.sourceId)}"><div class="snapshot-file"><span class="source-icon" aria-hidden="true">↓</span><div><strong>${esc(file.file)}</strong><small>${esc(file.sourceId)} · ${esc(file.purpose)}</small></div></div><div><div class="fact"><span>版本</span><strong>${esc(file.version)}</strong></div><div class="fact"><span>数据截至</span><strong>${esc(file.asOf)}</strong></div></div><div><div class="fact"><span>登记行数</span><strong>${esc(file.rows)} 行</strong></div><div class="fact"><span>逻辑成员</span><strong>${esc(file.logicalMembers.length)} 个</strong></div></div><div class="snapshot-state"><span class="badge success">已上传</span><span class="badge info">SOURCE</span></div><details class="snapshot-evidence"><summary>查看文件身份、范围与下载</summary><div class="summary-grid"><div class="fact"><span>来源编号</span><strong>${esc(file.sourceId)}</strong></div><div class="fact"><span>来源范围</span><strong>${esc(file.range)}</strong></div><div class="fact"><span>逻辑成员</span><strong>${esc(memberSummary)}</strong></div><div class="fact"><span>敏感性</span><strong>${esc(file.sensitivity)}</strong></div><div class="fact"><span>文件大小</span><strong>${esc(size)}</strong></div><div class="fact"><span>副本类型</span><strong>ORIGINAL_SOURCE_COPY</strong></div><div class="fact"><span>SHA-256</span><strong class="mono">${esc(file.sha256)}</strong></div><div class="fact"><span>核验日期</span><strong>2026-08-15</strong></div></div><div class="button-row"><a class="btn primary" data-s002-source-download="${esc(file.sourceId)}" href="${esc(href)}" download="${esc(file.file)}">下载来源工作簿</a></div><p class="section-note">逐字节原始来源副本；下载不会登记快照、重跑管道或改变质量、资产及消费状态。CORRECTED、SYNTHETIC_FOR_DEMO 等运行加工结果不会写回本文件。</p></details></article>`;
  }

  function projectSourceDownloadSummary() {
    // v1.0.3 的数据源目录已经通过卡片/列表呈现来源数量与状态。
    // S002 不再在目录工具栏下重复插入第二份来源清单；逐快照查看和
    // 下载继续保留在每个逻辑数据源的基线详情页中。
    document.querySelectorAll("[data-s002-source-download-summary]").forEach((node) => node.remove());
  }

  function projectSourceFileCatalog() {
    const page = document.querySelector('[data-screen-label="数据源详情"]');
    const baselineSourceId = activeBaselineSourceId();
    if (!page || !baselineSourceId) return;
    const files = SOURCE_FILES.filter((item) => item.baselineSourceId === baselineSourceId);
    if (!files.length) return;
    const existing = page.querySelector("[data-s002-source-file-catalog]");
    if (existing?.dataset.s002SourceFileCatalog === baselineSourceId) return;
    existing?.remove();
    const panel = document.createElement("section");
    panel.className = "panel";
    panel.dataset.s002SourceFileCatalog = baselineSourceId;
    panel.innerHTML = `<div class="panel-head"><div><span class="panel-title">已上传来源文件</span><p>沿用数据源详情页查看文件身份、业务范围与下载副本；不把下载解释为新快照或正式运行。</p></div><span class="badge success">${files.length} 份可下载</span></div><div class="panel-body"><div class="notice info"><strong>来源副本边界</strong><span>文件名、行数、数据截至和 SHA-256 与 source-manifest 一致；全部标记 SOURCE / ORIGINAL_SOURCE_COPY。</span></div><div class="snapshot-history">${files.map(sourceFileRow).join("")}</div></div>`;
    const hero = page.querySelector(".detail-hero");
    if (hero) hero.insertAdjacentElement("afterend", panel);
    else page.append(panel);
  }

  function setProjectedText(node, value) {
    if (!node) return;
    const next = String(value ?? "");
    if ((node.textContent || "").trim() !== next) node.textContent = next;
  }

  function setProjectedTone(node, value, tone = "success") {
    if (!node) return;
    setProjectedText(node, value);
    node.classList.remove("plain", "neutral", "info", "warning", "danger", "success");
    node.classList.add("badge", tone);
  }

  function panelByTitle(page, title) {
    return [...(page?.querySelectorAll(".panel") || [])]
      .find((panel) => panel.querySelector(".panel-title")?.textContent?.trim() === title) || null;
  }

  function setProjectedFact(scope, label, value, nextLabel = label) {
    const fact = [...(scope?.querySelectorAll(".fact") || [])]
      .find((item) => item.querySelector("span")?.textContent?.trim() === label);
    if (!fact) return;
    setProjectedText(fact.querySelector("span"), nextLabel);
    setProjectedText(fact.querySelector("strong"), value);
  }

  function projectCompletedSourceDetail(context) {
    const projection = ownerProjection(context);
    const page = document.querySelector('[data-screen-label="数据源详情"]');
    const baselineSourceId = activeBaselineSourceId();
    if (!projection || !page || baselineSourceId !== "s003-workbook") return;

    const files = SOURCE_FILES.filter((item) => item.baselineSourceId === baselineSourceId);
    const tab = new URLSearchParams(String(location.hash || "").split("?")[1] || "").get("tab") || "overview";
    const projectionKey = `${context.runId}:${tab}:${projection.assetVersion}`;
    if (page.dataset.s002CompletedSourceDetail === projectionKey) return;

    const hero = page.querySelector(".detail-hero");
    setProjectedText(hero?.querySelector("h2"), "本轮快照已确认 · 可运行");
    setProjectedText(hero?.querySelector("p"), `${files.length} 份项目与采购来源已登记为 ${projection.sourceSnapshotId} 的受控输入，并锁定本轮正式运行。`);
    setProjectedFact(hero, "快照总数", "1 个");
    setProjectedFact(hero, "当前数据截至", projection.asOf);

    page.querySelectorAll('[data-action="revision-evidence"] span').forEach((node) => setProjectedText(node, "查看来源身份与登记证据"));
    page.querySelectorAll('[data-action="quality-evidence"] span').forEach((node) => setProjectedText(node, "查看质量与发布证据"));

    if (tab === "overview") {
      const sourcePanel = panelByTitle(page, "来源状态");
      if (sourcePanel) {
        setProjectedTone(sourcePanel.querySelector(".panel-head > .badge"), "本轮快照已确认 · 可运行", "success");
        setProjectedFact(sourcePanel, "快照", "1 个");
        setProjectedFact(sourcePanel, "当前核验文件", "项目与采购来源包（2份工作簿）", "当前文件");
        setProjectedFact(sourcePanel, "数据截至", projection.asOf);
        const notice = sourcePanel.querySelector(".notice");
        if (notice) {
          notice.classList.remove("warning", "danger");
          notice.classList.add("success");
          setProjectedText(notice, `本轮 2 份来源工作簿已作为 ${projection.sourceSnapshotId} 的受控输入保留；新文件会形成新快照，不覆盖当前或历史证据。`);
        }
      }

      const compatibility = panelByTitle(page, "来源核验状态");
      if (compatibility) {
        setProjectedText(compatibility.querySelector(".panel-head p"), "内容、结构、受控登记、正式运行、发布与消费状态");
        setProjectedTone(compatibility.querySelector(".panel-head > .badge"), projection.consumptionLabel, projection.consumptionReady ? "success" : "warning");
        setProjectedFact(compatibility, "权威阶段", "S002 正式运行与资产发布");
        setProjectedFact(compatibility, "数据工程内部状态", `已登记 · ${projection.qualityStatus} · ${projection.assetVersion}`);
        setProjectedFact(compatibility, "合同结构", "已绑定 S002 双业务数据资产");
        setProjectedFact(compatibility, "下一责任方", projection.consumptionReady ? "平台消费入口" : "本体管理联合证据核对");
        const lanes = compatibility.querySelectorAll(".status-lanes > div");
        const laneValues = [
          ["已绑定", "来源结构", "采购占用与项目余额分别保留为独立来源文件和稳定逻辑成员。", "success"],
          ["已确认", "文件内容", "业务时点、人民币万元单位、来源范围和逐文件 SHA-256 已确认。", "success"],
          ["已完成", "受控登记与处理", `4 个逻辑源 / 6 个快照已纳入 S002-PIPE-PROJECT-v1；${projection.qualityStatus}。`, "success"],
          [projection.consumptionReady ? "可消费" : "待核对", "当前消费状态", `S002-PROJECT-OCC-v1 已发布；${projection.consumptionLabel}。`, projection.consumptionReady ? "success" : "warning"]
        ];
        lanes.forEach((lane, index) => {
          const values = laneValues[index];
          if (!values) return;
          setProjectedTone(lane.querySelector(".badge"), values[0], values[3]);
          setProjectedText(lane.querySelector("strong"), values[1]);
          setProjectedText(lane.querySelector("span:last-child"), values[2]);
        });
        const notice = compatibility.querySelector(".notice");
        if (notice) {
          notice.classList.remove("warning", "danger");
          notice.classList.add(projection.consumptionReady ? "success" : "info");
          setProjectedText(notice, `当前来源已完成受控登记、正式运行、20/20 质量检查和 S002-PROJECT-OCC-v1 发布；所有演示加工标识继续保留，不代表生产数据验收。`);
        }
      }
    }

    if (tab === "content") {
      const panel = [...page.querySelectorAll(".panel")].find((item) => !item.dataset.s002SourceFileCatalog);
      if (panel) {
        panel.dataset.s002CompletedContent = projection.sourceSnapshotId;
        panel.querySelector(".panel-head").innerHTML = `<div><span class="panel-title">本轮快照内容与逻辑成员</span><p>按来源文件查看稳定成员、来源范围、登记行数和精确版本。</p></div><span class="badge info">${files.length} 份工作簿 · ${files.reduce((sum, file) => sum + file.logicalMembers.length, 0)} 个成员</span>`;
        panel.querySelector(".panel-body").innerHTML = `<div class="notice success"><strong>受控内容已锁定</strong><span>${esc(projection.sourceSnapshotId)} · ${esc(projection.runId)} · 数据截至 ${esc(projection.asOf)}</span></div><div class="resource-table-frame"><div class="resource-table-wrap"><table class="resource-table"><thead><tr><th>来源文件</th><th>稳定来源编号</th><th>逻辑成员</th><th>来源范围</th><th>登记行数</th><th>版本</th><th>标识</th></tr></thead><tbody>${files.map((file) => `<tr><td><strong>${esc(file.file)}</strong></td><td class="mono">${esc(file.sourceId)}</td><td>${esc(file.logicalMembers.join("、"))}</td><td>${esc(file.range)}</td><td>${esc(file.rows)} 行</td><td>${esc(file.version)}</td><td><span class="badge info">SOURCE</span></td></tr>`).join("")}</tbody></table></div></div><p class="section-note">下载副本保持逐字节原始内容；CORRECTED、SYNTHETIC_FOR_DEMO 和 DERIVED 仅存在于后续受控数据资产，不写回来源文件。</p>`;
      }
    }

    if (tab === "snapshots") {
      const panel = panelByTitle(page, "快照历史");
      if (panel) {
        panel.dataset.s002CompletedSnapshot = projection.sourceSnapshotId;
        setProjectedText(panel.querySelector(".panel-head p"), "当前来源分组随全场景受控快照锁定；新快照不会覆盖历史记录。");
        setProjectedTone(panel.querySelector(".panel-head .badge"), "1 个快照", "info");
        panel.querySelector(".panel-body").innerHTML = `<div class="snapshot-history"><article class="snapshot-row"><div class="snapshot-file"><span class="source-icon" aria-hidden="true">✓</span><div><strong>项目与采购来源包（2份工作簿）</strong><small>${esc(projection.sourceSnapshotId)} · 全场景 ${esc(projection.sourceFiles)} 份来源 / ${esc(projection.logicalMembers)} 个逻辑成员</small></div></div><div><div class="fact"><span>锁定时间</span><strong>2026-08-15 16:00:00</strong></div><div class="fact"><span>数据截至</span><strong>${esc(projection.asOf)}</strong></div></div><div><div class="fact"><span>本分组文件</span><strong>${files.length} 份</strong></div><div class="fact"><span>本分组成员</span><strong>${files.reduce((sum, file) => sum + file.logicalMembers.length, 0)} 个</strong></div></div><div class="snapshot-state"><span class="badge info">本轮已选择</span><span class="badge success">${esc(projection.qualityStatus)}</span></div><details class="snapshot-evidence"><summary>查看快照身份与运行依据</summary><div class="summary-grid"><div class="fact"><span>来源快照标识</span><strong>${esc(projection.sourceSnapshotId)}</strong></div><div class="fact"><span>来源包</span><strong>${esc(projection.sourcePackage)}</strong></div><div class="fact"><span>来源包 SHA-256</span><strong class="mono">${esc(projection.sourceSha256)}</strong></div><div class="fact"><span>正式运行</span><strong>${esc(projection.runId)}</strong></div><div class="fact"><span>数据资产版本</span><strong>${esc(projection.assetVersion)}</strong></div><div class="fact"><span>消费状态</span><strong>${esc(projection.consumptionLabel)}</strong></div></div></details></article></div><div class="notice info"><strong>不可变历史</strong><span>本快照只读保留；恢复、回归或重置均创建新的 scenarioRunId 和隔离命名空间。</span></div>`;
      }
    }

    if (tab === "references") {
      const pipelinePanel = panelByTitle(page, "当前管道引用");
      if (pipelinePanel) {
        setProjectedTone(pipelinePanel.querySelector(".panel-head .badge"), "1 条", "info");
        pipelinePanel.querySelector(".panel-body").innerHTML = `<div class="reference-row"><div><strong>项目预算余额与采购占用标准化管道</strong><p>S002-PIPE-PROJECT-v1 · 4 个逻辑源 / 6 个快照</p></div><div><div class="fact"><span>最近正式运行</span><strong>RUN-S002-PIPE-PROJECT-v1 · 已完成</strong></div></div><a class="text-link" href="${s002PipelineCanvasHref("S002-PIPE-PROJECT-v1")}">进入管道画布</a></div>`;
      }
      const assetPanel = panelByTitle(page, "下游已发布资产");
      if (assetPanel) {
        setProjectedTone(assetPanel.querySelector(".panel-head .badge"), "1 个版本", "success");
        assetPanel.querySelector(".panel-body").innerHTML = `<div class="reference-row"><div><strong>项目预算占用与余额数据资产</strong><p>S002-PROJECT-OCC-v1 · 已发布 · ${esc(projection.qualityStatus)}</p></div><div><div class="fact"><span>消费状态</span><strong>${esc(projection.consumptionLabel)}</strong></div></div><a class="text-link" href="#/resources/asset/s002-project-occupancy-asset?tab=lineage">查看沿袭</a></div>`;
      }
    }

    page.dataset.s002CompletedSourceDetail = projectionKey;
  }

  function projectCompletedSourceModal(context) {
    const projection = ownerProjection(context);
    if (!projection || activeBaselineSourceId() !== "s003-workbook") return;
    const modal = document.querySelector('.modal[role="dialog"]');
    const title = modal?.querySelector("header h2");
    const body = modal?.querySelector(".modal-body");
    if (!modal || !title || !body) return;
    const files = SOURCE_FILES.filter((item) => item.baselineSourceId === "s003-workbook");
    const originalTitle = title.textContent?.trim() || "";
    if (originalTitle === "工作簿修订证据" && modal.dataset.s002CompletedModal !== "identity") {
      setProjectedText(title, "来源文件身份与登记证据");
      setProjectedText(modal.querySelector("header p"), "逐文件身份、原始副本和受控快照登记证据");
      body.innerHTML = `<div class="quality-section"><div class="quality-section-head"><strong>2 份来源文件已锁定</strong><span class="badge success">已登记</span></div>${files.map((file) => `<div class="check-row"><div><strong>${esc(file.file)}</strong><p>${esc(file.sourceId)} · ${esc(file.range)} · ${esc(file.sizeBytes)} 字节</p></div><span class="badge success">SOURCE</span><small class="mono">${esc(file.sha256)}</small></div>`).join("")}</div><div class="summary-grid"><div class="fact"><span>来源快照</span><strong>${esc(projection.sourceSnapshotId)}</strong></div><div class="fact"><span>正式运行</span><strong>${esc(projection.runId)}</strong></div><div class="fact"><span>数据资产</span><strong>${esc(projection.assetVersion)}</strong></div><div class="fact"><span>登记日期</span><strong>2026-08-15</strong></div></div><div class="notice info"><strong>原始副本边界</strong><span>文件卡下载的是逐字节原始来源副本；任何演示修正和补数都不会写回来源文件。</span></div>`;
      modal.dataset.s002CompletedModal = "identity";
    }
    if (originalTitle === "来源内容核验" && modal.dataset.s002CompletedModal !== "quality") {
      setProjectedText(title, "来源内容、质量与发布证据");
      setProjectedText(modal.querySelector("header p"), "当前结果覆盖受控来源、正式运行、20/20 质量检查和数据资产发布");
      body.innerHTML = `<div class="quality-section"><div class="quality-section-head"><strong>项目与采购来源处理已完成</strong><span class="badge success">${esc(projection.qualityStatus)}</span></div>${[["稳定来源身份",`${files.length} 份文件 · ${files.map((file) => file.sourceId).join("、")}`],["正式管道处理","S002-PIPE-PROJECT-v1 · RUN-S002-PIPE-PROJECT-v1"],["正式质量结论",projection.qualityDetail],["数据资产版本","S002-PROJECT-OCC-v1 · 已发布"],["本体采用与消费",projection.consumptionLabel]].map((item) => `<div class="check-row"><div><strong>${esc(item[0])}</strong><p>${esc(item[1])}</p></div><span class="badge success">已完成</span></div>`).join("")}</div><div class="notice info"><strong>演示边界</strong><span>${esc(projection.disclaimer)} 不自动审批、过账、反写外部预算系统或覆盖最终批准预算。</span></div>`;
      modal.dataset.s002CompletedModal = "quality";
    }
  }

  function sourceFileFor(sourceId) {
    return SOURCE_FILES.find((file) => file.sourceId === sourceId) || null;
  }

  function logicalSourceFor(sourceId) {
    return LOGICAL_SOURCES.find((source) => source.id === sourceId) || null;
  }

  function logicalSourceForFile(sourceId) {
    return logicalSourceFor(FILE_LOGICAL_SOURCE[sourceId] || "") || null;
  }

  function filesForLogicalSource(source) {
    return (source?.snapshotIds || []).map(sourceFileFor).filter(Boolean);
  }

  function activeLogicalSourceId() {
    const match = String(location.hash || "").match(/\?([^#]*)/);
    if (!match) return "";
    return new URLSearchParams(match[1]).get("s002LogicalSource") || "";
  }

  function activeS002PipelineId() {
    const match = String(location.hash || "").match(/\?([^#]*)/);
    if (!match) return "S002-PIPE-BUDGET-v1";
    return new URLSearchParams(match[1]).get("s002Pipeline") || "S002-PIPE-BUDGET-v1";
  }

  function s002PipelineSpec(id) {
    return PIPELINE_SPECS.find((pipeline) => pipeline.pipelineId === id) || PIPELINE_SPECS[0];
  }

  function s002PipelineCanvasHref(id) {
    const pipelineId = s002PipelineSpec(id).pipelineId;
    return `#/pipelines/${encodeURIComponent(pipelineId)}/canvas?s002Pipeline=${encodeURIComponent(pipelineId)}`;
  }

  function assetSpecForVersion(version) {
    return ASSET_SPECS.find((asset) => asset.version === version) || ASSET_SPECS[0];
  }

  function s002PipelineRun(projection, pipelineId) {
    return (projection?.pipelineRuns || []).find((run) => run.pipelineId === pipelineId) || null;
  }

  function setText(scope, selector, value) {
    const node = scope?.querySelector(selector);
    if (node && String(node.textContent || "").trim() !== String(value ?? "")) node.textContent = String(value ?? "");
    return node;
  }

  function setFactIn(scope, label, value, nextLabel = label) {
    const fact = [...(scope?.querySelectorAll(".fact") || [])]
      .find((item) => item.querySelector("span")?.textContent?.trim() === label);
    if (!fact) return;
    setText(fact, "span", nextLabel);
    setText(fact, "strong", value);
  }

  function sourceDirectoryRow(source, projection) {
    const files = filesForLogicalSource(source);
    const latest = files.map((file) => file.asOf).sort().at(-1) || "2025-12-31";
    const registered = Boolean(projection);
    const stateLabel = registered ? "已接入" : "文件已准备";
    const stateTone = registered ? "success" : "info";
    const href = `#/resources/source/${source.baselineSourceId}?tab=overview&s002LogicalSource=${encodeURIComponent(source.id)}`;
    return `<tr data-s002-logical-source-id="${esc(source.id)}"><td><div class="table-resource-name"><span class="source-icon"><span class="icon" aria-hidden="true">↓</span></span><div><strong>${esc(source.name)}</strong><small>${esc(source.purpose)} · ${files.length} 个快照</small></div></div></td><td>${esc(source.sourceType)}</td><td>${esc(source.connection)}</td><td title="${esc(registered ? "已登记并绑定当前场景运行" : "原始来源副本已准备，可在详情中查看和下载")}"><span class="badge ${stateTone}">${stateLabel}</span></td><td class="numeric">${files.length}</td><td>${esc(latest)}</td><td>按需上传新快照</td><td>${registered ? "2026-08-15 · 已登记" : "2026-08-15 · 原始副本"}</td><td><a class="text-link" href="${href}">查看详情 <span class="icon" aria-hidden="true">›</span></a></td></tr>`;
  }

  function sourceDirectoryCard(source, projection) {
    const files = filesForLogicalSource(source);
    const latest = files.map((file) => file.asOf).sort().at(-1) || S002.dataAsOf;
    const registered = Boolean(projection);
    const stateLabel = registered ? "已接入" : "文件已准备";
    const stateTone = registered ? "success" : "info";
    const href = `#/resources/source/${source.baselineSourceId}?tab=overview&s002LogicalSource=${encodeURIComponent(source.id)}`;
    return `<article class="source-card" data-s002-logical-source-id="${esc(source.id)}"><div class="source-card-head"><span class="source-icon" aria-hidden="true">↓</span><div><h3>${esc(source.name)}</h3><p>${esc(source.purpose)}</p></div><span title="${esc(registered ? "已登记并绑定当前场景运行" : "原始来源副本已准备")}"><span class="badge ${stateTone}">${stateLabel}</span></span></div><div class="source-card-facts"><div class="fact"><span>接入方式</span><strong>${esc(source.connection)}</strong></div><div class="fact"><span>快照</span><strong>${files.length} 个</strong></div><div class="fact"><span>数据截至</span><strong>${esc(latest)}</strong></div><div class="fact"><span>同步计划</span><strong>按需上传新快照</strong></div></div><div class="card-foot"><span>${esc(source.sourceType)} · ${files.reduce((sum, file) => sum + file.logicalMembers.length, 0)} 个逻辑成员</span><a class="text-link" href="${href}">查看详情 <span class="icon" aria-hidden="true">›</span></a></div></article>`;
  }

  function sourceDirectoryCardGroup(label, description, sources, projection) {
    if (!sources.length) return "";
    return `<section class="source-group" data-s002-logical-source-group="${esc(label)}"><div class="source-group-head"><span class="group-arrow" aria-hidden="true">⌄</span><span class="group-copy"><strong>${esc(label)}</strong><small>${esc(description)}</small></span><span class="group-summary">${sources.length} 个来源</span><span class="badge success">可用</span></div><div class="source-card-grid">${sources.map((source) => sourceDirectoryCard(source, projection)).join("")}</div></section>`;
  }

  function projectS002LogicalSourceDirectory(context, projection) {
    const sourceColumn = document.querySelector(".source-column");
    const table = sourceColumn?.querySelector(".source-resource-table");
    const tbody = table?.querySelector("tbody");
    const cardGroups = sourceColumn?.querySelector(".source-groups");
    if (!sourceColumn || (!tbody && !cardGroups)) return;
    const search = String(sourceColumn.querySelector("#resource-search")?.value || "").trim().toLowerCase();
    const logicalSources = LOGICAL_SOURCES.filter((source) => {
      if (!search) return true;
      const text = `${source.id} ${source.name} ${source.sourceType} ${source.purpose}`.toLowerCase();
      return text.includes(search) || filesForLogicalSource(source).some((file) => file.file.toLowerCase().includes(search));
    });
    const view = tbody ? "list" : "cards";
    const signature = `${context.runId}:${projection?.sourceSnapshotId || "prepared"}:${view}:${search}:${logicalSources.map((source) => source.id).join(",")}`;
    if (tbody && tbody.dataset.s002LogicalSourceSignature !== signature) {
      const plannedRows = [...tbody.querySelectorAll("tr.planned")].map((row) => row.outerHTML).join("");
      tbody.innerHTML = logicalSources.length
        ? `${logicalSources.map((source) => sourceDirectoryRow(source, projection)).join("")}${plannedRows}`
        : `<tr><td colspan="9"><div class="empty-state"><strong>没有匹配的逻辑数据源</strong><span>可按数据源名称、文件、用途或状态搜索。</span></div></td></tr>${plannedRows}`;
      tbody.dataset.s002LogicalSourceSignature = signature;
    }
    if (cardGroups && cardGroups.dataset.s002LogicalSourceSignature !== signature) {
      const plannedSections = [...cardGroups.querySelectorAll(":scope > .source-group")]
        .filter((section) => section.querySelector(".source-card.planned"))
        .map((section) => section.outerHTML).join("");
      const budgetSources = logicalSources.filter((source) => source.assetVersion === "S002-BUDGET-EXEC-v1");
      const projectSources = logicalSources.filter((source) => source.assetVersion === "S002-PROJECT-OCC-v1");
      const currentSections = [
        sourceDirectoryCardGroup("预算编制与执行", "实际执行、最终批准预算和部门初始申报按年度形成不可变快照。", budgetSources, projection),
        sourceDirectoryCardGroup("项目与采购", "项目预算占用和项目预算使用分别作为独立来源。", projectSources, projection)
      ].join("");
      cardGroups.innerHTML = currentSections || `<div class="empty-state"><strong>没有匹配的逻辑数据源</strong><span>可按数据源名称、文件、用途或状态搜索。</span></div>`;
      cardGroups.insertAdjacentHTML("beforeend", plannedSections);
      cardGroups.dataset.s002LogicalSourceSignature = signature;
    }
    const count = sourceColumn.querySelector(".resource-column-head h2 em");
    if (count) count.textContent = "5";
    // 保留 v1.0.3 数据源目录工具栏原文和结构。数量、快照与成员信息
    // 已经分别出现在目录行和详情页，不再追加或改写第二份汇总清单。
    sourceColumn.querySelectorAll("[data-s002-source-directory-summary]").forEach((node) => {
      delete node.dataset.s002SourceDirectorySummary;
    });
    projectSourceDownloadSummary();
  }

  function logicalSourceCatalogPanel(source, files) {
    const pipeline = s002PipelineSpec(source.pipelineId);
    return `<section class="panel" data-s002-logical-source-catalog="${esc(source.id)}"><div class="panel-head"><div><span class="panel-title">已上传来源快照</span><p>按逻辑数据源查看每个年度/确认快照；文件下载为只读操作，不改变Owner状态。</p></div><span class="badge success">${files.length} 个快照 · ${files.length} 份文件</span></div><div class="panel-body"><div class="notice info"><strong>${esc(source.name)} · ${esc(source.id)}</strong><span>${esc(source.purpose)} · 绑定 ${esc(pipeline.pipelineId)} → ${esc(assetSpecForVersion(source.assetVersion).version)}</span></div><div class="snapshot-history">${files.map((file) => sourceFileRow(file)).join("")}</div></div></section>`;
  }

  function projectS002LogicalSourceDetail(context, projection) {
    const page = document.querySelector('[data-screen-label="数据源详情"]');
    const source = logicalSourceFor(activeLogicalSourceId());
    if (!page || !source) return;
    const files = filesForLogicalSource(source);
    const signature = `${context.runId}:${source.id}:${String(location.hash || "")}:${projection?.assetVersion || "prepared"}`;
    if (page.dataset.s002LogicalSourceDetail === signature) return;
    page.dataset.s002LogicalSourceDetail = signature;
    page.querySelectorAll("[data-s002-source-file-catalog]").forEach((node) => node.remove());
    setText(page, ".page-header h1", source.name);
    setText(page, ".page-header p", `${source.purpose} · ${source.snapshotIds.length} 个不可变快照 · ${source.sourceType}`);
    const hero = page.querySelector(".detail-hero");
    setText(hero, "h2", projection ? `${files.length} 个快照已锁定 · 可运行` : `${files.length} 个原始快照已准备`);
    setText(hero, ".detail-hero > div:first-child p", files.map((file) => `${file.file}（${file.asOf}）`).join("；"));
    setFactIn(hero, "最近取得", "2026-08-15 · 已登记");
    setFactIn(hero, "当前数据截至", files.map((file) => file.asOf).sort().at(-1) || S002.dataAsOf);
    setFactIn(hero, "快照总数", `${files.length} 个`);
    const catalog = document.createRange().createContextualFragment(logicalSourceCatalogPanel(source, files));
    hero?.insertAdjacentElement("afterend", catalog.firstElementChild);

    const tab = new URLSearchParams(String(location.hash || "").split("?")[1] || "").get("tab") || "overview";
    const grid = page.querySelector(".detail-grid");
    const tabPanel = page.querySelector(".tabs + .panel");
    if (!grid && !tabPanel) return;
    if (tab === "overview") {
      if (!grid) return;
      grid.innerHTML = `<div class="stack"><section class="panel"><div class="panel-head"><span class="panel-title">来源状态</span><span class="badge success">${projection ? "已接入 · 本轮已锁定" : "已上传 · 待本轮登记"}</span></div><div class="panel-body"><div class="summary-grid"><div class="fact"><span>逻辑数据源</span><strong>${esc(source.id)}</strong></div><div class="fact"><span>来源类型</span><strong>${esc(source.sourceType)}</strong></div><div class="fact"><span>接入方式</span><strong>${esc(source.connection)}</strong></div><div class="fact"><span>快照</span><strong>${files.length} 个</strong></div><div class="fact"><span>逻辑成员</span><strong>${files.reduce((sum, file) => sum + file.logicalMembers.length, 0)} 个</strong></div><div class="fact"><span>数据截至</span><strong>${esc(files.map((file) => file.asOf).sort().at(-1) || S002.dataAsOf)}</strong></div></div><div class="notice ${projection ? "success" : "info"}"><strong>${projection ? "本轮输入已锁定" : "原始来源副本已准备"}</strong><span>${projection ? `已绑定 ${esc(source.pipelineId)}，后续质量与发布结果由Owner State提供。` : "查看或下载不会形成快照、运行或资产发布。"}</span></div></div></section></div><aside class="stack"><section class="panel"><div class="panel-head"><span class="panel-title">来源同步计划</span><span class="badge neutral">按需上传新快照</span></div><div class="panel-body"><div class="plan-grid"><div class="fact"><span>当前模式</span><strong>按需上传新快照</strong></div><div class="fact"><span>绑定管道</span><strong>${esc(source.pipelineId)}</strong></div><div class="fact"><span>目标资产</span><strong>${esc(assetSpecForVersion(source.assetVersion).version)}</strong></div><div class="fact"><span>最近结果</span><strong>${projection ? "已完成" : "待登记"}</strong></div></div><p class="section-note">来源同步只负责取得文件、内容去重和形成快照，不代表指标、Rule 或业务Action。</p></div></section></aside></div>`;
    } else if (tab === "content") {
      const contentHtml = `<section class="panel"><div class="panel-head"><div><span class="panel-title">快照内容与逻辑成员</span><p>每个文件保留来源范围、成员、行数和数据标识。</p></div><span class="badge info">${files.reduce((sum, file) => sum + file.logicalMembers.length, 0)} 个成员</span></div><div class="panel-body"><div class="resource-table-frame"><div class="resource-table-wrap"><table class="resource-table"><thead><tr><th>快照文件</th><th>快照时点</th><th>逻辑成员</th><th>来源范围</th><th>行数</th><th>版本</th><th>标识</th></tr></thead><tbody>${files.map((file) => `<tr><td><strong>${esc(file.file)}</strong></td><td>${esc(file.asOf)}</td><td>${esc(file.logicalMembers.join("、"))}</td><td>${esc(file.range)}</td><td>${file.rows} 行</td><td>${esc(file.version)}</td><td><span class="badge info">SOURCE</span></td></tr>`).join("")}</tbody></table></div></div></div></section>`;
      if (tabPanel) tabPanel.outerHTML = contentHtml;
    } else if (tab === "snapshots") {
      const snapshotHtml = `<section class="panel"><div class="panel-head"><div><span class="panel-title">快照历史</span><p>历史快照只读保留；恢复、回归或重置创建新的scenarioRunId。</p></div><span class="badge info">${files.length} 个快照</span></div><div class="panel-body"><div class="snapshot-history">${files.map((file) => `<article class="snapshot-row"><div class="snapshot-file"><span class="source-icon" aria-hidden="true">✓</span><div><strong>${esc(file.file)}</strong><small>${esc(file.sourceId)} · ${esc(file.version)}</small></div></div><div><div class="fact"><span>业务时点</span><strong>${esc(file.asOf)}</strong></div><div class="fact"><span>登记行数</span><strong>${file.rows} 行</strong></div></div><div><div class="fact"><span>逻辑成员</span><strong>${file.logicalMembers.length} 个</strong></div><div class="fact"><span>副本类型</span><strong>ORIGINAL_SOURCE_COPY</strong></div></div><div class="snapshot-state"><span class="badge success">SOURCE</span><a class="btn soft" href="${esc(sourceFileHref(file.file))}" download="${esc(file.file)}">下载</a></div></article>`).join("")}</div></div></section>`;
      if (tabPanel) tabPanel.outerHTML = snapshotHtml;
    } else if (tab === "references") {
      const asset = assetSpecForVersion(source.assetVersion);
      const referencesHtml = `<section class="panel"><div class="panel-head"><span class="panel-title">当前管道引用</span><span class="badge info">1 条</span></div><div class="panel-body"><div class="reference-row"><div><strong>${esc(PIPELINE_SPECS.find((item) => item.pipelineId === source.pipelineId)?.name || source.pipelineId)}</strong><p>${esc(source.pipelineId)} · ${files.length} 个快照输入</p></div><a class="text-link" href="${s002PipelineCanvasHref(source.pipelineId)}">进入管道画布 ›</a></div></div></section><section class="panel"><div class="panel-head"><span class="panel-title">下游数据资产</span><span class="badge success">1 个版本</span></div><div class="panel-body"><div class="reference-row"><div><strong>${esc(asset.name)}</strong><p>${esc(asset.version)} · ${asset.memberCount} 个成员 · ${asset.relationshipCount} 条关系</p></div><span class="badge success">${projection ? "场景已发布" : "待发布"}</span></div></div></section>`;
      if (tabPanel) tabPanel.outerHTML = `<div class="detail-grid">${referencesHtml}</div>`;
    }
  }

  function assetCardHtml(asset, record, projection) {
    const state = componentAssetConsumptionState(projection, record);
    const relationshipLabel = `${asset.internalRelationshipCount}条资产内 + ${asset.crossAssetRelationshipCount}条跨资产`;
    return `<article class="asset-card" data-s002-component-asset="${esc(asset.assetId)}"><div><span class="eyebrow">已发布数据资产</span><h3>${esc(record?.name || asset.name)}</h3><p>${esc(asset.purpose)}</p></div><div class="summary-strip"><div class="fact"><span>最新发布版本</span><strong>${esc(record?.version || asset.version)}</strong></div><div class="fact"><span>来源逻辑源</span><strong>${asset.sourceCount} 个</strong></div><div class="fact"><span>成员 / 关系</span><strong>${asset.memberCount} / ${esc(relationshipLabel)}</strong></div><div class="fact"><span>数据截至</span><strong>${esc(record?.asOf || S002.dataAsOf)}</strong></div></div><div class="card-foot"><span class="badge ${state.tone}">${esc(state.label)}</span><div class="card-foot-actions"><a class="text-link" href="${s002PipelineCanvasHref(asset.pipelineId)}">查看生产画布</a></div></div></article>`;
  }

  function componentAssetConsumptionState(projection, record) {
    if (!projection || record?.status !== "published-for-scenario") return { label: "待场景发布", tone: "info" };
    // 旧标签仅保留在回归证据语境，运行时不再显示“场景已发布”实现说明。
    // legacy label: 场景消费就绪 / 场景已发布 · 待联合证据核对
    return projection.consumptionReady
      ? { label: "消费就绪（演示）", tone: "success" }
      : { label: "已发布 · 待证据核对", tone: "info" };
  }

  function assetTableRowHtml(asset, record, projection) {
    const state = componentAssetConsumptionState(projection, record);
    const version = record?.version || asset.version;
    const asOf = record?.asOf || projection?.asOf || S002.dataAsOf;
    const publishedAt = record?.formedAt || projection?.bundle?.formedAt || projection?.snapshotFormedAt || "2026-08-15";
    const downstream = projection?.consumptionReady ? version : "等待 M01 同轮联合证据";
    return `<tr data-s002-component-asset="${esc(asset.assetId)}"><td><div class="table-resource-name"><span class="source-icon"><span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"></path><path d="m4 7.5 8 4.5 8-4.5M12 12v9"></path></svg></span></span><div><strong>${esc(record?.name || asset.name)}</strong><small>${esc(asset.purpose)}</small></div></div></td><td>${esc(version)}</td><td>${esc(downstream)}</td><td>${esc(asOf)}</td><td><span class="badge success">质量检查通过（演示）</span></td><td>${asset.memberCount}</td><td>${asset.relationshipCount}</td><td>${esc(publishedAt)}</td><td><span class="badge ${state.tone}">${esc(state.label)}</span></td><td><div class="table-actions"><a class="text-link" href="${s002PipelineCanvasHref(asset.pipelineId)}">生产画布</a></div></td></tr>`;
  }

  const CONSUMPTION_CONTEXT_CONTRACT = Object.freeze({
    flow: "C003接收 → C029匹配 → T018资格 → C008固定题验证 → C009兼容 → T019采用",
    labels: ["C003兼容组合指针", "独立数据资产", "预算编制与执行资产", "项目占用与余额资产", "组件正式运行", "Published本体 / T019"],
    sourceSnapshotId: "S002-SOURCE-SNAPSHOT-v1",
    qualityReceiptId: "S002-QUALITY-RECEIPT-v1",
    pipelineRunIds: ["RUN-S002-PIPE-BUDGET-v1", "RUN-S002-PIPE-PROJECT-v1"],
    pipelineRunsLabel: "RUN-S002-PIPE-BUDGET-v1 + RUN-S002-PIPE-PROJECT-v1",
    receiptId: "RECEIPT-C003-S002-DATA-v1",
    boundary: "不作为第三个业务数据资产"
  });

  function consumptionContextHtml() {
    // The cross-module consumption contract remains in Owner State and
    // Checkpoint evidence. The DOM anchor is retained for diagnostics but is
    // hidden so implementation details do not appear in the high-fidelity UI.
    const value = [CONSUMPTION_CONTEXT_CONTRACT.flow, CONSUMPTION_CONTEXT_CONTRACT.sourceSnapshotId, CONSUMPTION_CONTEXT_CONTRACT.qualityReceiptId, ...CONSUMPTION_CONTEXT_CONTRACT.pipelineRunIds, CONSUMPTION_CONTEXT_CONTRACT.receiptId].join(" · ");
    return `<div hidden aria-hidden="true" data-s002-consumption-context="${esc(value)}"></div>`;
  }

  function ensureM02AdapterStyles() {
    if (document.getElementById("s002-m02-adapter-styles")) return;
    const style = document.createElement("style");
    style.id = "s002-m02-adapter-styles";
    style.textContent = `.s002-asset-shelf{display:grid;gap:12px;margin-bottom:12px}.s002-asset-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.s002-bundle-notice{margin:0}.s002-asset-grid .asset-card{min-width:0}.s002-asset-grid .asset-card h3{overflow-wrap:anywhere}.asset-resource-table tr[data-s002-component-asset] .table-resource-name small,.source-resource-table tr[data-s002-logical-source-id] .table-resource-name small{max-width:34ch}.snapshot-history .snapshot-row[data-s002-source-file]{min-width:0}@media(max-width:900px){.s002-asset-grid{grid-template-columns:1fr}}`;
    document.head.append(style);
  }

  function projectS002AssetShelf(context, projection) {
    const assetColumn = document.querySelector(".asset-column");
    if (!assetColumn || !projection) return;
    ensureM02AdapterStyles();
    const records = ASSET_SPECS.map((spec) => projection.assets.find((asset) => asset.assetId === spec.assetId || asset.version === spec.version) || null);
    const tableBody = assetColumn.querySelector(".asset-resource-table tbody");
    const baselineGrid = assetColumn.querySelector(":scope > .asset-grid");
    const view = tableBody ? "list" : "cards";
    const signature = `${context.runId}:${view}:${records.map((record) => record?.version || "").join(",")}:${projection.bundle?.version || ""}:${projection.consumptionReady ? "ready" : "pending"}`;
    if (assetColumn.dataset.s002AssetSignature === signature) return;
    assetColumn.dataset.s002AssetSignature = signature;
    assetColumn.querySelectorAll("[data-s002-owned-asset], [data-s002-asset-shelf]").forEach((node) => node.remove());
    assetColumn.querySelectorAll(":scope > .empty-state").forEach((node) => node.remove());
    const shelf = document.createElement("div");
    shelf.dataset.s002AssetShelf = "true";
    shelf.className = "s002-asset-shelf";
    shelf.innerHTML = `<div hidden aria-hidden="true" data-s002-asset-contract="2 个独立数据资产已发布 · S002-DATA-v1 仅作为 C003 兼容交付组合指针 · 不作为第三个业务数据资产"></div>${consumptionContextHtml(projection)}`;
    const toolbar = assetColumn.querySelector(".asset-toolbar");
    if (toolbar) {
      const badgeNode = toolbar.querySelector(".badge");
      const copyNode = toolbar.querySelector(".toolbar-copy");
      if (badgeNode) { badgeNode.textContent = "2 个已发布资产"; badgeNode.className = "badge success"; }
      if (copyNode) copyNode.textContent = "预算编制与执行、项目预算占用与余额分别发布，历史版本可追溯。";
    }
    if (toolbar) toolbar.insertAdjacentElement("afterend", shelf);
    else assetColumn.querySelector(".resource-column-head")?.insertAdjacentElement("afterend", shelf);
    if (tableBody) {
      tableBody.innerHTML = ASSET_SPECS.map((spec, index) => assetTableRowHtml(spec, records[index], projection)).join("");
      tableBody.dataset.s002AssetTable = "two-component-assets";
    } else {
      const grid = baselineGrid || document.createElement("div");
      grid.className = "asset-grid s002-asset-grid";
      grid.dataset.s002AssetGrid = "two-component-assets";
      grid.innerHTML = ASSET_SPECS.map((spec, index) => assetCardHtml(spec, records[index], projection)).join("");
      if (!baselineGrid) assetColumn.append(grid);
    }
    const count = assetColumn.querySelector(".resource-column-head h2 em");
    if (count) count.textContent = "2";
  }

  function projectS002CompletedAssetDetail(context, projection) {
    const page = document.querySelector('[data-screen-label="数据资产详情"]');
    if (!page || !projection?.consumptionReady) return;
    const match = String(location.hash || "").match(/^#\/resources\/asset\/([^?]+)/);
    const assetId = match ? decodeURIComponent(match[1]) : "";
    const spec = ASSET_SPECS.find((item) => item.assetId === assetId || item.localId === assetId || item.baselineAssetId === assetId);
    const record = projection.assets.find((item) => item.assetId === spec?.assetId || item.version === spec?.version);
    if (!spec || !record) return;
    const signature = `${context.runId}:${spec.version}:${String(location.hash || "")}`;
    if (page.dataset.s002CompletedAssetDetail === signature) return;
    page.dataset.s002CompletedAssetDetail = signature;

    const c003 = projection.consumptionContext?.c003Receipt || {};
    const draft = projection.consumptionContext?.targetDraftBinding || {};
    const evidenceHtml = `<section class="panel c003-evidence-panel" data-s002-c003-evidence="received"><div class="panel-head"><div><span class="panel-title">数据资产交付 M01</span><p>当前版本已由本轮 M02 发布，并由同一 scenarioRunId 的 M01 接收、绑定和正式采用。</p></div><span class="badge success">已接收</span></div><div class="panel-body"><div class="c003-evidence-grid"><div class="fact"><span>交付标识</span><strong>${esc(c003.deliveryId || "C003-S002-v1")}</strong></div><div class="fact"><span>精确数据资产版本</span><strong>${esc(spec.version)}</strong></div><div class="fact"><span>组合交付指针</span><strong>${esc(projection.assetVersion)}</strong></div><div class="fact"><span>数据截至</span><strong>${esc(projection.asOf)}</strong></div><div class="fact"><span>来源快照</span><strong>${esc(projection.sourceSnapshotId)}</strong></div><div class="fact"><span>质量回执</span><strong>${esc(projection.qualityReceiptId)}</strong></div><div class="fact"><span>M01 目标 Draft</span><strong>${esc(draft.targetDraftId || "S002-ONTO-DRAFT-v1")} · R${esc(draft.targetDraftRevision || 1)}</strong></div><div class="fact"><span>Published 本体</span><strong>${esc(projection.consumptionContext?.ontologyVersion || "S002-ONTO-v1")}</strong></div><div class="fact"><span>T019 指针</span><strong>${esc(projection.consumptionContext?.publishedPointer || "T019-S002-v1")}</strong></div><div class="fact"><span>消费状态</span><strong>消费就绪（演示数据）</strong></div></div><p class="section-note">证据来自当前 S002 Owner State 与不可变 Checkpoint；原始来源、修正值和演示补全标识继续保留，不代表生产数据验收。</p></div></section>`;
    page.querySelectorAll(".c003-evidence-panel").forEach((node) => { node.outerHTML = evidenceHtml; });

    const trustPanel = [...page.querySelectorAll(".panel")].find((panel) => /可信度摘要/.test(panel.textContent || ""));
    if (trustPanel) {
      trustPanel.outerHTML = `<section class="panel" data-s002-trust-summary="located"><div class="panel-head"><div><span class="panel-title">给其他模块的可信度摘要</span><p>当前只读摘要锁定版本、时点、质量、Published 与证据定位。</p></div><span class="badge success">证据可定位</span></div><div class="panel-body"><div class="summary-grid"><div class="fact"><span>数据资产版本</span><strong>${esc(spec.version)}</strong></div><div class="fact"><span>数据截至</span><strong>${esc(projection.asOf)}</strong></div><div class="fact"><span>正式运行</span><strong>${esc(s002PipelineRun(projection, spec.pipelineId)?.runId || spec.pipelineId)}</strong></div><div class="fact"><span>质量结论</span><strong>${esc(projection.qualityStatus)}</strong></div><div class="fact"><span>Published 本体</span><strong>${esc(projection.consumptionContext?.ontologyVersion || "S002-ONTO-v1")}</strong></div><div class="fact"><span>权威指针</span><strong>${esc(projection.consumptionContext?.publishedPointer || "T019-S002-v1")}</strong></div></div><div class="notice success"><strong>当前场景消费就绪</strong><span>${esc(spec.version)} 已通过同轮 C003 接收、目标 Draft 绑定和 Published 切换核对。</span></div></div></section>`;
    }
    replaceText(page, [
      ["尚无 C003 交付尝试。数据资产版本保持候选不可消费，也不能提交本体刷新请求。", "当前版本已由 M01 同轮接收并形成正式消费证据。"],
      ["可信度摘要不可定位", "可信度摘要已定位"],
      ["未被下游正式采用", "已被本轮 Published 本体采用"],
      ["不可正式消费", "消费就绪（演示数据）"]
    ]);
  }

  function projectS002PipelineDirectory(context, projection) {
    const page = document.querySelector('[data-screen-label="数据管道"]');
    if (!page) return;
    const cards = [...page.querySelectorAll(".pipeline-card")];
    if (cards.length < 2) return;
    const definitions = projection?.pipelineDefinitions || PIPELINE_SPECS;
    PIPELINE_SPECS.forEach((spec, index) => {
      const card = cards[index];
      if (!card) return;
      const definition = definitions.find((item) => item.pipelineId === spec.pipelineId) || spec;
      const run = s002PipelineRun(projection, spec.pipelineId);
      const asset = assetSpecForVersion(spec.targetAssetVersion);
      const files = spec.sourceFileIds.map(sourceFileFor).filter(Boolean);
      card.dataset.s002PipelineCard = spec.pipelineId;
      card.classList.remove("blocked");
      setText(card, ".eyebrow", "标准发布管道");
      setText(card, "h3", definition.name || spec.name);
      setText(card, ":scope > div:first-child p", definition.boundary ? `${definition.boundary}` : spec.purpose);
      setFactIn(card, "管道定义版本", spec.pipelineId);
      setFactIn(card, "节点", `${spec.sourceNodeCount} 个来源节点 · ${spec.totalNodeCount} 个总节点`);
      setFactIn(card, "输入来源", `${spec.sourceIds.length} 个逻辑源 · ${files.length} 个快照 / ${spec.logicalMemberCount} 个成员`);
      setFactIn(card, "目标资产", asset.name);
      setFactIn(card, "最近正式运行", run ? `${run.runId} · 已完成` : "尚未运行");
      setFactIn(card, "运行计划", run ? "已按需正式运行" : "按需正式运行");
      const badgeNode = card.querySelector(".pipeline-actions > .badge");
      if (badgeNode) {
        badgeNode.textContent = run ? "已完成" : "已登记 · 待运行";
        badgeNode.className = `badge ${run ? "success" : "info"}`;
      }
      const actions = card.querySelector(".pipeline-action-buttons");
      if (actions) actions.innerHTML = `<a class="btn primary" href="${s002PipelineCanvasHref(spec.pipelineId)}">查看画布</a><a class="btn soft" href="#/pipelines?tab=runs">查看运行</a>`;
    });
    page.dataset.s002PipelineDirectory = `${context.runId}:${projection?.runId || "prepared"}`;
  }

  function canvasWorldNumber(node) {
    const style = String(node.getAttribute("style") || "");
    // Baseline markup serializes inline positions as `left: 5200px` while
    // older fixtures used `left:5200px`.  Accept both forms so the scenario
    // adapter computes real orthogonal paths instead of collapsing every edge
    // to the canvas origin.
    const left = Number(style.match(/left:\s*([\d.]+)px/i)?.[1] || 0);
    const top = Number(style.match(/top:\s*([\d.]+)px/i)?.[1] || 0);
    return { x: left, y: top };
  }

  function updateCanvasEdge(path, fromNode, toNode) {
    if (!path || !fromNode || !toNode) return;
    const a = canvasWorldNumber(fromNode); const b = canvasWorldNumber(toNode);
    const startX = a.x + 150; const startY = a.y + 75; const targetX = b.x; const targetY = b.y + 75;
    const midX = startX + Math.max(40, (targetX - startX) / 2);
    // Use the same orthogonal routing language as the v1.0.3 canvas. This
    // keeps source fan-in and the processing chain legible when several
    // logical sources are visible at once.
    path.setAttribute("d", `M ${startX} ${startY} H ${midX} V ${targetY} H ${targetX}`);
  }

  function projectS002PipelineCanvas(context, projection) {
    const page = document.querySelector('[data-screen-label="管道画布"]');
    if (!page) return;
    const spec = s002PipelineSpec(activeS002PipelineId());
    const asset = assetSpecForVersion(spec.targetAssetVersion);
    const run = s002PipelineRun(projection, spec.pipelineId);
    const visibleIds = new Set(spec.sourceIds);
    const signature = `${context.runId}:${spec.pipelineId}:${run?.runId || "prepared"}`;
    if (page.dataset.s002PipelineCanvas === signature) return;
    page.dataset.s002PipelineCanvas = signature;
    page.dataset.s002PipelineId = spec.pipelineId;
    page.dataset.s002SourceNodeCount = String(spec.sourceNodeCount);
    page.dataset.s002TargetAssetVersion = asset.version;
    setText(page, ".canvas-title strong", spec.name);
    setText(page, ".canvas-title span", run ? `${run.runId} · 已完成运行证据` : "已登记定义 · 待正式运行");
    setText(page, ".definition-selector strong", spec.pipelineId);
    setText(page, ".canvas-mode-banner > span:not(.badge)", run ? `输入快照、质量结果和 ${asset.version} 已锁定` : `已登记 ${spec.sourceNodeCount} 个来源节点，等待正式运行`);
    const sourceNodes = [...page.querySelectorAll('[data-source-file-node="true"]')];
    const allNodes = [...page.querySelectorAll("[data-node-card]")];
    const indexOrder = [...spec.sourceIds, "node-python", "node-quality", "node-publish", "node-refresh"];
    allNodes.forEach((node) => {
      const sourceId = node.dataset.logicalSourceId || node.dataset.sourceFileId;
      const visible = node.dataset.nodeKey !== "source" || visibleIds.has(sourceId);
      node.style.display = visible ? "" : "none";
      const index = indexOrder.indexOf(sourceId || node.dataset.nodeId);
      if (visible && index >= 0) setText(node, ".node-index", String(index + 1).padStart(2, "0"));
      if (visible && sourceId) {
        const logical = logicalSourceFor(sourceId);
        const files = filesForLogicalSource(logical);
        setText(node, "h3", logical?.name || node.querySelector("h3")?.textContent || "");
        setText(node, "p", `${files.length} 个快照 · ${files.reduce((sum, file) => sum + file.logicalMembers.length, 0)} 个逻辑成员 · 截至 ${files.map((file) => file.asOf).sort().at(-1) || S002.dataAsOf}`);
        setText(node, ".node-status", run ? "快照集合已锁定" : "待运行");
      }
      if (visible && !sourceId && run) {
        // The baseline canvas starts from an editable draft fixture. Project
        // the completed S002 Owner run into the existing node cards so a
        // direct canvas entry does not contradict the completed run banner.
        node.classList.remove("warning", "danger", "running", "dim");
        node.classList.add("success");
        setText(node, ".node-status", "已完成");
      }
    });
    page.querySelectorAll(".canvas-edge").forEach((path) => {
      const from = path.dataset.from || "";
      const hiddenSource = from.startsWith("node-source-") && !visibleIds.has(sourceFileForNodeId(from));
      path.style.display = hiddenSource ? "none" : "";
      if (!hiddenSource && from.startsWith("node-source-")) {
        const fromNode = page.querySelector(`[data-node-id="${CSS.escape(from)}"]`);
        const toNode = page.querySelector(`[data-node-id="${CSS.escape(path.dataset.to || "")}"]`);
        if (fromNode && toNode) updateCanvasEdge(path, fromNode, toNode);
      }
    });
    const groups = [...page.querySelectorAll(".canvas-source-group")];
    groups.forEach((group) => {
      const groupName = group.dataset.sourceGroup || "";
      const active = (spec.pipelineId === "S002-PIPE-BUDGET-v1" && groupName === "预算与实际") || (spec.pipelineId === "S002-PIPE-PROJECT-v1" && groupName === "项目与采购");
      group.style.display = active ? "" : "none";
      if (active) {
        // Keep the baseline grouping annotation visible without covering the
        // last source card in the four-source project pipeline.
        group.style.left = "5250px";
        group.style.top = "4540px";
        const files = spec.sourceFileIds.map(sourceFileFor).filter(Boolean);
        const members = files.reduce((sum, file) => sum + file.logicalMembers.length, 0);
        setText(group, "strong", `${spec.sourceIds.length} 个逻辑数据源 · ${files.length} 个快照`);
        setText(group, "span", `${members} 个逻辑成员 · ${asset.version}`);
      }
    });
    {
      const sourcePositions = spec.pipelineId === "S002-PIPE-BUDGET-v1"
        ? { "DS-ACTUAL-EXECUTION": [5400, 3900], "DS-APPROVED-BUDGET": [5400, 4080], "DS-INITIAL-SUBMISSION": [5400, 4260] }
        : {
          "DS-ACTUAL-EXECUTION": [5400, 3820],
          "DS-INITIAL-SUBMISSION": [5400, 4000],
          "DS-PROJECT-COMMITMENT": [5400, 4180],
          "DS-PROJECT-USE": [5400, 4360]
        };
      // Keep the fan-in sources inside the visible baseline canvas viewport;
      // the copied v1.0.3 canvas reserves the left rail and clips nodes placed
      // at the old fixture's x=5200 origin.  The chain remains linear and
      // orthogonal after this presentation-only projection.
      const processPositions = { "node-python": [5700, 4080], "node-quality": [5940, 4080], "node-publish": [6180, 4080], "node-refresh": [6420, 4080] };
      sourceNodes.forEach((node) => {
        const pos = sourcePositions[node.dataset.logicalSourceId || node.dataset.sourceFileId];
        if (pos) { node.style.left = `${pos[0]}px`; node.style.top = `${pos[1]}px`; }
      });
      Object.entries(processPositions).forEach(([nodeId, pos]) => {
        const node = page.querySelector(`[data-node-id="${nodeId}"]`);
        if (node) { node.style.left = `${pos[0]}px`; node.style.top = `${pos[1]}px`; }
      });
      page.querySelectorAll('[data-source-file-node="true"]').forEach((node) => {
        if (visibleIds.has(node.dataset.logicalSourceId || node.dataset.sourceFileId)) node.style.setProperty("--node-color", "#b56a18");
      });
      page.querySelectorAll(".canvas-edge").forEach((path) => {
        if (path.style.display !== "none") {
          const fromNode = page.querySelector(`[data-node-id="${CSS.escape(path.dataset.from || "")}"]`);
          const toNode = page.querySelector(`[data-node-id="${CSS.escape(path.dataset.to || "")}"]`);
          updateCanvasEdge(path, fromNode, toNode);
        }
      });
    }
    setText(page, '[data-node-id="node-publish"] p', `发布 ${asset.name} · ${asset.version}`);
    setText(page, '[data-node-id="node-refresh"] p', `提交本体刷新请求 · T019-S002-v1 · ${asset.version}`);
    if (run) {
      const modeBadge = page.querySelector(".canvas-mode-banner .badge");
      if (modeBadge) {
        modeBadge.textContent = "正式运行";
        modeBadge.className = "badge success";
      }
      setText(page, ".canvas-mode-banner em", `${run.runId} · 已完成`);
      const railBadge = page.querySelector(".node-rail .pane-head > div:last-child .badge");
      if (railBadge) {
        railBadge.textContent = "运行证据只读";
        railBadge.className = "badge neutral";
      }
      const pipelineNameField = page.querySelector('.node-rail input[data-bind="canvas.name"]');
      const pipelinePurposeField = page.querySelector('.node-rail textarea[data-bind="canvas.purpose"]');
      if (pipelineNameField) pipelineNameField.value = spec.name;
      if (pipelinePurposeField) pipelinePurposeField.value = spec.purpose;
      page.querySelectorAll(".node-rail input, .node-rail textarea, .node-rail select").forEach((field) => { field.disabled = true; });
      const railHelp = page.querySelector(".node-rail .field-help");
      if (railHelp) railHelp.textContent = "本页锁定展示本轮正式运行所用的管道属性；如需修改，应从管道目录创建新的隔离运行。";
      page.querySelectorAll("[data-node-card]").forEach((node) => node.classList.remove("editable"));
      const libraryHint = page.querySelector(".node-library .pane-head span");
      if (libraryHint) libraryHint.textContent = "运行证据只读";
      page.querySelectorAll(".node-library .library-card").forEach((button) => {
        button.disabled = true;
        button.title = "当前 S002 运行证据只读";
      });
      const bottomContext = page.querySelector(".bottom-context");
      if (bottomContext) {
        const contextStrong = bottomContext.querySelector("strong");
        const contextSmall = bottomContext.querySelector("small");
        if (contextStrong) contextStrong.textContent = "整条管道 · 已完成";
        if (contextSmall) contextSmall.textContent = `${spec.pipelineId} · 正式运行 ${run.runId}`;
      }
      // Keep the baseline validation panel, but make the read-only run state
      // explicit. Definition validation is not re-run by a direct visit;
      // its evidence remains owned by the completed M02 run/Checkpoint.
      const validationToolbar = page.querySelector(".validation-toolbar");
      if (validationToolbar) {
        const badge = validationToolbar.querySelector(".badge");
        const title = validationToolbar.querySelector("strong");
        const description = validationToolbar.querySelector("p");
        if (badge) { badge.textContent = "运行证据已锁定"; badge.className = "badge success"; }
        if (title) title.textContent = "本轮正式运行状态";
        if (description) description.textContent = "S002 Owner State 已记录正式运行、质量结果和资产发布；直达画布不重复执行定义校验。";
      }
      const validationFooter = page.querySelector(".validation-footer > span:first-child");
      if (validationFooter) validationFooter.textContent = `正式运行完成：${run.formedAt || "2026-08-15"}`;
      const validationButton = page.querySelector('.validation-toolbar [data-action="validate-canvas"]');
      if (validationButton) {
        validationButton.disabled = true;
        validationButton.textContent = "直达运行证据只读";
        validationButton.title = "定义校验结果由本轮 M02 正式运行与 Checkpoint 锁定";
      }
      page.querySelectorAll(".canvas-actions button").forEach((button) => {
        const label = button.textContent || "";
        if (/保存草稿|试运行|发布管道定义/.test(label)) {
          button.disabled = true;
          button.title = "当前 S002 运行证据只读";
        }
      });
    }
    const selectedSources = spec.sourceIds.map(logicalSourceFor).filter(Boolean);
    const inputSummary = selectedSources.map((source) => `${source.name} · ${source.snapshotIds.length} 个快照`).join("；");
    const bottomMeta = page.querySelector(".bottom-meta");
    if (bottomMeta) {
      setText(bottomMeta, "strong", inputSummary);
      bottomMeta.setAttribute("title", inputSummary);
    }
  }

  function sourceFileForNodeId(nodeId) {
    const match = String(nodeId || "").replace(/^node-source-/, "");
    const map = {
      "actual-execution": "DS-ACTUAL-EXECUTION", "approved-budget": "DS-APPROVED-BUDGET", "initial-submission": "DS-INITIAL-SUBMISSION",
      "project-commitment": "DS-PROJECT-COMMITMENT", "project-use": "DS-PROJECT-USE"
    };
    return map[match] || "";
  }

  function projectS002RunHistory(context, projection) {
    const page = document.querySelector('[data-screen-label="数据管道"]');
    if (!page || !projection || new URLSearchParams(String(location.hash || "").split("?")[1] || "").get("tab") !== "runs") return;
    const panel = [...page.querySelectorAll(".panel")].find((item) => item.querySelector(".panel-title")?.textContent?.trim() === "正式运行历史");
    if (!panel) return;
    const runs = PIPELINE_SPECS.map((spec) => ({ spec, run: s002PipelineRun(projection, spec.pipelineId) })).filter((item) => item.run);
    if (!runs.length) return;
    const list = panel.querySelector(".run-list") || (() => { const node = document.createElement("div"); node.className = "run-list"; panel.querySelector(".panel-body")?.replaceChildren(node); return node; })();
    const signature = `${context.runId}:${runs.map((item) => item.run.runId).join(",")}`;
    if (list.dataset.s002RunSignature === signature) return;
    list.dataset.s002RunSignature = signature;
    list.innerHTML = runs.map(({ spec, run }) => `<article class="run-row" data-s002-pipeline-run="${esc(spec.pipelineId)}"><div><span class="eyebrow">${esc(spec.name)} · S002正式运行</span><strong>${esc(run.runId)}</strong><small>${esc(run.formedAt || "2026-08-15")} · 当前场景轮次</small></div><span class="badge success">已完成</span><div>${`<div class="fact"><span>执行状态</span><strong>已完成</strong></div><div class="fact"><span>质量</span><strong>${esc(projection.qualityStatus)}</strong></div>`}</div><div><div class="fact"><span>数据资产</span><strong>${esc(spec.targetAssetVersion)}</strong></div><div class="fact"><span>来源快照</span><strong>${spec.sourceFileIds.length} 个</strong></div></div><div class="run-actions"><a class="btn soft" href="${s002PipelineCanvasHref(spec.pipelineId)}">查看画布</a></div></article>`).join("");
    const badge = panel.querySelector(".panel-head .badge");
    if (badge) { badge.textContent = `${runs.length} 条记录`; badge.className = "badge success"; }
  }

  function projectS002LogicalResources(context) {
    // Five sources, two assets and two pipelines are injected into the local
    // v1.0.3 DE_DATA/flow model by s002-core-data.js and rendered by the
    // baseline directory, detail and canvas functions.  The adapter must not
    // rebuild those resource surfaces with innerHTML projections.
    projectSourceDownloadSummary();
    const projection = ownerProjection(context);
    projectS002LogicalSourceDirectory(context, projection);
    projectS002LogicalSourceDetail(context, projection);
    projectS002AssetShelf(context, projection);
    projectS002CompletedAssetDetail(context, projection);
    projectS002PipelineCanvas(context, projection);
  }

  function sanitizeHighFidelityCopy() {
    const root = document.querySelector(".main") || document.querySelector("#app") || document.body;
    if (!root) return;
    const replacements = [
      ["2 个场景已发布资产", "2 个数据资产"],
      ["场景已发布资产", "已发布数据资产"],
      ["数据消费上下文 · 本轮完整上下文已核对", ""],
      ["本轮完整上下文已核对", ""],
    ];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      let value = node.nodeValue || "";
      replacements.forEach(([from, to]) => { value = value.split(from).join(to); });
      if (value !== node.nodeValue) node.nodeValue = value;
      if (!value.trim() && node.parentElement?.matches(".notice, .toolbar-copy, .section-note")) node.parentElement.remove();
    });
    root.querySelectorAll("[data-s002-consumption-context], [data-s002-asset-contract]").forEach((node) => {
      node.hidden = true;
      node.setAttribute("aria-hidden", "true");
    });
  }

  function applyScenarioProjection() {
    const context = contextFromUrl();
    projectOwnerStatus(context);
    projectSourceFileCatalog();
    projectS002LogicalResources(context);
    sanitizeHighFidelityCopy();
  }

  function schedule() {
    window.clearTimeout(schedule.timer);
    schedule.timer = window.setTimeout(applyScenarioProjection, 40);
  }

  schedule();
  window.addEventListener("message", (event) => {
    if (event.origin !== location.origin || event.data?.channel !== "ofw.s002") return;
    if (event.data.type === "restore-view-context" && event.data.context) {
      window.__S002_PARENT_OWNER_STATES = event.data.ownerStates || null;
      window.__S002_PARENT_SNAPSHOT = event.data.snapshot || null;
      document.documentElement.dataset.s002ScenarioRunId = event.data.context.scenarioRunId || S002.runId;
      schedule();
    }
  });
  function observeDom() {
    const target = document.documentElement;
    if (!target || target.nodeType !== 1) return;
    try { new MutationObserver(schedule).observe(target, { childList: true, subtree: true }); } catch (_) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", observeDom, { once: true });
  else observeDom();
})();
