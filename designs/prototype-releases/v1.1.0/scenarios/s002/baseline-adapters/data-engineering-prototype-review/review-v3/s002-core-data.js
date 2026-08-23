(() => {
  "use strict";

  const D = window.DE_DATA;
  if (!D) return;

  const formedAt = "2026-08-15T15:55:00.000Z";
  const sourceFiles = [
    ["SRC-2024-ACTUAL", "DS-ACTUAL-EXECUTION", "2024年实际执行.xlsx", "data_v5", "2024-12-31", 161, 20966, "5064556a172d2e91dbc33454987ae12caab2849f00a2888c6646559b50ba92a7", "2024实际执行、年末计提"],
    ["SRC-2025-ACTUAL", "DS-ACTUAL-EXECUTION", "2025年实际执行.xlsx", "data_v5", "2025-12-31", 203, 23249, "2714661fa34651bc01332fa6f58c2f0259357385ac5ef77a2dacaae6b1eb69d2", "2025实际执行、次年确认"],
    ["SRC-2024-BUDGET", "DS-APPROVED-BUDGET", "2024年预算下达明细.xlsx", "FY2024-APPROVED-FINAL-v1", "2024-01-15", 30, 10929, "29b6a7060f504ba8c96c019e0cb9a295c734e02e6afc70f86d59d628590d3438", "2024最终批准预算"],
    ["SRC-2025-BUDGET", "DS-APPROVED-BUDGET", "2025年预算下达明细.xlsx", "FY2025-APPROVED-FINAL-v1", "2025-01-15", 30, 11012, "e194594c61cb27a5c4355a6e8f75d9c463ccf1686e0def5715921eca8d137c79", "2025最终批准预算"],
    ["SRC-2025-SUBMISSION", "DS-INITIAL-SUBMISSION", "2025年预算申报明细汇总.xlsx", "FY2025-INITIAL-SUBMISSION-v1", "2024-10-31", 64, 22622, "850af12aaece5fe14adb7c2609018a618e64018fc36724ff7f5f3ea3b51e441a", "2025部门最初申报"],
    ["SRC-2026-SUBMISSION", "DS-INITIAL-SUBMISSION", "2026年预算申报明细汇总.xlsx", "FY2026-INITIAL-SUBMISSION-v1", "2025-10-31", 64, 22929, "85f0ce556faad8d0ef51b3bf7a5f49dc73508321d75f419db6f6bafd8427827f", "2026部门最初申报"],
    ["SRC-2025-COMMITMENT", "DS-PROJECT-COMMITMENT", "2025年预算占用.XLSX", "data_v5", "2025-12-31", 108, 15900, "af94789f3ac8238ffd076c9006f5a29a096978ce182284efd5478994f249d20a", "PR/PO占用及释放事件"],
    ["SRC-PROJECT-USE", "DS-PROJECT-USE", "项目预算使用情况表.xlsx", "derived-2025-12-31", "2025-12-31", 21, 5605, "36bbb71e67f995ce815703528b9cb1a062df02caa4f816581369a00b7b536d1c", "项目立项金额及源已使用值"]
  ].map(([snapshotId, sourceId, fileName, version, asOf, rows, sizeBytes, hash, scope]) => {
    const logicalMembers = snapshotId.includes("SUBMISSION")
      ? ["收入成本预算汇总表", "市场项目预算明细", "部门公共费用明细", "技术配置"]
      : ["Sheet"];
    const rangeBySnapshot = {
      "SRC-2024-ACTUAL": "Sheet!A1:L162",
      "SRC-2025-ACTUAL": "Sheet!A1:L204",
      "SRC-2024-BUDGET": "Sheet!A1:I31",
      "SRC-2025-BUDGET": "Sheet!A1:I31",
      "SRC-2025-SUBMISSION": "4个逻辑成员",
      "SRC-2026-SUBMISSION": "4个逻辑成员",
      "SRC-2025-COMMITMENT": "Sheet!A1:L109",
      "SRC-PROJECT-USE": "Sheet!A1:D22"
    };
    return {
    snapshotId, t002Id: snapshotId, sourceId, logicalSourceId: sourceId, fileName, file: fileName, version, asOf, rows,
    sizeBytes, size: `${new Intl.NumberFormat("zh-CN").format(sizeBytes)} 字节`, hash, sha256: hash, scope, purpose: scope,
    logicalMembers, range: rangeBySnapshot[snapshotId] || "已核验范围", sensitivity: "内部财务中高敏感",
    downloadHref: `../../../data/source-files/${encodeURIComponent(fileName)}`,
    acquiredAt: formedAt, readStartedAt: formedAt, readCompletedAt: formedAt,
    readDurationMs: 1, structureStatus: "结构已核验", status: "已登记",
    marker: "SOURCE", copyKind: "ORIGINAL_SOURCE_COPY"
    };
  });

  const snapshotsFor = (sourceId) => sourceFiles.filter((item) => item.sourceId === sourceId).map((item, index, list) => ({
    ...item, current: index === list.length - 1
  }));
  const source = (id, name, category, description, workbookKey, pipelineIds) => {
    const snapshots = snapshotsFor(id);
    const latest = snapshots.at(-1);
    const downstreamAssets = pipelineIds.map((pipelineId) => pipelineId === "S002-PIPE-BUDGET-v1"
      ? { id: "s002-budget-execution-asset", name: "预算编制与执行数据资产", version: "S002-BUDGET-EXEC-v1", status: "消费就绪" }
      : { id: "s002-project-occupancy-asset", name: "项目预算占用与余额数据资产", version: "S002-PROJECT-OCC-v1", status: "消费就绪" });
    return {
      id, name, category, access: "按需上传工作簿", description,
      sourceType: category, connection: "手工工作簿", purpose: description,
      registration: "本轮快照已确认 · 可运行", latestAcquired: "2026-08-15 · 已登记",
      asOf: latest?.asOf || "2025-12-31", snapshotCount: snapshots.length,
      syncPlan: "按需上传新快照", nextSync: "由用户上传触发", lastSync: "2026-08-15 · 最近成功读取",
      enabled: true, selectable: true, workbookKey, fileName: latest?.fileName || "",
      physicalEvidence: `${snapshots.length} 个不可变来源快照已锁定；下载为只读操作`, snapshots,
      pipelineRefs: pipelineIds.map((pipelineId) => ({ pipelineId, name: pipelineId === "S002-PIPE-BUDGET-v1" ? "预算编制与执行标准化管道" : "项目预算余额与采购占用标准化管道", definition: pipelineId, node: name, lastRun: `RUN-${pipelineId}` })),
      downstreamAssets
    };
  };

  D.sourceGroups = [{ key: "手工工作簿", label: "手工工作簿", status: "可用", description: "按业务对象登记逻辑数据源；年度文件作为不可变快照持续追加。" }];
  D.sources = [
    source("DS-ACTUAL-EXECUTION", "实际执行明细", "手工工作簿", "形成2024/2025实际执行、计提与跨期确认事实。", "s002Actual", ["S002-PIPE-BUDGET-v1", "S002-PIPE-PROJECT-v1"]),
    source("DS-APPROVED-BUDGET", "预算下达明细", "手工工作簿", "形成2024/2025最终批准预算；任何Action均不得覆盖该来源。", "s002Approved", ["S002-PIPE-BUDGET-v1"]),
    source("DS-INITIAL-SUBMISSION", "预算申报明细", "手工工作簿", "形成2025/2026部门最初申报、技术配置报价及合理性评价输入。", "s002Submission", ["S002-PIPE-BUDGET-v1", "S002-PIPE-PROJECT-v1"]),
    source("DS-PROJECT-COMMITMENT", "项目预算占用", "手工工作簿", "形成PR/PO占用、释放与年末集中度的原子事件。", "s002Commitment", ["S002-PIPE-PROJECT-v1"]),
    source("DS-PROJECT-USE", "项目预算使用表", "手工工作簿", "形成项目立项金额与源已使用值；实际、计提从实际执行来源回链。", "s002ProjectUse", ["S002-PIPE-PROJECT-v1"])
  ];

  const sheet = (id, name, rows, fields, sampleColumns, samples, classification = "业务输入") => ({
    id, name, input: true, range: `${name}!A1:${String.fromCharCode(64 + Math.min(fields.length, 26))}${rows + 1}`,
    headerRow: 1, rows, cols: fields.length, classification, fields, sampleColumns, samples
  });
  const actualFields = ["凭证行标识","凭证号","行号","主体编码","科目编码","项目标识","源会计期间","修正会计期间","源业务日期","修正业务日期","入账日期","实际金额","计提标识","数据标识"];
  const budgetFields = ["预算版本标识","预算年度","主体编码","科目编码","期间","预算金额","版本类型","预算情景","批准状态","币种","金额单位","税口径","数据标识"];
  const quoteFields = ["年度","主体编码","项目标识","供应商编码","服务类别","服务级别","计价单位","税率","服务月数","单价","报价金额","币种","数据标识"];
  D.workbooks = {
    s002Actual: { label: "实际执行明细", note: "合法重复凭证保留；期间和日期修正同时保留源值、修正值与CORRECTED标识。", sheets: [sheet("actual-detail", "实际执行明细", 420, actualFields, ["凭证行标识","主体编码","科目编码","项目标识","实际金额","数据标识"], [["V2025-0001-01","ORG-SB","EXP-TRAVEL","PRJ-SB-01",12.64,"SOURCE"],["V2025-0042-02","ORG-AQ","EXP-SERVICE","PRJ-AQ-01",18.20,"CORRECTED"]], "财务执行事实")] },
    s002Approved: { label: "预算下达明细", note: "2024/2025下达均为最终批准预算，保持只读。", sheets: [sheet("approved-budget", "预算下达明细", 60, budgetFields, ["预算年度","主体编码","科目编码","预算金额","版本类型"], [[2025,"ORG-SB","EXP-TRAVEL",404.50,"最终批准"],[2025,"ORG-AQ","REV-SERVICE",300.00,"最终批准"]], "最终批准预算事实")] },
    s002Submission: { label: "预算申报明细", note: "2025/2026为部门最初申报；技术配置保留报价原子字段，可比倍率由M01计算。", sheets: [
      sheet("submission-summary", "收入成本预算汇总表", 6, budgetFields, ["预算年度","主体编码","预算金额","版本类型"], [[2026,"ORG-JS",1765.94,"部门初始申报"]], "初始申报事实"),
      sheet("submission-project", "市场项目预算明细", 42, ["预算年度","主体编码","项目标识","科目编码","预算金额","币种","金额单位","税口径","数据标识"], ["预算年度","主体编码","项目标识","预算金额"], [[2026,"ORG-SB","PRJ-SB-01",336.404]], "项目申报事实"),
      sheet("submission-public", "部门公共费用明细", 12, ["预算年度","主体编码","科目编码","预算金额","补数说明","数据标识"], ["预算年度","主体编码","科目编码","预算金额","数据标识"], [[2026,"ORG-SB","EXP-PUBLIC",5.22,"SYNTHETIC_FOR_DEMO"]], "公共费用申报"),
      sheet("submission-quote", "技术配置", 64, quoteFields, ["供应商编码","服务类别","服务级别","计价单位","税率","服务月数","单价"], [["SUP-003","技术服务","高级","人月",0.06,6,2.50]], "供应商报价原子事实")
    ] },
    s002Commitment: { label: "项目预算占用", note: "只保存采购发起/占用/释放原子事件和方向，不计算净在途或集中度。", sheets: [sheet("commitment-events", "项目预算占用", 108, ["采购事件标识","项目标识","供应商编码","发起日期","变动方向","发起金额","币种","金额单位","数据标识"], ["采购事件标识","项目标识","发起日期","变动方向","发起金额"], [["PO-2025-001","PRJ-AQ-01","2025-12-08","正向",23.45]], "采购占用事件")] },
    s002ProjectUse: { label: "项目预算使用表", note: "源表只提供项目标识、立项金额和源已使用值；其余分量必须从实际执行与占用事件回链。", sheets: [sheet("project-use", "项目预算使用表", 21, ["项目标识","项目名称","主体编码","预算版本标识","立项金额","源已使用金额","币种","金额单位","数据标识"], ["项目标识","项目名称","立项金额","源已使用金额"], [["PRJ-AQ-01","概率安全分析",124.00,144.5038]], "项目预算原子事实")] }
  };

  const field = (fieldId, name, type, role, description, nullable = false) => ({ fieldId, name, type, nullable, role, description });
  const member = (id, name, grain, key, identityFieldId, rowCount, fields) => ({ id, name, grain, key, identityFieldId, rowCount, fields });
  const relation = (id, name, sourceMemberId, sourceFieldId, targetMemberId, targetFieldId, scope = "asset-internal") => ({ id, name, sourceMemberId, sourceFieldId, targetMemberId, targetFieldId, scope });
  const budgetMembers = [
    member("MEM-S002-BUDGET-SUBJECT", "预算主体", "一行一预算主体", "主体编码", "PROP-S002-SUBJECT-CODE", 3, [field("PROP-S002-SUBJECT-CODE","主体编码","文本标识","主键","预算主体稳定身份"),field("PROP-S002-SUBJECT-NAME","主体名称","文本","展示字段","预算主体名称"),field("PROP-S002-SUBJECT-TYPE","主体类型","枚举","分类字段","单位或公司")]),
    member("MEM-S002-BUDGET-VERSION", "预算版本与明细", "一行一主体-年度-版本-科目-期间预算事实", "预算版本明细标识", "PROP-S002-VERSION-DETAIL-ID", 188, [field("PROP-S002-VERSION-DETAIL-ID","预算版本明细标识","文本标识","主键","预算事实稳定身份"),field("PROP-S002-VERSION-ID","预算版本标识","文本标识","版本键","年度主体版本身份"),field("PROP-S002-VERSION-NAME","预算版本名称","文本","展示字段","最终批准或初始申报"),field("PROP-S002-VERSION-YEAR","预算年度","整数","期间字段","预算年度"),field("PROP-S002-VERSION-TYPE","版本类型","枚举","分类字段","最终批准或初始申报"),field("PROP-S002-VERSION-SCENARIO","预算情景","枚举","分类字段","批准或申报"),field("PROP-S002-VERSION-STATUS","批准状态","枚举","状态字段","最终批准保持只读"),field("PROP-S002-VERSION-SUBJECT","主体编码","文本标识","外键","关联预算主体"),field("PROP-S002-VERSION-ACCOUNT","科目编码","文本标识","外键","关联预算科目"),field("PROP-S002-VERSION-PERIOD","期间","文本","期间字段","预算期间"),field("PROP-S002-VERSION-AMOUNT","预算金额","十进制数","事实字段","CNY万元"),field("PROP-S002-VERSION-CURRENCY","币种","文本","口径字段","CNY"),field("PROP-S002-VERSION-UNIT","金额单位","文本","口径字段","万元"),field("PROP-S002-VERSION-TAX-BASIS","税口径","枚举","口径字段","费用不含税"),field("PROP-S002-VERSION-MARKER","数据标识","枚举","沿袭字段","SOURCE或演示加工标识")]),
    member("MEM-S002-BUDGET-ACCOUNT", "预算科目", "一行一稳定预算科目", "科目编码", "PROP-S002-ACCOUNT-CODE", 10, [field("PROP-S002-ACCOUNT-CODE","科目编码","文本标识","主键","预算科目稳定身份"),field("PROP-S002-ACCOUNT-NAME","科目名称","文本","展示字段","预算科目名称"),field("PROP-S002-ACCOUNT-CATEGORY","科目类别","枚举","分类字段","收入、成本或费用"),field("PROP-S002-ACCOUNT-TAX-BASIS","税口径","枚举","口径字段","费用不含税")]),
    member("MEM-S002-ACTUAL-VOUCHER", "实际凭证", "一行一合法凭证或授权加工记录", "凭证行标识", "PROP-S002-VOUCHER-ID", 420, [field("PROP-S002-VOUCHER-ID","凭证行标识","文本标识","主键","保留合法重复记录"),field("PROP-S002-VOUCHER-NO","凭证号","文本","展示字段","原始凭证号"),field("PROP-S002-VOUCHER-SUBJECT","主体编码","文本标识","外键","预算主体"),field("PROP-S002-VOUCHER-ACCOUNT","科目编码","文本标识","外键","预算科目"),field("PROP-S002-VOUCHER-PROJECT","项目标识","文本标识","外键","跨资产关联项目"),field("PROP-S002-VOUCHER-PERIOD","会计期间","文本","期间字段","源值与修正值并存"),field("PROP-S002-VOUCHER-BUSINESS-DATE","业务日期","日期","期间字段","业务发生日期"),field("PROP-S002-VOUCHER-POSTING-DATE","入账日期","日期","期间字段","入账日期"),field("PROP-S002-VOUCHER-AMOUNT","实际金额","十进制数","事实字段","CNY万元费用不含税"),field("PROP-S002-VOUCHER-ACCRUAL-AMOUNT","未结计提金额","十进制数","事实字段","可回链的未结计提原子事实"),field("PROP-S002-VOUCHER-SOURCE","源值","文本","沿袭字段","原始值"),field("PROP-S002-VOUCHER-CORRECTED","修正值","文本","沿袭字段","授权修正值"),field("PROP-S002-VOUCHER-MARKER","数据标识","枚举","沿袭字段","SOURCE、CORRECTED或SYNTHETIC_FOR_DEMO")])
  ];
  const projectMembers = [
    member("MEM-S002-PROJECT-OCCUPANCY", "项目占用", "一行一项目预算原子事实", "项目标识", "PROP-S002-PROJECT-ID", 21, [field("PROP-S002-PROJECT-ID","项目标识","文本标识","主键","项目稳定身份"),field("PROP-S002-PROJECT-NAME","项目名称","文本","展示字段","项目名称"),field("PROP-S002-PROJECT-SUBJECT","主体编码","文本标识","外键","预算主体"),field("PROP-S002-PROJECT-VERSION","预算版本标识","文本标识","外键","最终批准预算版本"),field("PROP-S002-PROJECT-AMOUNT","立项金额","十进制数","事实字段","源立项金额"),field("PROP-S002-PROJECT-SOURCE-USED","源已使用金额","十进制数","事实字段","源表已使用"),field("PROP-S002-PROJECT-ACTUAL","实际金额","十进制数","事实字段","从实际凭证按项目汇总"),field("PROP-S002-PROJECT-ACCRUED","未结计提","十进制数","事实字段","从实际执行计提事实汇总"),field("PROP-S002-PROJECT-MARKER","数据标识","枚举","沿袭字段","SOURCE或演示加工标识")]),
    member("MEM-S002-PURCHASE-INITIATION", "采购发起", "一行一采购发起、占用或释放原子事件", "采购事件标识", "PROP-S002-PURCHASE-ID", 108, [field("PROP-S002-PURCHASE-ID","采购事件标识","文本标识","主键","采购事件稳定身份"),field("PROP-S002-PURCHASE-NAME","采购事项","文本","展示字段","采购事项"),field("PROP-S002-PURCHASE-PROJECT","项目标识","文本标识","外键","项目"),field("PROP-S002-PURCHASE-SUPPLIER","供应商编码","文本标识","外键","供应商"),field("PROP-S002-PURCHASE-DATE","发起日期","日期","期间字段","事件日期"),field("PROP-S002-PURCHASE-DIRECTION","变动方向","枚举","分类字段","正向或释放"),field("PROP-S002-PURCHASE-AMOUNT","发起金额","十进制数","事实字段","带方向的原子金额"),field("PROP-S002-PURCHASE-SERVICE-CATEGORY","服务类别","文本","可比键","供应商可比组"),field("PROP-S002-PURCHASE-SERVICE-LEVEL","服务级别","文本","可比键","供应商可比组"),field("PROP-S002-PURCHASE-PRICING-UNIT","计价单位","文本","可比键","供应商可比组"),field("PROP-S002-PURCHASE-TAX-RATE","税率","十进制数","可比键","供应商可比组"),field("PROP-S002-PURCHASE-SERVICE-MONTHS","服务月数","十进制数","可比键","供应商可比组"),field("PROP-S002-PURCHASE-UNIT-PRICE","单价","十进制数","事实字段","原子报价单价"),field("PROP-S002-PURCHASE-CURRENCY","币种","文本","可比键","CNY"),field("PROP-S002-PURCHASE-MARKER","数据标识","枚举","沿袭字段","SOURCE或演示加工标识")]),
    member("MEM-S002-SUPPLIER", "供应商", "一行一供应商", "供应商编码", "PROP-S002-SUPPLIER-CODE", 4, [field("PROP-S002-SUPPLIER-CODE","供应商编码","文本标识","主键","供应商身份"),field("PROP-S002-SUPPLIER-NAME","供应商名称","文本","展示字段","供应商名称"),field("PROP-S002-SUPPLIER-CATEGORY","供应商类别","枚举","分类字段","供应商类别")])
  ];
  const assetBase = (id, t006Id, name, purpose, version, members, relationships) => ({
    id, t006Id, name, scene: "S002", purpose, owner: "M02 数据工程", published: true,
    status: "消费就绪", versionCount: 1, currentVersion: version, currentAuthoritativeVersion: version,
    asOf: "2025-12-31", quality: "通过", publishedAt: "2026-08-15 16:03:20", consumptionStatus: "消费就绪",
    members, relationshipContracts: relationships, relationships: relationships.map((item) => item.name),
    detailViews: [{key:"overview",label:"版本概览"},{key:"members",label:"包含的数据"},{key:"lineage",label:"如何产生"},{key:"consumption",label:"如何变为可用"}],
    reusePolicy: { allowed: true, selectionMode: "显式选择精确版本与成员范围", defaultMemberScope: "全部成员", cycleProtection: "禁止同一资产输出回读自身" }
  });
  const budgetRelations = [
    relation("REL-LINK-S002-VERSION-SUBJECT","预算版本明细 → 预算主体","MEM-S002-BUDGET-VERSION","PROP-S002-VERSION-SUBJECT","MEM-S002-BUDGET-SUBJECT","PROP-S002-SUBJECT-CODE"),
    relation("REL-LINK-S002-VERSION-ACCOUNT","预算版本明细 → 预算科目","MEM-S002-BUDGET-VERSION","PROP-S002-VERSION-ACCOUNT","MEM-S002-BUDGET-ACCOUNT","PROP-S002-ACCOUNT-CODE"),
    relation("REL-LINK-S002-VOUCHER-SUBJECT","实际凭证 → 预算主体","MEM-S002-ACTUAL-VOUCHER","PROP-S002-VOUCHER-SUBJECT","MEM-S002-BUDGET-SUBJECT","PROP-S002-SUBJECT-CODE"),
    relation("REL-LINK-S002-VOUCHER-ACCOUNT","实际凭证 → 预算科目","MEM-S002-ACTUAL-VOUCHER","PROP-S002-VOUCHER-ACCOUNT","MEM-S002-BUDGET-ACCOUNT","PROP-S002-ACCOUNT-CODE"),
    relation("REL-LINK-S002-VOUCHER-PROJECT","实际凭证 → 项目占用","MEM-S002-ACTUAL-VOUCHER","PROP-S002-VOUCHER-PROJECT","MEM-S002-PROJECT-OCCUPANCY","PROP-S002-PROJECT-ID","cross-asset")
  ];
  const projectRelations = [
    relation("REL-LINK-S002-PURCHASE-PROJECT","采购发起 → 项目占用","MEM-S002-PURCHASE-INITIATION","PROP-S002-PURCHASE-PROJECT","MEM-S002-PROJECT-OCCUPANCY","PROP-S002-PROJECT-ID"),
    relation("REL-LINK-S002-PURCHASE-SUPPLIER","采购发起 → 供应商","MEM-S002-PURCHASE-INITIATION","PROP-S002-PURCHASE-SUPPLIER","MEM-S002-SUPPLIER","PROP-S002-SUPPLIER-CODE"),
    relation("REL-LINK-S002-PROJECT-VERSION","项目占用 → 预算版本","MEM-S002-PROJECT-OCCUPANCY","PROP-S002-PROJECT-VERSION","MEM-S002-BUDGET-VERSION","PROP-S002-VERSION-ID","cross-asset")
  ];
  D.targetAssets = [
    assetBase("s002-budget-execution-asset","S002-BUDGET-EXECUTION-ASSET","预算编制与执行数据资产","承载最终批准预算、部门初始申报、预算科目和实际执行原子事实。","S002-BUDGET-EXEC-v1",budgetMembers,budgetRelations),
    assetBase("s002-project-occupancy-asset","S002-PROJECT-OCCUPANCY-ASSET","项目预算占用与余额数据资产","承载项目、实际/计提来源、采购占用原子事件和供应商可比报价输入。","S002-PROJECT-OCC-v1",projectMembers,projectRelations)
  ];

  D.pipelines = [
    { id:"S002-PIPE-BUDGET-v1", name:"预算编制与执行标准化管道", purpose:"锁定实际执行、最终批准预算与初始申报快照，保留源值/修正值和数据标识，发布预算编制与执行资产。", definitionState:"已发布定义", definitionVersion:"S002-PIPE-BUDGET-v1", nodeCount:7, source:"3个逻辑数据源 / 6个快照 / 12个逻辑成员", targetAsset:"预算编制与执行数据资产", targetAssetId:"S002-BUDGET-EXECUTION-ASSET", ontologyBindingId:"S002-ONTOLOGY-BINDING-v1", latestRun:"RUN-S002-PIPE-BUDGET-v1 · 成功", schedule:"按需正式运行", canOpen:true },
    { id:"S002-PIPE-PROJECT-v1", name:"项目预算余额与采购占用标准化管道", purpose:"同时读取实际执行、初始申报、项目占用和项目使用原子事实，发布项目预算占用与余额资产；不计算Metric或Rule。", definitionState:"已发布定义", definitionVersion:"S002-PIPE-PROJECT-v1", nodeCount:8, source:"4个逻辑数据源 / 6个快照 / 12个逻辑成员", targetAsset:"项目预算占用与余额数据资产", targetAssetId:"S002-PROJECT-OCCUPANCY-ASSET", ontologyBindingId:"S002-ONTOLOGY-BINDING-v1", latestRun:"RUN-S002-PIPE-PROJECT-v1 · 成功", schedule:"按需正式运行", canOpen:true }
  ];

  const logicalSources = D.sources.map((item) => ({
    id: item.id, name: item.name, sourceType: item.sourceType, connection: item.connection,
    purpose: item.purpose, snapshotIds: item.snapshots.map((snapshot) => snapshot.snapshotId),
    snapshotCount: item.snapshotCount, sensitivity: "内部财务中高敏感",
    pipelineIds: item.pipelineRefs.map((ref) => ref.pipelineId),
    assetVersions: item.downstreamAssets.map((asset) => asset.version)
  }));
  const assetSpecs = D.targetAssets.map((asset) => ({
    assetId: asset.t006Id, localId: asset.id, version: asset.currentVersion, name: asset.name,
    memberCount: asset.members.length, relationshipCount: asset.relationshipContracts.length,
    internalRelationshipCount: asset.relationshipContracts.filter((item) => item.scope !== "cross-asset").length,
    crossAssetRelationshipCount: asset.relationshipContracts.filter((item) => item.scope === "cross-asset").length,
    pipelineId: D.pipelines.find((pipeline) => pipeline.targetAssetId === asset.t006Id)?.id || "",
    sourceCount: D.sources.filter((sourceItem) => sourceItem.downstreamAssets.some((item) => item.version === asset.currentVersion)).length,
    purpose: asset.purpose
  }));
  const pipelineSpecs = D.pipelines.map((pipeline) => {
    const sourceIds = D.sources.filter((item) => item.pipelineRefs.some((ref) => ref.pipelineId === pipeline.id)).map((item) => item.id);
    const snapshots = sourceIds.flatMap((sourceId) => snapshotsFor(sourceId));
    return {
      pipelineId: pipeline.id, definitionId: pipeline.id, name: pipeline.name, targetAssetVersion: D.targetAssets.find((asset) => asset.t006Id === pipeline.targetAssetId)?.currentVersion || "",
      sourceIds, sourceFileIds: snapshots.map((item) => item.snapshotId), sourceNodeCount: sourceIds.length,
      totalNodeCount: sourceIds.length + 4, snapshotCount: snapshots.length,
      logicalMemberCount: snapshots.reduce((sum, item) => sum + item.logicalMembers.length, 0), purpose: pipeline.purpose
    };
  });

  window.S002_CORE_DATA = Object.freeze({
    sourceFiles, sources: D.sources, logicalSources, targetAssets: D.targetAssets, assetSpecs, pipelines: D.pipelines, pipelineSpecs,
    memberRowCounts: Object.freeze({
      "MEM-S002-BUDGET-SUBJECT":3,"MEM-S002-BUDGET-VERSION":188,"MEM-S002-BUDGET-ACCOUNT":10,"MEM-S002-ACTUAL-VOUCHER":420,
      "MEM-S002-PROJECT-OCCUPANCY":21,"MEM-S002-PURCHASE-INITIATION":108,"MEM-S002-SUPPLIER":4
    })
  });
})();
