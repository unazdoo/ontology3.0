window.DE_DATA = {
  sources: [
    {
      id: "src-finance-upload", name: "融资明细一览表", group: "手工上传", type: "手工工作簿", scene: "S001 融资数据闭环",
      description: "一期融资演示的真实工作簿来源", contents: "融资主体、融资明细、金融机构与负责人信息", t008: "2026-08-08",
      updated: "2026-08-09 10:06", status: "可用", authenticity: "real", snapshots: 3, pipelineRefs: 1, assetRefs: 1, canOpen: true
    },
    {
      id: "src-s003-workbook", name: "企业债务风险评估模版", group: "手工上传", type: "手工工作簿", scene: "S003 债务风险监测",
      description: "已完成结构兼容性核验，等待真实登记与受控运行", contents: "财务数据、调节因子", t008: "2025-12-31",
      updated: "2026-08-10 兼容性核验", status: "不可消费", authenticity: "real", snapshots: 0, pipelineRefs: 1, assetRefs: 0, canOpen: true,
      note: "合同已批准·待真实登记和运行"
    },
    { id: "demo-sap-journal", name: "会计凭证行项目", group: "SAP", type: "SAP", scene: "未来扩展", description: "总账凭证明细", contents: "凭证、科目、金额", status: "未真实对接", authenticity: "demo", canOpen: false },
    { id: "demo-sap-account", name: "会计科目主数据", group: "SAP", type: "SAP", scene: "未来扩展", description: "会计科目主数据", contents: "科目编码、名称、层级", status: "未真实对接", authenticity: "demo", canOpen: false },
    { id: "demo-hub-fis", name: "FIS 业务流程表单", group: "数据中台", type: "数据中台", scene: "未来扩展", description: "FIS 表单数据", contents: "流程、表单、状态", status: "未真实对接", authenticity: "demo", canOpen: false },
    { id: "demo-treasury-flow", name: "银行账户流水", group: "司库系统", type: "司库系统", scene: "未来扩展", description: "账户收支流水", contents: "账户、日期、收支金额", status: "未真实对接", authenticity: "demo", canOpen: false },
    { id: "demo-treasury-finance", name: "融资明细", group: "司库系统", type: "司库系统", scene: "未来扩展", description: "司库融资台账", contents: "合同、借据、余额", status: "未真实对接", authenticity: "demo", canOpen: false }
  ],
  assets: [
    {
      id: "asset-finance", name: "融资标准化数据资产", currentVersion: "ASSET-FINANCE@2026.08.08-r2", t008: "2026-08-08",
      members: ["融资主体参考", "融资明细", "金融机构参考", "融资负责人参考"], quality: "有警告·已确认",
      sourceCount: 1, publishedAt: "2026-08-09 10:08", status: "消费就绪", sourceIds: ["src-finance-upload"], reusable: "CR-DE-007-candidate",
      consumers: ["Published 本体 v1.0.0", "智能问数（经权威语义路径）"], owner: "数据工程（T006 / T007 Owner）"
    }
  ],
  pipelines: [
    {
      id: "pipe-finance", name: "融资数据标准化与发布", version: "v1.0", purpose: "将融资工作簿标准化为四成员、三关系的可信数据资产",
      source: "融资明细一览表", sourceId: "src-finance-upload", nodeCount: 4, output: "融资标准化数据资产", outputAssetId: "asset-finance",
      latestRun: "2026-08-09 10:06", runStatus: "成功", modified: "2026-08-09 09:52", runEnabled: true, publishState: "has-history"
    },
    {
      id: "pipe-s003-compat", name: "债务风险输入兼容性验证", version: "评审结构 · 非 T003", purpose: "验证财务数据与调节因子双成员的受控处理和不可消费版本包络；待真实配置，不能运行",
      source: "企业债务风险评估模版", sourceId: "src-s003-workbook", nodeCount: 4, output: "尚未形成数据资产", outputAssetId: null,
      latestRun: "无最近运行", runStatus: "尚未运行", modified: "2026-08-10 合同配置", runEnabled: false, publishState: "not-published"
    }
  ],
  runs: [
    { id: "RUN-FIN-20260809-002", pipeline: "融资数据标准化与发布", version: "v1.0", trigger: "手工上传", source: "融资明细一览表", snapshot: "SNAP-FIN-20260808-002", t008: "2026-08-08", start: "2026-08-09 10:06", end: "10:10", status: "成功", quality: "有警告·已确认", asset: "ASSET-FINANCE@2026.08.08-r2", failure: "—" },
    { id: "RUN-FIN-20260809-003", pipeline: "融资数据标准化与发布", version: "v1.0", trigger: "手工检查共享文件夹", source: "融资共享文件夹", snapshot: "SNAP-FIN-20260801-003", t008: "2026-08-01", start: "2026-08-09 10:12", end: "10:12", status: "质量失败", quality: "1 项硬阻断", asset: "未形成", failure: "产业板块存在旧名称" },
    { id: "TRIAL-FIN-20260809-001", pipeline: "融资数据标准化与发布", version: "v1.0", trigger: "画布调试", source: "融资明细一览表", snapshot: "SNAP-FIN-20260731-001", t008: "2026-07-31", start: "2026-08-09 09:55", end: "09:55", status: "调试完成", quality: "3 项警告", asset: "调试不发布", failure: "—" }
  ],
  financeMembers: [
    { key: "subject", name: "融资主体参考", rows: "574 条", grain: "一行一融资主体", stableKey: "单位编码", fields: "单位编码、单位名称、统一产业板块、负责人标识" },
    { key: "detail", name: "融资明细", rows: "5,218 条", grain: "一行一笔融资借据", stableKey: "借据编号", fields: "借据编号、单位编码、机构编码、融资余额、担保方式" },
    { key: "institution", name: "金融机构参考", rows: "24 条", grain: "一行一金融机构", stableKey: "机构编码", fields: "机构编码、机构名称、机构类别" },
    { key: "owner", name: "融资负责人参考", rows: "24 条", grain: "一行一负责人", stableKey: "负责人标识", fields: "负责人标识、负责人名称" }
  ],
  s003Members: [
    { key: "financial", name: "财务数据", range: "财务数据!A1:AA22", rows: "21 条 · 27 列", grain: "一个企业在一个评估时点的财务输入", keyLabel: "单位名称规范值＋2025-12-31", facts: ["I 列为 2025 本年累计利润总额", "AA 列为 2024 上年本年累计利润总额", "546 个财务数据单元均为数值", "币种 CNY，金额单位为元"] },
    { key: "factor", name: "调节因子", range: "调节因子!A1:I22", rows: "21 条 · 9 列", grain: "一个企业在一个评估时点的正式因子输入", keyLabel: "单位名称规范值＋2025-12-31", facts: ["两成员各 21 个单位，集合与顺序一致", "环保企业 G18:G21 为空，已确认语义为业务不适用", "其余非空值均在现有枚举内", "不承载评分、权重或风险等级"] }
  ],
  quality: {
    warning: [
      { name: "主体身份完整性", result: "通过", affected: "0 条", detail: "574 / 574 个主体可稳定识别", recovery: "无需处理" },
      { name: "金融机构端点匹配", result: "通过", affected: "0 条", detail: "24 / 24 家机构均可匹配", recovery: "无需处理" },
      { name: "产业板块有效值", result: "通过", affected: "0 条", detail: "全部使用 D007 有效板块值", recovery: "无需处理" },
      { name: "利率形式完整性", result: "警告", affected: "212 条", detail: "允许为空，发布前需人工确认影响", recovery: "确认下游不依赖后放行" },
      { name: "担保方式完整性", result: "警告", affected: "1,868 条", detail: "缺失值保留为未知，不自动填充", recovery: "确认缺失不影响当前消费" }
    ],
    failed: [
      { name: "主体身份完整性", result: "通过", affected: "0 条", detail: "574 / 574 个主体可稳定识别", recovery: "无需处理" },
      { name: "产业板块有效值", result: "硬阻断", affected: "1 条", detail: "单位A仍使用旧名称“新能源控股”", recovery: "将来源值改为 D007 有效板块后，从数据检查节点重试" },
      { name: "融资余额非负", result: "通过", affected: "0 条", detail: "最小值 ≥ 0", recovery: "无需处理" }
    ]
  }
};
