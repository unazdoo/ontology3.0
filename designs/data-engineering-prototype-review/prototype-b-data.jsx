const PROTOTYPE_SCENARIOS = {
  A: {
    key: "A",
    short: "原始候选",
    name: "A · 原始工作簿",
    description: "T008 2026-07-31；质量有警告，人工确认后发布并刷新成功",
    t008: "2026-07-31",
    snapshot: "SNAP-FIN-20260731-001",
    run: "RUN-FIN-20260809-001",
    quality: "有警告",
    execution: "等待确认",
    closure: "未发布",
    assetVersion: "ASSET-FINANCE@2026.07.31-r1",
    refresh: "REFRESH-FIN-20260809-001",
    refreshResult: "成功",
    consumption: "消费就绪",
    taskTitle: "融资数据质量有 3 项警告，等待确认",
    taskImpact: "尚未发布新数据资产版本；上一可信版本继续服务",
    taskAction: "处理质量警告",
    color: "warning",
  },
  B: {
    key: "B",
    short: "成功更新",
    name: "B · 成功更新候选",
    description: "T008 2026-08-08；补齐一条担保方式，确认警告后形成第二个可信版本",
    t008: "2026-08-08",
    snapshot: "SNAP-FIN-20260808-002",
    run: "RUN-FIN-20260809-002",
    quality: "有警告",
    execution: "已结束",
    closure: "消费就绪",
    assetVersion: "ASSET-FINANCE@2026.08.08-r2",
    refresh: "REFRESH-FIN-20260809-002",
    refreshResult: "成功",
    consumption: "消费就绪",
    taskTitle: "成功更新已刷新并被权威消费绑定采用",
    taskImpact: "ASSET-FINANCE@2026.08.08-r2 已形成 T018，且 T019 已正式采用",
    taskAction: "查看消费证据",
    color: "success",
  },
  C: {
    key: "C",
    short: "质量硬失败",
    name: "C · 质量硬失败",
    description: "T008 2026-08-01；出现旧板块名称“新能源控股”，质量硬阻断",
    t008: "2026-08-01",
    snapshot: "SNAP-FIN-20260801-003",
    run: "RUN-FIN-20260809-003",
    quality: "失败",
    execution: "失败",
    closure: "未发布",
    assetVersion: "未形成",
    refresh: "未形成",
    refreshResult: "未执行",
    consumption: "ASSET-FINANCE@2026.07.31-r1 继续服务",
    taskTitle: "产业板块检查失败，候选未发布",
    taskImpact: "1 条记录仍使用旧名称“新能源控股”；上一可信版本不受影响",
    taskAction: "定位失败并修复",
    color: "failed",
  },
  D: {
    key: "D",
    short: "刷新不兼容",
    name: "D · 本体刷新不兼容",
    description: "候选输出使用“融资负责人参考.负责人显示名”，而 Published v1.0.0 既有来源映射要求“负责人名称”",
    t008: "2026-08-08",
    snapshot: "SNAP-FIN-20260808-004",
    run: "RUN-FIN-20260809-004",
    quality: "有警告",
    execution: "已结束",
    closure: "已发布·刷新失败",
    assetVersion: "ASSET-FINANCE@2026.08.08-r3",
    refresh: "REFRESH-FIN-20260809-004",
    refreshResult: "不兼容",
    consumption: "ASSET-FINANCE@2026.08.08-r2 继续服务",
    taskTitle: "本体刷新返回结构不兼容",
    taskImpact: "候选未被权威消费绑定采用；ASSET-FINANCE@2026.08.08-r2 继续服务",
    taskAction: "查看不兼容证据",
    color: "failed",
  },
};

const PROTOTYPE_SNAPSHOT_FIXTURES = {
  A: {
    file: "融资一览表_一期演示数据.xlsx",
    fingerprint: "8f31…c219",
    discoveredAt: "2026-08-09 09:58",
    readAt: "2026-08-09 10:00",
  },
  B: {
    file: "融资一览表_20260808.xlsx",
    fingerprint: "31a4…8e72",
    discoveredAt: "2026-08-09 10:04",
    readAt: "2026-08-09 10:06",
  },
  C: {
    file: "融资一览表_20260801.xlsx",
    fingerprint: "b470…2c18",
    discoveredAt: "2026-08-09 10:10",
    readAt: "2026-08-09 10:12",
  },
  D: {
    file: "融资一览表_20260808.xlsx",
    fingerprint: "957d…b310",
    discoveredAt: "2026-08-09 10:18",
    readAt: "2026-08-09 10:20",
  },
};

function prototypeSnapshotFixture(scenarioKey) {
  return PROTOTYPE_SNAPSHOT_FIXTURES[scenarioKey] || PROTOTYPE_SNAPSHOT_FIXTURES.A;
}

function prototypeScenarioSource(scenarioKey) {
  return scenarioKey === "C"
    ? { id: "SRC-FIN-FOLDER-001", name: "融资共享文件夹", target: "source-folder" }
    : { id: "SRC-FIN-UPLOAD-001", name: "融资工作簿手工上传", target: "source-manual" };
}

const PROTOTYPE_RETRY_RUN_FIXTURES = {
  C: { id: "RUN-FIN-20260809-005", parentRun: "RUN-FIN-20260809-003", start: "2026-08-09 10:26", end: "2026-08-09 10:26:26" },
  D: { id: "RUN-FIN-20260809-006", parentRun: "RUN-FIN-20260809-004", start: "2026-08-09 10:31", end: "2026-08-09 10:34:42" },
};

function prototypeRetryRunFixture(scenarioKey) {
  return PROTOTYPE_RETRY_RUN_FIXTURES[scenarioKey] || null;
}

function prototypeRetryRunId(scenarioKey) {
  const fixture = prototypeRetryRunFixture(scenarioKey);
  return fixture ? fixture.id : "";
}

const PROTOTYPE_NAV_ITEMS = [
  { id: "overview", label: "总览", icon: "LayoutDashboard", screen: "D1" },
  { id: "sources", label: "数据源", icon: "FolderInput", screen: "D2" },
  { id: "pipelines", label: "数据管道", icon: "Workflow", screen: "D4" },
  { id: "runs", label: "运行历史", icon: "History", screen: "D6" },
  { id: "assets", label: "数据资产", icon: "Package", screen: "D7" },
  { id: "lineage", label: "数据沿袭", icon: "Route", screen: "D9" },
];

const PROTOTYPE_SCREEN_TITLES = {
  overview: "数据工程总览",
  sources: "数据源目录",
  "source-manual": "手工上传来源",
  "source-folder": "共享文件夹来源",
  "source-s003": "企业债务风险评估模版",
  pipelines: "数据管道目录",
  canvas: "融资数据标准化与发布",
  runs: "运行历史",
  "run-detail": "运行详情",
  assets: "数据资产目录",
  "asset-detail": "融资标准化数据资产",
  lineage: "数据沿袭",
};

const PROTOTYPE_PIPELINE_NODES = [
  { key: "source", order: "01", name: "数据源", icon: "Database", color: "#a26f3a", hint: "选择真实 T001 / T002", summary: "融资工作簿快照" },
  { key: "python", order: "02", name: "Python 处理", icon: "SquareFunction", color: "#536ccf", hint: "预置融资标准化脚本", summary: "融资工作簿标准化 v1" },
  { key: "quality", order: "03", name: "数据检查", icon: "ShieldCheck", color: "#168477", hint: "固定融资质量门", summary: "融资固定检查集 v1.0" },
  { key: "publish", order: "04", name: "发布数据资产", icon: "PackageCheck", color: "#7659b1", hint: "发布不可变 T007", summary: "四成员 · 三关系" },
  { key: "refresh", order: "05", name: "请求本体刷新", icon: "RefreshCw", color: "#43779b", hint: "请求精确 T017", summary: "Published v1.0.0" },
];

const PROTOTYPE_SOURCE_ROWS = [
  {
    id: "SRC-FIN-UPLOAD-001",
    name: "融资工作簿手工上传",
    description: "一期融资数据的人工上传入口",
    type: "手工上传",
    status: "可用",
    lastCheck: "不适用",
    lastDiscovered: "2026-08-09 09:58",
    lastRead: "2026-08-09 10:00",
    lastPublished: "2026-08-09 10:02",
    consumption: "2026-08-09 10:05",
    error: "无",
    pipeline: "融资数据标准化与发布",
    target: "source-manual",
  },
  {
    id: "SRC-FIN-FOLDER-001",
    name: "融资共享文件夹",
    description: "从指定本机共享目录手工检查新文件",
    type: "共享文件夹",
    status: "暂停",
    lastCheck: "2026-08-09 09:58",
    lastDiscovered: "2026-08-09 09:58",
    lastRead: "2026-08-09 10:00",
    lastPublished: "无新文件",
    consumption: "沿用当前可信版本",
    error: "无",
    pipeline: "融资数据标准化与发布",
    target: "source-folder",
  },
];

const PROTOTYPE_S003_SOURCE = {
  name: "企业债务风险评估模版",
  workbook: "企业债务风险评估模版_S003兼容版.xlsx",
  scenario: "S003 债务风险监测",
  sourceType: "手工工作簿",
  authoritativeStage: "数据工程兼容性验证",
  internalResult: "数据内容已确认·待受控发布验证",
  consumption: "不可消费",
  memberCount: 2,
  t008: "2025-12-31",
  verification: "0 个数据内容阻断 · 2 项治理已收敛 · 5 类真实运行证据待生成",
  currentStatus: "发布门未满足（尚未运行）",
  currentHash: "dbdab9c870d7f2e456c3a9e0f91b340b372da6d40eb241551e0ee8848cac42a0",
  previousHash: "dd917b497f43ebf5c72607b49d70ae049969a32505311fb6bf9aa7a85d36a498",
  revision: "仅将 财务数据!AA1 改为“利润总额_本年累计数(上年)”，未修改业务数据",
  currency: "CNY（人民币）",
  amountUnit: "元",
  sourceIdentity: "I023 校正兼容夹具",
  registration: "尚未真实登记 T001 / T002 / T053",
};

const PROTOTYPE_S003_MEMBERS = [
  {
    key: "financial",
    name: "财务数据",
    range: "财务数据!A1:AA22",
    size: "21 条数据 · 27 列",
    grain: "一个企业在一个评估时点的财务输入",
    compatibleKey: "单位名称规范值＋2025-12-31",
    stableId: "待受控处理真实生成",
    facts: [
      "I 列：利润总额_本年累计数，表示 2025 本年累计",
      "AA 列：利润总额_本年累计数(上年)，表示 2024 上年本年累计",
      "B2:AA22 共 546 个财务数据单元，当前均为数值",
      "财务金额元数据：CNY（人民币）· 元",
    ],
  },
  {
    key: "factor",
    name: "调节因子",
    range: "调节因子!A1:I22",
    size: "21 条数据 · 9 列",
    grain: "一个企业在一个评估时点的正式因子输入",
    compatibleKey: "单位名称规范值＋2025-12-31",
    stableId: "待受控处理真实生成",
    facts: [
      "两成员单位名称均为 21 个，当前集合和顺序一致",
      "G18:G21 四家环保企业为空，已确认语义为“业务不适用”",
      "其余非空因子值均落在工作簿现有下拉枚举内",
      "本成员承载正式输入值，不承载评分、权重或风险等级",
    ],
  },
];

const PROTOTYPE_S003_QUALITY_GROUPS = [
  { key: "passed", label: "已通过", tone: "success" },
  { key: "optimization", label: "非阻断模板优化", tone: "warning" },
  { key: "settled", label: "已收敛治理项", tone: "success" },
  { key: "pending", label: "待运行生成", tone: "neutral" },
];

const PROTOTYPE_S003_QUALITY_ITEMS = [
  {
    key: "sheets",
    group: "passed",
    name: "两个目标 Sheet 存在",
    result: "通过 · 财务数据、调节因子均存在",
    impact: "现有合同可以识别两个逻辑成员。",
    recovery: "无需修正；真实受控运行仍会重复执行该检查。",
    owner: "数据工程",
    evidence: "当前校正工作簿的 Sheet 清单与使用范围",
  },
  {
    key: "units",
    group: "passed",
    name: "单位名称完整且双成员一致",
    result: "通过 · 两边各 21 个，非空、唯一、集合与顺序一致",
    impact: "可按“单位名称规范值＋2025-12-31”进行数据层一对一完整性校验。",
    recovery: "无需修正；正式运行需继续检查规范化后重复、缺失和歧义。",
    owner: "数据工程",
    evidence: "两张工作表 A2:A22 的只读核验摘要",
  },
  {
    key: "numeric",
    group: "passed",
    name: "财务值完整且类型一致",
    result: "通过 · 546 个财务单元均为数值，无空值或文本混入",
    impact: "当前文件内容满足财务输入的数值兼容条件。",
    recovery: "无需修正；合法负数不得被通用非负规则误判。",
    owner: "数据工程",
    evidence: "财务数据!B2:AA22 的类型与空值核验摘要",
  },
  {
    key: "headers",
    group: "passed",
    name: "27 个财务表头唯一",
    result: "通过 · I1 与 AA1 已具有不同且可解释的字段名",
    impact: "受控处理可同时保留 2025 本年累计与 2024 上年本年累计。",
    recovery: "无需修正；不得复用会静默忽略 AA 列的历史 Skill 解析方式。",
    owner: "数据工程",
    evidence: "当前表头清单与总控 I023 修订证据",
  },
  {
    key: "business-values",
    group: "passed",
    name: "I / AA 业务值未被修改",
    result: "通过 · 修订仅涉及 AA1 表头",
    impact: "校正夹具没有用表头修订改变债务风险输入事实。",
    recovery: "无需修正；后续 T002 需保留修订前后哈希和前序关系。",
    owner: "数据工程",
    evidence: "总控 I023 记录的唯一单元格变化证据",
  },
  {
    key: "t008",
    group: "passed",
    name: "数据截至时间已确认",
    result: "通过 · T008 = 2025-12-31",
    impact: "两个成员可使用同一业务评估时点形成候选版本证据。",
    recovery: "无需修正；该值是外部已确认元数据，不得声称来源工作簿自带。",
    owner: "S003 业务 Owner（确认）· 数据工程（登记）",
    evidence: "D052 口径确认；工作簿本身未编码该元数据",
  },
  {
    key: "currency",
    group: "passed",
    name: "币种与金额单位已确认",
    result: "通过 · CNY（人民币）· 元",
    impact: "财务金额字段具备明确的版本级单位元数据。",
    recovery: "无需修正；不得从数值量级猜测，也不套用于因子枚举。",
    owner: "S003 业务 Owner（确认）· 数据工程（登记）",
    evidence: "D052 口径确认；工作簿本身未编码币种和金额单位",
  },
  {
    key: "validations",
    group: "passed",
    name: "原有数据校验配置已保留",
    result: "通过 · 1 组财务十进制校验、8 组因子列表校验",
    impact: "AA1 表头修订未破坏当前模板的既有输入约束。",
    recovery: "无需恢复；平台质量门仍需独立执行，不能把 Excel 下拉当成 T005。",
    owner: "数据工程",
    evidence: "当前工作簿的数据校验配置只读核验",
  },
  {
    key: "environmental-na",
    group: "passed",
    name: "环保企业电价波动率条件不适用",
    result: "通过 · 调节因子!G18:G21 保持为空，语义为“业务不适用”",
    impact: "四个空值不属于数据缺失，不再构成质量阻断。",
    recovery: "保持为空；不得填 0、默认档或推导调整系数。",
    owner: "S003 业务 Owner（口径）· 数据工程（校验）",
    evidence: "D052 已生效规则与当前 G18:G21 空值范围",
  },
  {
    key: "factor-values",
    group: "passed",
    name: "调节因子条件必填与枚举有效",
    result: "通过 · 168 个目标单元中仅 D052 允许的 G18:G21 为空，其余 164 个非空且枚举合法",
    impact: "当前文件既保留环保业务不适用事实，也满足其他企业与因子字段的条件必填要求。",
    recovery: "真实质量门继续按产业类别执行条件必填与枚举校验；不得把允许空值自动补为 0 或默认档。",
    owner: "S003 业务 Owner（条件口径）· 数据工程（校验）",
    evidence: "调节因子!B2:I22 的空值分布与 8 组列表枚举只读核验",
  },
  {
    key: "template-validation",
    group: "optimization",
    name: "Excel 下拉尚未表达环保条件可空",
    result: "非阻断 · G2:G1000 列表校验未声明允许空值，枚举也没有“不适用”",
    impact: "模板提示与 D052 权威条件规则存在表达差异，但不影响当前文件内容准备。",
    recovery: "下次来源模板修订时补充条件校验；本次不改四个空值。",
    owner: "S003 来源模板 Owner",
    evidence: "调节因子 G2:G1000 数据校验配置与 D052 条件规则对照",
  },
  {
    key: "cr018",
    group: "settled",
    name: "CR018 最小受控处理形态",
    result: "已收敛 · D053 已接受并关闭 CR018",
    impact: "“债务风险输入标准化”受控能力的范围与禁止项已经获得平台合同授权。",
    recovery: "无需再次裁决；下一步是按合同真实运行，不是继续扩写功能。",
    owner: "平台总控（合同）· 数据工程（执行）",
    evidence: "D053、CR018 关闭记录",
  },
  {
    key: "i023",
    group: "settled",
    name: "I023 校正夹具索引",
    result: "已收敛 · I023 已重定向至当前校正兼容夹具",
    impact: "总控权威输入身份与本页面工作簿一致。",
    recovery: "无需重定向；真实登记时仍需保留修订前后哈希和前序快照规则。",
    owner: "平台总控（索引）· 数据工程（来源证据）",
    evidence: "I023 当前路径、当前哈希和修订前哈希说明",
  },
  {
    key: "snapshots",
    group: "pending",
    name: "真实 T001 / T002 / T053 登记",
    result: "待运行生成 · 当前页面只有已核验文件事实",
    impact: "没有原始快照与人工业务输入快照身份，不能开始受控发布验证。",
    recovery: "由数据工程通过真实工作簿接入登记来源、T002，并在同次提交关联 T053。",
    owner: "数据工程",
    evidence: "尚无可展示标识；不得编造",
  },
  {
    key: "controlled-run",
    group: "pending",
    name: "受控处理运行证据",
    result: "待运行生成 · 债务风险输入标准化尚未真实执行",
    impact: "当前只能证明结构和内容准备，不能证明受控处理实际形成双成员候选。",
    recovery: "按 D053 锁定真实输入和受控模块版本后执行兼容性验证运行。",
    owner: "数据工程",
    evidence: "尚无运行标识、版本或状态；不得显示运行成功",
  },
  {
    key: "member-ids",
    group: "pending",
    name: "双成员稳定标识",
    result: "待运行生成 · 当前仅有展示名和来源范围",
    impact: "尚不能用稳定身份跨版本引用两个成员。",
    recovery: "由真实受控处理生成两个稳定成员标识，并随版本证据保存。",
    owner: "数据工程",
    evidence: "当前明确显示“待受控处理真实生成”，不提供占位 ID",
  },
  {
    key: "t005",
    group: "pending",
    name: "正式 T005 质量结果",
    result: "待运行生成 · 当前是文件核验事实，不是正式质量结果",
    impact: "没有正式质量门证据，不能形成兼容性 T007。",
    recovery: "对真实双成员候选执行 D053 检查集并保留成员级结果。",
    owner: "数据工程",
    evidence: "尚无 T005 标识、检查集版本或运行结果；不得编造",
  },
  {
    key: "t007",
    group: "pending",
    name: "双成员兼容性 T007",
    result: "待运行生成 · 尚未发布任何 S003 数据资产版本",
    impact: "当前不能标记兼容性验证通过，也不能提供任何正式消费。",
    recovery: "前述证据齐备且 T005 通过后，原子形成双成员 T007，并永久标记“仅兼容性验证、不可消费”。",
    owner: "数据工程",
    evidence: "尚无 T007 标识；不得显示发布、刷新或消费成功",
  },
];

const PROTOTYPE_SNAPSHOTS = [
  { id: "SNAP-FIN-20260731-001", t008: "2026-07-31", file: "融资一览表_一期演示数据.xlsx", fingerprint: "8f31…c219", status: "已登记", process: "处理成功", readAt: "2026-08-09 10:00" },
  { id: "SNAP-FIN-20260630-001", t008: "2026-06-30", file: "融资一览表_20260630.xlsx", fingerprint: "5a82…91be", status: "历史", process: "处理成功", readAt: "2026-07-02 09:16" },
  { id: "SNAP-FIN-20260531-001", t008: "2026-05-31", file: "融资一览表_20260531.xlsx", fingerprint: "72d4…a840", status: "历史", process: "处理成功", readAt: "2026-06-02 09:11" },
];

const PROTOTYPE_QUALITY_ROWS = [
  { name: "主体身份完整性", group: "身份与端点", result: "通过", level: "硬阻断", affected: 0, actual: "574 / 574 主体可识别", expected: "缺失 0", recovery: "无需处理" },
  { name: "金融机构端点匹配", group: "身份与端点", result: "通过", level: "硬阻断", affected: 0, actual: "24 / 24 机构可匹配", expected: "未匹配 0", recovery: "无需处理" },
  { name: "产业板块有效值", group: "业务分类", result: "通过", level: "硬阻断", affected: 0, actual: "10 个有效值", expected: "无旧名称", recovery: "无需处理" },
  { name: "利率形式完整性", group: "可选字段", result: "警告", level: "警告", affected: 212, actual: "212 条为空", expected: "允许为空，需确认影响", recovery: "核对下游是否依赖" },
  { name: "期限种类完整性", group: "可选字段", result: "警告", level: "警告", affected: 212, actual: "212 条为空", expected: "允许为空，需确认影响", recovery: "核对下游是否依赖" },
  { name: "担保方式完整性", group: "可选字段", result: "警告", level: "警告", affected: 1868, actual: "1,868 条为空", expected: "允许为空，需确认影响", recovery: "核对下游是否依赖" },
  { name: "融资余额非负", group: "数值范围", result: "通过", level: "硬阻断", affected: 0, actual: "最小值 ≥ 0", expected: "余额 ≥ 0", recovery: "无需处理" },
  { name: "规模变化", group: "规模与时效", result: "通过", level: "警告", affected: 0, actual: "较上一期 +0.0%", expected: "变化在基线内", recovery: "无需处理" },
];

const PROTOTYPE_PREVIEW_ROWS = [
  { debt: "DEMO-DEBT-000001", org: "UNIT-553", orgName: "单位A", sector: "境内新能源", institution: "INST-001", institutionName: "银行A", owner: "融资负责人001", balance: "1,250,000,000" },
  { debt: "DEMO-DEBT-000002", org: "UNIT-465", orgName: "单位B", sector: "核能", institution: "INST-004", institutionName: "银行D", owner: "融资负责人009", balance: "820,000,000" },
  { debt: "DEMO-DEBT-000003", org: "UNIT-561", orgName: "单位C", sector: "数字化", institution: "INST-011", institutionName: "银行K", owner: "融资负责人009", balance: "530,000,000" },
  { debt: "DEMO-DEBT-000004", org: "UNIT-127", orgName: "单位D", sector: "核燃料", institution: "INST-018", institutionName: "非银机构R", owner: "融资负责人014", balance: "310,000,000" },
];

const PROTOTYPE_RUNS = [
  { id: "RUN-FIN-20260809-004", t008: "2026-08-08", type: "正式运行", trigger: "原型评审模拟", execution: "已结束", closure: "已发布·刷新失败", start: "2026-08-09 10:20", duration: "3 分 42 秒", retry: "无", scenario: "D" },
  { id: "RUN-FIN-20260809-003", t008: "2026-08-01", type: "正式运行", trigger: "共享文件夹·立即检查", execution: "失败", closure: "未发布", start: "2026-08-09 10:12", duration: "26.1 秒", retry: "无", scenario: "C" },
  { id: "RUN-FIN-20260809-002", t008: "2026-08-08", type: "正式运行", trigger: "手工上传", execution: "已结束", closure: "消费就绪", start: "2026-08-09 10:06", duration: "4 分 08 秒", retry: "无", scenario: "B" },
  { id: "RUN-FIN-20260809-001", t008: "2026-07-31", type: "正式运行", trigger: "手工上传", execution: "等待确认", closure: "未发布", start: "2026-08-09 10:00", duration: "进行中", retry: "无", scenario: "A" },
  { id: "TRIAL-FIN-20260809-001", t008: "2026-07-31", type: "试运行", trigger: "画布手工触发", execution: "已结束", closure: "不适用·试运行不发布", start: "2026-08-09 09:55", duration: "8.4 秒", retry: "无", scenario: "A" },
  { id: "RUN-FIN-20260702-000", t008: "2026-06-30", type: "正式运行", trigger: "手工上传", execution: "已结束", closure: "消费就绪", start: "2026-07-02 09:16", duration: "3 分 51 秒", retry: "无", scenario: "A" },
];

const PROTOTYPE_ASSET_VERSIONS = [
  {
    id: "ASSET-FINANCE@2026.08.08-r3",
    label: "2026-08-08 · r3",
    t008: "2026-08-08",
    publishedAt: "2026-08-09 10:22",
    quality: "有警告·已确认",
    versionStatus: "不可变",
    consumption: "刷新失败",
    owner: "数据工程演示账号",
    run: "RUN-FIN-20260809-004",
    change: "独立结构候选版本；候选输出为“负责人显示名”，未满足 Published v1.0.0 对“负责人名称”的既有来源映射，未被 T019 采用",
  },
  {
    id: "ASSET-FINANCE@2026.08.08-r2",
    label: "2026-08-08 · r2",
    t008: "2026-08-08",
    publishedAt: "2026-08-09 10:08",
    quality: "有警告·已确认",
    versionStatus: "不可变",
    consumption: "消费就绪",
    owner: "数据工程演示账号",
    run: "RUN-FIN-20260809-002",
    change: "DEMO-DEBT-000005 的担保方式由缺失补为“信用”；其他身份和金额不变",
  },
  {
    id: "ASSET-FINANCE@2026.07.31-r1",
    label: "2026-07-31 · r1",
    t008: "2026-07-31",
    publishedAt: "2026-08-09 10:02",
    quality: "有警告·已确认",
    versionStatus: "不可变",
    consumption: "消费就绪",
    owner: "数据工程演示账号",
    run: "RUN-FIN-20260809-001",
    change: "首次发布四成员、三关系的融资标准化数据资产版本",
  },
  {
    id: "ASSET-FINANCE@2026.06.30-r0",
    label: "2026-06-30 · r0",
    t008: "2026-06-30",
    publishedAt: "2026-07-02 09:18",
    quality: "有警告·已确认",
    versionStatus: "不可变",
    consumption: "消费就绪",
    owner: "数据工程演示账号",
    run: "RUN-FIN-20260702-000",
    change: "上一可信基线版本；在 2026-07-31 候选完成前继续服务",
  },
];

const PROTOTYPE_MEMBERS = [
  { key: "subject", name: "融资主体参考", grain: "一行一融资主体", rows: 574, primaryKey: "单位编码" },
  { key: "detail", name: "融资明细", grain: "一行一笔融资借据", rows: 5218, primaryKey: "借据编号" },
  { key: "institution", name: "金融机构参考", grain: "一行一金融机构", rows: 24, primaryKey: "机构编码" },
  { key: "owner", name: "融资负责人参考", grain: "一行一负责人", rows: 24, primaryKey: "负责人标识" },
];

const PROTOTYPE_MEMBER_FIELDS = {
  subject: [
    ["单位编码", "字符串", "主键", "稳定识别融资主体"],
    ["单位名称", "字符串", "—", "脱敏后的主体名称"],
    ["统一产业板块", "枚举", "—", "D007 有效板块名称"],
    ["负责人标识", "字符串", "外键", "关联融资负责人参考"],
  ],
  detail: [
    ["借据编号", "字符串", "主键", "稳定识别一笔融资"],
    ["单位编码", "字符串", "外键", "关联融资主体参考"],
    ["机构编码", "字符串", "外键", "关联金融机构参考"],
    ["融资余额", "小数", "—", "当前 T008 的人民币融资余额"],
    ["担保方式", "字符串", "—", "可选字段，缺失保留为未知"],
  ],
  institution: [
    ["机构编码", "字符串", "主键", "随脚本版本受控的稳定编码"],
    ["机构名称", "字符串", "—", "脱敏后的机构名称"],
    ["机构类别", "枚举", "—", "银行或非银"],
  ],
  owner: [
    ["负责人标识", "字符串", "主键", "稳定识别融资负责人"],
    ["负责人名称", "字符串", "—", "负责人业务显示名称"],
  ],
};

const PROTOTYPE_RELATIONSHIPS = [
  { id: "REL-01", source: "融资明细.单位编码", target: "融资主体参考.单位编码", unmatched: 0, cardinality: "多对一" },
  { id: "REL-02", source: "融资明细.机构编码", target: "金融机构参考.机构编码", unmatched: 0, cardinality: "多对一" },
  { id: "REL-03", source: "融资主体参考.负责人标识", target: "融资负责人参考.负责人标识", unmatched: 0, cardinality: "多对一" },
];

Object.assign(window, {
  PROTOTYPE_SCENARIOS,
  PROTOTYPE_SNAPSHOT_FIXTURES,
  prototypeSnapshotFixture,
  prototypeScenarioSource,
  PROTOTYPE_RETRY_RUN_FIXTURES,
  prototypeRetryRunFixture,
  prototypeRetryRunId,
  PROTOTYPE_NAV_ITEMS,
  PROTOTYPE_SCREEN_TITLES,
  PROTOTYPE_PIPELINE_NODES,
  PROTOTYPE_SOURCE_ROWS,
  PROTOTYPE_S003_SOURCE,
  PROTOTYPE_S003_MEMBERS,
  PROTOTYPE_S003_QUALITY_GROUPS,
  PROTOTYPE_S003_QUALITY_ITEMS,
  PROTOTYPE_SNAPSHOTS,
  PROTOTYPE_QUALITY_ROWS,
  PROTOTYPE_PREVIEW_ROWS,
  PROTOTYPE_RUNS,
  PROTOTYPE_ASSET_VERSIONS,
  PROTOTYPE_MEMBERS,
  PROTOTYPE_MEMBER_FIELDS,
  PROTOTYPE_RELATIONSHIPS,
});
