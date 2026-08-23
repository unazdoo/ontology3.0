(function () {
  "use strict";

  const base = window.OFW_DE_BASE_DATA;
  const s002 = window.DE_DATA;
  const registry = window.OFW_COMPOSITE_REGISTRY;
  const seed = window.OFW_M02_S001_FLOW_SEED;
  if (!base || !s002 || !registry || !seed) return;

  const STORAGE_KEY = "ontology3.data-engineering.workspace.v5-handoff";
  const PORTFOLIO_SCHEMA = "ofw-m02-four-scenarios-complete-v4";
  const SNAPSHOT_ROOT = "./source-snapshots/";
  const formedAt = "2026-08-21 18:00:00";
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const sceneById = Object.fromEntries(registry.scenes.map((scene) => [scene.scenarioId, scene]));
  const sceneName = (scenarioId) => sceneById[scenarioId]?.name || scenarioId;
  const contextOf = (scenarioId) => {
    const scene = sceneById[scenarioId];
    return {
      scenarioId,
      scenarioVersion: scene.scenarioVersion,
      scenarioRunId: scene.scenarioRunId,
      formedAt: scenarioId === "S001" ? "2026-08-16T08:17:48.567Z" : scenarioId === "S002" ? "2026-08-15T08:00:00.000Z" : scenarioId === "S003" ? "2026-08-17T16:30:00.000Z" : "2026-08-15T23:30:00.000Z",
      status: "active"
    };
  };
  const downloadHref = (fileName) => `${SNAPSHOT_ROOT}${encodeURIComponent(fileName)}`;
  const sizeText = (sizeBytes) => `${new Intl.NumberFormat("zh-CN").format(Number(sizeBytes || 0))} 字节`;
  const tag = (item, scenarioId) => ({ ...clone(item), scene: scenarioId, scenarioId, scenarioName: sceneName(scenarioId) });

  function snapshot({ id, sourceId, fileName, asOf, rows, sizeBytes, sha256, scope, status = "已登记", structureStatus = "结构已核验", logicalMembers = [] }) {
    return {
      snapshotId: id, t002Id: id, sourceId, fileName, asOf, rows, sizeBytes,
      size: sizeText(sizeBytes), hash: sha256, sha256, scope, status, structureStatus,
      logicalMembers, acquiredAt: formedAt, readStartedAt: formedAt, readCompletedAt: formedAt,
      readDurationMs: 18, current: true, downloadHref: downloadHref(fileName)
    };
  }

  function sourceRecord({ id, name, scenarioId, description, workbookKey, snapshotItem, pipelineRefs, downstreamAssets, category = "手工工作簿", access = "按需上传工作簿" }) {
    return tag({
      id, name, category, access, description,
      registration: "快照已确认 · 已用于正式运行",
      latestAcquired: `${snapshotItem.asOf} · 已登记`, asOf: snapshotItem.asOf, snapshotCount: 1,
      syncPlan: "按需追加新快照", nextSync: "由新文件上传触发",
      lastSync: `${formedAt} · 最近同步成功`, enabled: true, selectable: true,
      workbookKey, fileName: snapshotItem.fileName,
      physicalEvidence: `${snapshotItem.fileName} 已形成不可变来源快照并完成结构核验`,
      snapshots: [snapshotItem], pipelineRefs: clone(pipelineRefs || []), downstreamAssets: clone(downstreamAssets || []),
      sourceArtifact: { fileName: snapshotItem.fileName, sha256: snapshotItem.sha256, sizeBytes: snapshotItem.sizeBytes, downloadHref: snapshotItem.downloadHref }
    }, scenarioId);
  }

  const financeBase = clone(base.sources.find((item) => item.id === "finance-workbook"));
  const financeSnapshot = snapshot({
    id: "T002-FINANCE-WORKBOOK-83232E2DDA91", sourceId: "finance-workbook",
    fileName: "集团融资业务数据_2025.xlsx", asOf: "2025-12-31", rows: 5218, sizeBytes: 807264,
    sha256: "83232e2dda913e63d2faa1e45aab824270f4ab5bcb96849a44ab8a03f93db12d",
    scope: "融资明细与单位负责人映射", logicalMembers: ["融资明细", "单位负责人映射"]
  });
  const financeSource = sourceRecord({
    id: "finance-workbook", name: "融资一览表", scenarioId: "S001",
    description: "集团融资明细、金融机构和单位负责人信息的当前正式来源。",
    workbookKey: "finance", snapshotItem: financeSnapshot,
    pipelineRefs: [{ pipelineId: "finance-pipeline", name: "融资数据标准化与发布", definition: "DEF-20260816-01", node: "融资一览表", lastRun: "RUN-20251231-002 · 成功" }],
    downstreamAssets: [{ id: "finance-asset-target", name: "融资标准化数据资产", version: "FIN-ASSET-20251231-v02", status: "消费就绪" }]
  });
  financeSource.contentFindings = financeBase.contentFindings;
  financeSource.structureVerification = financeBase.structureVerification;

  const s002PhysicalSources = s002.sources.flatMap((logicalSource) => (logicalSource.snapshots || []).map((item) => {
    const id = `s002-${String(item.snapshotId).toLowerCase()}`;
    const snapshotItem = snapshot({
      id: item.snapshotId, sourceId: id, fileName: item.fileName, asOf: item.asOf, rows: item.rows,
      sizeBytes: item.sizeBytes, sha256: item.sha256 || item.hash,
      scope: item.scope || item.purpose || logicalSource.name, logicalMembers: item.logicalMembers || ["Sheet"]
    });
    return sourceRecord({
      id, name: item.fileName.replace(/\.[^.]+$/, ""), scenarioId: "S002",
      description: `${logicalSource.name}的${item.scope || item.purpose || "正式业务输入"}。`,
      workbookKey: logicalSource.workbookKey, snapshotItem,
      pipelineRefs: logicalSource.pipelineRefs, downstreamAssets: logicalSource.downstreamAssets
    });
  }));

  const riskSnapshot = snapshot({
    id: "S003-SNAPSHOT-20251231-v1", sourceId: "s003-workbook",
    fileName: "企业债务风险评估数据_2025.xlsx", asOf: "2025-12-31", rows: 21, sizeBytes: 16250,
    sha256: "dbdab9c870d7f2e456c3a9e0f91b340b372da6d40eb241551e0ee8848cac42a0",
    scope: "财务数据与调节因子", logicalMembers: ["财务数据", "调节因子"]
  });
  const riskSource = sourceRecord({
    id: "s003-workbook", name: "企业债务风险评估数据", scenarioId: "S003",
    description: "企业财务数据与人工维护调节因子的当前正式输入。",
    workbookKey: "s003", snapshotItem: riskSnapshot,
    pipelineRefs: [{ pipelineId: "s003-risk-standardize", name: "债务风险输入标准化", definition: "S003-DEFINITION-v1", node: "企业债务风险评估数据", lastRun: "RUN-S003-DATA-20251231-v1 · 成功" }],
    downstreamAssets: [{ id: "s003-risk-asset", name: "债务风险评估输入数据资产", version: "S003-T007-DEBT-RISK-20251231-v1", status: "消费就绪" }]
  });

  const s004Files = [
    ["s004-annual-2023", "中国广核2023年年度报告", "中国广核2023年年度报告.pdf", "2023-12-31", 5955620, "ad61895a8117b7c9129bb28483816f4f5d60b346245bd3a8a09d5c22e62f5d67", "2023 年财务与经营事实", "s004Annual", "财务报表", "正式报告上传"],
    ["s004-annual-2024", "中国广核2024年年度报告", "中国广核2024年年度报告.pdf", "2024-12-31", 1423683, "c379d7a62bb0fb8c0c5ceeba34f1ca9c806ee2ceb1b53bfcbf6c6f22076f9d5e", "2024 年财务与经营事实", "s004Annual", "财务报表", "正式报告上传"],
    ["s004-annual-2025", "中国广核2025年年度报告", "中国广核2025年年度报告.pdf", "2025-12-31", 3123448, "f1ae0b9f53db25faf937d38be0abcee756ea7c8b58c29635aee0335a87904206", "2025 年财务与经营事实", "s004Annual", "财务报表", "正式报告上传"],
    ["s004-pack-base", "贷前调查申请资料", "贷前调查申请资料.xlsx", "2026-08-15", 27642, "7734bf4339bc8c8bc8eb46176ad8ea0faf38cb901f084414c81ae2049c221978", "贷款申请、授信与用途资料", "s004Pack", "业务资料包", "申请资料上传"],
    ["s004-pack-current", "贷前调查补充资料", "贷前调查补充资料.xlsx", "2026-08-15", 20294, "9a6e3502039beef28ebe1fe10bc046cd4bb0e051b35122b2d6aea1c8c235f6d9", "征信、还款计划与现场调查资料", "s004Pack", "业务资料包", "补充资料上传"]
  ].map(([id, name, fileName, asOf, sizeBytes, sha256, scope, workbookKey, category, access]) => sourceRecord({
    id, name, scenarioId: "S004", description: `${scope}的正式来源文件。`, workbookKey, category, access,
    snapshotItem: snapshot({ id: `SNAP-${id.toUpperCase()}`, sourceId: id, fileName, asOf, rows: 1, sizeBytes, sha256, scope, logicalMembers: [scope] }),
    pipelineRefs: [{ pipelineId: "s004-preflight-pipeline", name: "贷前调查资料归集与核验", definition: "DEF-S004-20260815-01", node: name, lastRun: "RUN-S004-20260815-001 · 成功" }],
    downstreamAssets: [{ id: "s004-preflight-asset", name: "贷前调查数据资产", version: "DATA-ASSET-S004-20260815-V01", status: "消费就绪" }]
  }));

  const field = (fieldId, name, type = "文本") => ({ fieldId, name, type, nullable: false, role: "业务字段", description: name });
  const member = (id, name, grain, key, count, fields) => ({ id, stableId: id, name, grain, key, identityFieldId: fields[0]?.fieldId, rowCount: count, fields });
  const relationship = (id, name, sourceMemberId, targetMemberId) => ({ id, stableId: id, name, sourceMemberId, targetMemberId, sourceFieldId: `${sourceMemberId}-KEY`, targetFieldId: `${targetMemberId}-KEY`, status: "通过", unmatchedCount: 0 });
  const riskMembers = [
    member("S003-MEMBER-FINANCIAL", "财务数据", "一行一企业评估时点财务事实", "单位名称", 21, [field("S003-FIELD-ENTITY", "单位名称", "文本标识"), field("S003-FIELD-ASSET", "资产总计_期末余额", "十进制数"), field("S003-FIELD-LIABILITY", "负债合计_期末余额", "十进制数")]),
    member("S003-MEMBER-FACTOR", "调节因子", "一行一企业评估时点因子输入", "单位名称", 21, [field("S003-FIELD-FACTOR-ENTITY", "单位名称", "文本标识"), field("S003-FIELD-CATEGORY", "公司类别"), field("S003-FIELD-FUND-GAP", "资金余缺预警")])
  ];
  const riskRelationships = [relationship("REL-S003-FINANCIAL-FACTOR", "企业财务事实关联调节因子", riskMembers[0].id, riskMembers[1].id)];
  const preflightMembers = [
    member("S004-MEMBER-BORROWER", "集团成员借款人", "一行一借款人", "统一社会信用代码", 1, [field("S004-FIELD-USCC", "统一社会信用代码", "文本标识"), field("S004-FIELD-NAME", "借款人名称")]),
    member("S004-MEMBER-APPLICATION", "贷款申请", "一行一贷款申请", "申请编号", 1, [field("S004-FIELD-APP", "申请编号", "文本标识"), field("S004-FIELD-AMOUNT", "申请金额", "十进制数")]),
    member("S004-MEMBER-FINANCIAL", "财务报表事实", "一行一年度财务事实", "事实编号", 3, [field("S004-FIELD-FACT", "事实编号", "文本标识"), field("S004-FIELD-ASOF", "截至日期", "日期")]),
    member("S004-MEMBER-EVIDENCE", "贷前调查证据", "一行一证据项", "证据编号", 18, [field("S004-FIELD-EVID", "证据编号", "文本标识"), field("S004-FIELD-EVID-TYPE", "证据类型")])
  ];
  const preflightRelationships = [
    relationship("REL-S004-APPLICATION-BORROWER", "贷款申请关联借款人", preflightMembers[1].id, preflightMembers[0].id),
    relationship("REL-S004-FINANCIAL-BORROWER", "财务事实关联借款人", preflightMembers[2].id, preflightMembers[0].id),
    relationship("REL-S004-EVIDENCE-APPLICATION", "调查证据关联贷款申请", preflightMembers[3].id, preflightMembers[1].id)
  ];

  function completedAsset(asset, scenarioId, options = {}) {
    return tag({
      ...clone(asset), published: true, status: "消费就绪", versionCount: 1,
      currentVersion: options.version || asset.currentVersion,
      currentAuthoritativeVersion: options.version || asset.currentVersion,
      asOf: options.asOf || asset.asOf, quality: options.quality || "通过",
      publishedAt: options.publishedAt || formedAt, refreshStatus: "本体已采用", consumptionStatus: "消费就绪",
      sourceSnapshot: options.sourceSnapshot || asset.sourceSnapshot, sourceSnapshotId: options.sourceSnapshotId || asset.sourceSnapshotId,
      members: clone(options.members || asset.members || []),
      relationships: clone(options.relationships || asset.relationshipContracts || asset.relationships || []),
      relationshipContracts: clone(options.relationships || asset.relationshipContracts || asset.relationships || []),
      detailViews: [{ key: "overview", label: "版本概览" }, { key: "members", label: "包含的数据" }, { key: "lineage", label: "如何产生" }, { key: "consumption", label: "如何变为可用" }]
    }, scenarioId);
  }

  const financeAssetBase = base.targetAssets.find((item) => item.id === "finance-asset-target");
  const assets = [
    completedAsset(financeAssetBase, "S001", { version: "FIN-ASSET-20251231-v02", asOf: "2025-12-31", sourceSnapshot: financeSnapshot.fileName, sourceSnapshotId: financeSnapshot.snapshotId }),
    ...s002.targetAssets.map((asset) => completedAsset(asset, "S002", { sourceSnapshot: s002PhysicalSources.find((source) => source.downstreamAssets.some((item) => item.version === asset.currentVersion))?.fileName })),
    completedAsset({ id: "s003-risk-asset", t006Id: "S003-RISK-DATA", name: "债务风险评估输入数据资产", purpose: "支撑企业债务风险指标、评分与分档。" }, "S003", { version: "S003-T007-DEBT-RISK-20251231-v1", asOf: "2025-12-31", sourceSnapshot: riskSnapshot.fileName, sourceSnapshotId: riskSnapshot.snapshotId, members: riskMembers, relationships: riskRelationships, quality: "通过" }),
    completedAsset({ id: "s004-preflight-asset", t006Id: "DATA-ASSET-S004", name: "贷前调查数据资产", purpose: "支撑贷前调查本体、固定证据包与正式报告。" }, "S004", { version: "DATA-ASSET-S004-20260815-V01", asOf: "2026-08-15", sourceSnapshot: "贷前调查补充资料.xlsx", sourceSnapshotId: "SNAP-S004-PACK-CURRENT", members: preflightMembers, relationships: preflightRelationships, quality: "通过" })
  ];

  const pipelines = [
    tag({ ...clone(base.pipelines.find((item) => item.id === "finance-pipeline")), definitionState: "已发布", definitionVersion: "DEF-20260816-01", sourceIds: ["finance-workbook"], targetAssetId: "FIN-ASSET", latestRun: "RUN-20251231-002 · 成功", canOpen: true }, "S001"),
    ...s002.pipelines.map((pipeline) => tag({ ...clone(pipeline), definitionState: "已发布", sourceIds: s002PhysicalSources.filter((source) => source.pipelineRefs.some((ref) => ref.pipelineId === pipeline.id)).map((source) => source.id), latestRun: pipeline.id === "S002-PIPE-BUDGET-v1" ? "RUN-S002-BUDGET-20251231-v1 · 成功" : "RUN-S002-PROJECT-20251231-v1 · 成功", canOpen: true }, "S002")),
    tag({ id: "s003-risk-standardize", name: "债务风险输入标准化", purpose: "归集企业财务数据与人工调节因子，完成质量核验并发布正式数据资产。", definitionState: "已发布", definitionVersion: "S003-DEFINITION-v1", sourceIds: ["s003-workbook"], source: "企业债务风险评估数据", targetAsset: "债务风险评估输入数据资产", targetAssetId: "S003-RISK-DATA", latestRun: "RUN-S003-DATA-20251231-v1 · 成功", schedule: "按需正式运行", canOpen: true }, "S003"),
    tag({ id: "s004-preflight-pipeline", name: "贷前调查资料归集与核验", purpose: "归集年度报告与贷前调查资料，完成事实抽取、质量核验和资产发布。", definitionState: "已发布", definitionVersion: "DEF-S004-20260815-01", sourceIds: s004Files.map((source) => source.id), source: "年度报告与贷前调查资料", targetAsset: "贷前调查数据资产", targetAssetId: "DATA-ASSET-S004", latestRun: "RUN-S004-20260815-001 · 成功", schedule: "按贷款申请正式运行", canOpen: true }, "S004")
  ];
  const pipelineRunIds = { "finance-pipeline": "RUN-20251231-002", "S002-PIPE-BUDGET-v1": "RUN-S002-BUDGET-20251231-v1", "S002-PIPE-PROJECT-v1": "RUN-S002-PROJECT-20251231-v1", "s003-risk-standardize": "RUN-S003-DATA-20251231-v1", "s004-preflight-pipeline": "RUN-S004-20260815-001" };
  const sourceIndex = Object.fromEntries([financeSource, ...s002PhysicalSources, riskSource, ...s004Files].map((source) => [source.id, source]));
  const assetIndex = Object.fromEntries(assets.map((asset) => [asset.t006Id, asset]));

  function buildDefinition(pipeline) {
    const sourceNodes = pipeline.sourceIds.map((sourceId, index) => ({ id: `${pipeline.id}-source-${index + 1}`, key: "source", x: 5650, y: 3720 + index * 180, sourceId, inputKind: "source", inputSlotId: index ? "reference" : "main", memberScope: "全部成员" }));
    const processing = ["python", "quality", "publish", "refresh"].map((key, index) => ({ id: `${pipeline.id}-${key}`, key, x: 6100 + index * 250, y: 4200 }));
    const edges = [...sourceNodes.map((node, index) => ({ id: `${pipeline.id}-edge-source-${index + 1}`, from: node.id, to: processing[0].id, slot: index ? "参考输入" : "主输入" })), ...processing.slice(0, -1).map((node, index) => ({ id: `${pipeline.id}-edge-${index + 1}`, from: node.id, to: processing[index + 1].id, slot: "主输入" }))];
    return {
      id: pipeline.definitionVersion, pipelineId: pipeline.id, name: pipeline.name, purpose: pipeline.purpose,
      nodes: [...sourceNodes, ...processing], edges,
      pythonModule: { id: `${pipeline.scenarioId}-STANDARDIZE`, version: "1.0", name: `${sceneName(pipeline.scenarioId)}标准化处理`, description: "已发布受控处理模块", inputSlots: [{ id: "main", name: "主输入", required: true, accepts: ["source"] }, { id: "reference", name: "参考输入", required: false, accepts: ["source"] }] },
      targetAssetId: pipeline.targetAssetId,
      qualityRules: [{ id: `${pipeline.scenarioId}-Q-001`, version: "1.0", name: "主键与必填校验", enabled: true }, { id: `${pipeline.scenarioId}-Q-002`, version: "1.0", name: "字段类型与枚举校验", enabled: true }, { id: `${pipeline.scenarioId}-Q-003`, version: "1.0", name: "成员关系完整性校验", enabled: true }],
      pipelineSchedule: pipeline.schedule, validationSeen: true, validationFingerprint: `${pipeline.id}-VALIDATED`, validationAt: formedAt,
      immutable: true, publishedAt: formedAt, scenarioContext: contextOf(pipeline.scenarioId)
    };
  }
  function relationEvidence(asset) {
    return (asset.relationshipContracts || []).map((item, index) => ({ ...clone(item), stableId: item.stableId || item.id || `${asset.t006Id}-REL-${index + 1}`, name: item.name || String(item), checkedCount: 1, unmatchedCount: 0, status: "通过" }));
  }
  function completedVersion(asset, pipeline, definition, runId) {
    const versionId = asset.currentVersion;
    const primarySource = sourceIndex[pipeline.sourceIds.at(-1)] || sourceIndex[pipeline.sourceIds[0]];
    const primarySnapshot = primarySource.snapshots[0];
    const t019EvidenceId = registry.ontology[asset.scenarioId]?.pointer || `T019-${asset.scenarioId}`;
    const requestId = `REFRESH-${versionId}`;
    const resultId = `MATCH-${versionId}`;
    const evidenceRefs = [primarySnapshot.snapshotId, definition.id, runId, `QUALITY-${runId}`, versionId, t019EvidenceId];
    return {
      id: versionId, targetAssetId: asset.t006Id, scenarioId: asset.scenarioId, scenarioContext: contextOf(asset.scenarioId), runId,
      asOf: asset.asOf, quality: "通过", qualityId: `QUALITY-${runId}`, publishedAt: asset.publishedAt,
      sourceSnapshot: primarySnapshot.fileName, sourceSnapshotId: primarySnapshot.snapshotId, sourceHash: primarySnapshot.sha256,
      definitionVersion: definition.id,
      members: asset.members.map((item) => ({ ...clone(item), stableId: item.stableId || item.id, rowCount: Number(item.rowCount ?? item.rows ?? 0) })),
      relationships: relationEvidence(asset), inputContentFingerprint: `${asset.scenarioId}-INPUT-${primarySnapshot.sha256.slice(0, 12)}`,
      memberContractFingerprint: `${asset.scenarioId}-MEMBERS-${asset.members.length}`, relationshipContractFingerprint: `${asset.scenarioId}-RELATIONS-${(asset.relationshipContracts || []).length}`,
      businessOutputFingerprint: `${asset.scenarioId}-OUTPUT-${versionId}`, dataQualification: "合格", evidenceIntegrity: "完整", contentAccess: "可访问",
      t018Status: "可消费候选", t019Status: "已采用", t019Owner: "本体管理", t019EvidenceId, t019BindingId: t019EvidenceId,
      refreshStatus: "已采用", consumptionStatus: "消费就绪", portfolioCompleted: true,
      bindingTrustSummary: { id: `TRUST-BIND-${versionId}`, version: "v1.0", formedAt: asset.publishedAt, assetVersionId: versionId, asOf: asset.asOf, quality: "通过", evidenceRefs, note: "发布时的数据版本、时点、质量和来源证据已固定。" },
      currentTrustSummaries: [{ id: `TRUST-STATE-${versionId}-01`, version: "v1.0", formedAt: asset.publishedAt, currentAuthorityVersionId: versionId, refreshRequestId: requestId, refreshResultId: resultId, t018Status: "可消费候选", t019EvidenceId, retentionPolicyId: "平台标准保留策略", retentionPolicyVersion: "1.0", dimensions: { versionLocation: "可定位", contentAccess: "可访问", evidenceIntegrity: "完整", replayCapability: "可按固定输入重放", replayVerification: "一致" } }]
    };
  }

  function completedInputs(definition) {
    return definition.nodes.filter((node) => node.key === "source").map((node) => {
      const source = sourceIndex[node.sourceId];
      const item = source.snapshots[0];
      return {
        nodeId: node.id,
        slotId: node.inputSlotId,
        slot: node.inputSlotId === "main" ? "主输入" : "参考输入",
        kind: "原始数据源",
        resourceId: source.id,
        resourceName: source.name,
        name: source.name,
        version: item.snapshotId,
        snapshot: item.fileName,
        asOf: item.asOf,
        fingerprint: item.sha256,
        memberScope: "全部成员",
        gate: "正式运行已锁定"
      };
    });
  }

  function completedNodeExecutions(definition, inputs, asset, version, requestId) {
    const nodeNames = { python: "Python 处理", quality: "数据检查", publish: "发布数据资产", refresh: "提交本体刷新请求" };
    return definition.nodes.map((node) => {
      const input = inputs.find((item) => item.nodeId === node.id);
      let inputSummary = `${inputs.length} 个已锁定输入`;
      let outputSummary = `${asset.members.length} 个成员 · ${(asset.relationshipContracts || []).length} 条关系`;
      if (node.key === "source") {
        inputSummary = input?.version || "输入快照不可定位";
        outputSummary = `${input?.snapshot || "来源文件不可定位"} · 精确输入已锁定`;
      } else if (node.key === "quality") {
        inputSummary = outputSummary;
        outputSummary = "全部发布前检查通过";
      } else if (node.key === "publish") {
        inputSummary = `${version.qualityId} · 允许发布`;
        outputSummary = version.id;
      } else if (node.key === "refresh") {
        inputSummary = version.id;
        outputSummary = `${requestId} · 已取得正式采用证据`;
      }
      return {
        id: node.id,
        key: node.key,
        name: node.key === "source" ? `数据源 · ${input?.name || "已锁定来源"}` : nodeNames[node.key],
        status: node.key === "refresh" ? "消费就绪" : "成功",
        startedAt: formedAt,
        endedAt: formedAt,
        inputSummary,
        outputSummary
      };
    });
  }

  function replaceExactString(value, from, to) {
    if (value === from) return to;
    if (Array.isArray(value)) return value.map((item) => replaceExactString(item, from, to));
    if (value && typeof value === "object") {
      Object.keys(value).forEach((key) => { value[key] = replaceExactString(value[key], from, to); });
    }
    return value;
  }

  const definitions = pipelines.map(buildDefinition);
  pipelines.forEach((pipeline) => { pipeline.nodeCount = definitions.find((item) => item.pipelineId === pipeline.id).nodes.length; });

  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch (_) { stored = null; }
  const flow = clone(stored?.portfolioSchema === PORTFOLIO_SCHEMA ? stored : seed);
  flow.portfolioSchema = PORTFOLIO_SCHEMA;
  flow.publishedDefinitions = [...(flow.publishedDefinitions || []).filter((item) => item.scenarioContext?.scenarioId === "S001"), ...definitions.filter((item) => item.scenarioContext.scenarioId !== "S001")];
  flow.runs = (flow.runs || []).filter((item) => item.scenarioContext?.scenarioId === "S001");
  flow.assetVersions = (flow.assetVersions || []).filter((item) => item.scenarioContext?.scenarioId === "S001" || item.targetAssetId === "FIN-ASSET");
  flow.refreshAttempts = (flow.refreshAttempts || []).filter((item) => item.scenarioContext?.scenarioId === "S001" || item.assetVersionId?.startsWith("FIN-ASSET"));
  flow.authorityVersionIds = flow.authorityVersionIds && typeof flow.authorityVersionIds === "object" ? flow.authorityVersionIds : {};
  flow.currentSnapshotSelections = flow.currentSnapshotSelections && typeof flow.currentSnapshotSelections === "object" ? flow.currentSnapshotSelections : {};
  flow.currentSnapshotReadEvents = flow.currentSnapshotReadEvents && typeof flow.currentSnapshotReadEvents === "object" ? flow.currentSnapshotReadEvents : {};
  flow.uploadedSnapshots = (flow.uploadedSnapshots || []).filter((entry) => entry.sourceId !== "finance-workbook" || entry.snapshot?.snapshotId === financeSnapshot.snapshotId);
  replaceExactString(flow, "融资一览表_一期演示数据.xlsx", financeSnapshot.fileName);
  flow.assetVersions.forEach((version) => {
    if (version.targetAssetId !== "FIN-ASSET" || version.t019Status !== "已采用") return;
    Object.assign(version, {
      portfolioCompleted: true,
      consumptionStatus: "消费就绪",
      refreshStatus: "已采用",
      sourceSnapshot: financeSnapshot.fileName,
      sourceSnapshotId: financeSnapshot.snapshotId,
      sourceHash: financeSnapshot.sha256,
      asOf: financeSnapshot.asOf
    });
    const run = flow.runs.find((item) => item.id === version.runId);
    const definition = flow.publishedDefinitions.find((item) => item.pipelineId === "finance-pipeline" && item.id === version.definitionVersion);
    if (run && definition) {
      const inputs = completedInputs(definition);
      const requestId = flow.refreshAttempts.find((item) => item.assetVersionId === version.id)?.requestId || `REFRESH-${version.id}`;
      Object.assign(run, {
        pipelineId: "finance-pipeline",
        pipelineName: "融资数据标准化与发布",
        targetAssetId: "FIN-ASSET",
        status: "成功",
        executionStatus: "成功",
        closureStatus: "消费就绪",
        quality: "通过",
        assetVersion: version.id,
        asOf: financeSnapshot.asOf,
        inputs,
        nodeExecutions: completedNodeExecutions(definition, inputs, financeAssetBase, version, requestId),
        closedLoopEndedAt: run.closedLoopEndedAt || formedAt
      });
    }
  });
  const currentFinanceVersion = flow.assetVersions.find((version) => version.id === flow.authorityVersionIds["FIN-ASSET"] && version.t019Status === "已采用");
  if (currentFinanceVersion && flow.currentRunId === currentFinanceVersion.runId) {
    flow.runStatus = "ready";
    flow.qualityStatus = "passed";
    flow.refreshStatus = "adopted";
    flow.consumptionStatus = "ready";
    flow.candidateVersionId = "";
  }
  [financeSource, ...s002PhysicalSources, riskSource, ...s004Files].forEach((source) => { flow.currentSnapshotSelections[source.id] = source.snapshots[0].snapshotId; });

  pipelines.filter((pipeline) => pipeline.scenarioId !== "S001").forEach((pipeline) => {
    const definition = definitions.find((item) => item.pipelineId === pipeline.id);
    const asset = assetIndex[pipeline.targetAssetId];
    const runId = pipelineRunIds[pipeline.id];
    const version = completedVersion(asset, pipeline, definition, runId);
    const inputs = completedInputs(definition);
    const requestId = `REFRESH-${version.id}`;
    flow.runs.push({ id: runId, pipelineId: pipeline.id, pipelineName: pipeline.name, scenarioId: pipeline.scenarioId, scenarioContext: contextOf(pipeline.scenarioId), definitionVersion: definition.id, targetAssetId: asset.t006Id, trigger: "手工正式运行", startedAt: formedAt, executionEndedAt: formedAt, closedLoopEndedAt: formedAt, status: "成功", executionStatus: "成功", closureStatus: "消费就绪", quality: "通过", qualityId: version.qualityId, assetVersion: version.id, asOf: version.asOf, inputs, nodeExecutions: completedNodeExecutions(definition, inputs, asset, version, requestId) });
    flow.assetVersions.push(version);
    flow.authorityVersionIds[asset.t006Id] = version.id;
    flow.refreshAttempts.push({ requestId, resultId: `MATCH-${version.id}`, runId, assetVersionId: version.id, scenarioContext: contextOf(pipeline.scenarioId), ontologyBindingId: `TARGET-${pipeline.scenarioId}-${asset.t006Id}`, target: `${sceneName(pipeline.scenarioId)}本体 · 数据刷新目标`, targetT017: registry.ontology[pipeline.scenarioId]?.publishedVersion || `${pipeline.scenarioId}-SEMANTIC-v1`, sourceMappingVersion: `${pipeline.scenarioId}-MAPPING-v1`, requestStatus: "已受理", resultStatus: "成功", t018Status: "可消费候选", t018EvidenceId: `T018-${version.id}`, t019Status: "已采用", t019EvidenceId: version.t019EvidenceId, createdAt: formedAt, acceptedAt: formedAt, resultAt: formedAt, adoptedAt: formedAt, events: [{ stage: "正式采用", status: "成功", at: formedAt, evidenceId: version.t019EvidenceId }] });
  });

  const portfolio = clone(base);
  portfolio.sourceGroups = [
    { key: "手工工作簿", label: "手工工作簿", status: "可用", description: "由业务人员上传并按内容形成不可变快照。" },
    { key: "财务报表", label: "财务报表", status: "可用", description: "按年度登记并保留原始正式报告。" },
    { key: "业务资料包", label: "业务资料包", status: "可用", description: "按业务申请归集资料并形成独立快照。" }
  ];
  portfolio.sources = [financeSource, ...s002PhysicalSources, riskSource, ...s004Files];
  portfolio.workbooks = {
    ...clone(base.workbooks), ...clone(s002.workbooks),
    s004Annual: { label: "借款人年度报告", note: "年度报告按年度独立登记，抽取结果保留原文定位。", sheets: [{ id: "s004-annual", name: "年度报告事实", input: true, range: "年度报告", headerRow: 1, rows: 1, cols: 6, classification: "正式财务资料", fields: ["年度", "资产总计", "负债合计", "营业收入", "净利润", "经营现金流"], sampleColumns: ["年度", "资产总计", "负债合计", "营业收入"], samples: [[2025, 4430.76, 2614.72, 868.21]] }] },
    s004Pack: { label: "贷前调查资料包", note: "申请事实、外部资料与人工输入分层留存。", sheets: [{ id: "s004-application", name: "贷款申请", input: true, range: "A1:J2", headerRow: 1, rows: 1, cols: 10, classification: "贷款申请事实", fields: ["申请编号", "借款人", "产品类型", "申请金额", "期限", "用途"], sampleColumns: ["申请编号", "借款人", "申请金额", "用途"], samples: [["APP-S004-20260815-0001", "中国广核电力股份有限公司", 100000, "经营周转"]] }] }
  };
  portfolio.workbooks.finance.label = "集团融资业务数据_2025.xlsx";
  portfolio.workbooks.finance.note = "融资明细与单位负责人映射作为业务输入，说明页不进入管道处理。";
  portfolio.workbooks.s003.label = "企业债务风险评估数据_2025.xlsx";
  portfolio.workbooks.s003.note = "财务数据与调节因子作为同一来源快照中的两个业务成员。";
  portfolio.workbooks.finance.sheets.forEach((sheet) => {
    sheet.samples = (sheet.samples || []).map((row) => row.map((value) => typeof value === "string"
      ? value.replace(/^演示单位/, "单位").replace(/^演示环球银行$/, "环球银行").replace(/^演示亚太银行$/, "亚太银行").replace(/^演示海岸银行$/, "海岸银行").replace(/^演示/, "")
      : value));
  });
  portfolio.targetAssets = assets;
  portfolio.pipelines = pipelines;
  window.DE_DATA = portfolio;
  window.OFW_M02_PORTFOLIO_FLOW = clone(flow);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(flow)); } catch (_) {}

  const sourceScenes = Object.fromEntries(portfolio.sources.map((item) => [item.id, item.scenarioId]));
  const assetScenes = Object.fromEntries(portfolio.targetAssets.map((item) => [item.name, item.scenarioId]));
  const pipelineScenes = Object.fromEntries(portfolio.pipelines.map((item) => [item.name, item.scenarioId]));
  let currentFilter = "ALL";
  let scheduled = false;
  function badge(node, scenarioId) {
    if (!node || !/^S00[1-4]$/.test(scenarioId) || node.querySelector(":scope > .portfolio-scene-badge")) return;
    const item = document.createElement("span"); item.className = "portfolio-scene-badge"; item.dataset.scene = scenarioId; item.textContent = scenarioId; node.append(item);
  }
  function mark(node, scenarioId) {
    if (!node || !scenarioId) return;
    node.dataset.ofwScene = scenarioId;
    node.dataset.ofwPortfolioHidden = currentFilter !== "ALL" && scenarioId !== currentFilter ? "true" : "false";
  }
  function installFilter() {
    const actions = document.querySelector(".page-header .header-actions");
    if (!actions || actions.querySelector("[data-portfolio-filter]")) return;
    const label = document.createElement("label");
    label.className = "portfolio-filter"; label.dataset.portfolioFilter = "true";
    label.innerHTML = `<span>业务范围</span><select aria-label="筛选业务范围"><option value="ALL">全部业务</option>${registry.scenes.map((scene) => `<option value="${scene.scenarioId}">${scene.name}</option>`).join("")}</select>`;
    label.querySelector("select").value = currentFilter;
    label.querySelector("select").addEventListener("change", (event) => { currentFilter = event.target.value; apply(); });
    actions.prepend(label);
  }
  function apply() {
    scheduled = false; installFilter();
    document.querySelectorAll(".source-card[data-id]").forEach((node) => { const scene = sourceScenes[node.dataset.id]; mark(node, scene); badge(node.querySelector(".source-card-head > div"), scene); });
    document.querySelectorAll(".source-resource-table tbody tr").forEach((row) => { const id = row.querySelector("[data-id]")?.dataset.id; const name = row.querySelector("strong")?.textContent?.trim(); const source = portfolio.sources.find((item) => item.id === id || item.name === name); mark(row, source?.scenarioId); badge(row.querySelector(".table-resource-name > div"), source?.scenarioId); });
    document.querySelectorAll(".asset-card").forEach((node) => { const scene = assetScenes[node.querySelector("h3")?.textContent?.trim()]; mark(node, scene); badge(node.querySelector("h3")?.parentElement, scene); });
    document.querySelectorAll(".asset-resource-table tbody tr").forEach((row) => { const scene = assetScenes[row.querySelector("strong")?.textContent?.trim()]; mark(row, scene); badge(row.querySelector(".table-resource-name > div"), scene); });
    document.querySelectorAll(".pipeline-card").forEach((node) => { const scene = pipelineScenes[node.querySelector("h3")?.textContent?.trim()]; mark(node, scene); badge(node.querySelector("h3")?.parentElement, scene); });
    document.querySelectorAll(".source-group").forEach((group) => { const children = [...group.querySelectorAll("[data-ofw-scene]")]; group.dataset.ofwPortfolioHidden = children.length && children.every((child) => child.dataset.ofwPortfolioHidden === "true") ? "true" : "false"; });
  }
  function schedule() { if (scheduled) return; scheduled = true; requestAnimationFrame(apply); }
  function startProjection() { addEventListener("hashchange", schedule); window.setInterval(schedule, 360); schedule(); }
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", startProjection, { once: true }); else startProjection();
})();
