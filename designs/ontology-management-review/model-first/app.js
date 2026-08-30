(function () {
  "use strict";

  var STORAGE_KEY = "ontology3:model-first:v1";

  var FINANCING_DATA_VERSIONS = [
    { id: "FIN-ASSET-20251130-v01", asOf: "2025-11-30", requiresRemapping: false },
    { id: "FIN-ASSET-20251231-v01", asOf: "2025-12-31", requiresRemapping: true },
    { id: "FIN-ASSET-20260131-v01", asOf: "2026-01-31", requiresRemapping: false }
  ];

  function financingDataVersionForCycle(cycle) {
    var normalizedCycle = Math.max(1, Number(cycle) || 1);
    return FINANCING_DATA_VERSIONS[normalizedCycle - 1] || null;
  }

  function adoptedDataVersionIds() {
    var adopted = {};
    [state.currentBinding, state.previousBinding].concat(state.bindingHistory || []).forEach(function (binding) {
      if (binding && binding.dataVersion) adopted[binding.dataVersion] = true;
    });
    return adopted;
  }

  function previousBindingForCurrent() {
    if (!state.currentBinding || !state.previousBinding) return null;
    return state.previousBinding.semanticVersion === state.currentBinding.semanticVersion ? state.previousBinding : null;
  }

  var OBJECTS = [
    {
      key: "subject",
      id: "OBJ-FINANCING-ENTITY",
      type: "Object Type",
      name: "融资主体",
      definition: "独立承担融资余额、成本、结构判断与优化行动的单位。",
      identity: "单位编码",
      title: "单位名称",
      identityPropertyId: "PROP-FINANCING-ENTITY-UNIT-CODE",
      titlePropertyId: "PROP-FINANCING-ENTITY-UNIT-NAME",
      source: "融资主体参考",
      properties: [
        { key: "PROP-FINANCING-ENTITY-UNIT-CODE", id: "PROP-FINANCING-ENTITY-UNIT-CODE", name: "单位编码", role: "稳定身份 · 非空唯一", type: "文本", nullable: "否", source: "单位编码" },
        { key: "PROP-FINANCING-ENTITY-UNIT-NAME", id: "PROP-FINANCING-ENTITY-UNIT-NAME", name: "单位名称", role: "可读标题", type: "文本", nullable: "否", source: "单位名称" },
        { key: "PROP-FINANCING-ENTITY-SECTOR", id: "PROP-FINANCING-ENTITY-SECTOR", name: "所属板块", role: "业务分类", type: "文本", nullable: "否", source: "产业板块" }
      ]
    },
    {
      key: "detail",
      id: "OBJ-FINANCING-DETAIL",
      type: "Object Type",
      name: "融资明细",
      definition: "一笔具有独立借据身份、余额、利率、期限、币种与机构归属的融资事实。",
      identity: "借据编号",
      title: "借据编号",
      identityPropertyId: "PROP-FINANCING-DETAIL-LOAN-ID",
      titlePropertyId: "PROP-FINANCING-DETAIL-LOAN-ID",
      source: "融资明细",
      properties: [
        { key: "PROP-FINANCING-DETAIL-LOAN-ID", id: "PROP-FINANCING-DETAIL-LOAN-ID", name: "借据编号", role: "稳定身份 · 非空唯一 / 可读标题", type: "文本", nullable: "否", source: "借据编号" },
        { key: "PROP-FINANCING-DETAIL-DOMESTIC-OVERSEAS", id: "PROP-FINANCING-DETAIL-DOMESTIC-OVERSEAS", name: "境内外", role: "业务属性", type: "枚举", nullable: "否", source: "境内外" },
        { key: "PROP-FINANCING-DETAIL-DRAWDOWN-DATE", id: "PROP-FINANCING-DETAIL-DRAWDOWN-DATE", name: "提款日", role: "业务属性", type: "日期", nullable: "是", source: "提款日期" },
        { key: "PROP-FINANCING-DETAIL-MATURITY-DATE", id: "PROP-FINANCING-DETAIL-MATURITY-DATE", name: "到期日", role: "业务属性", type: "日期", nullable: "是", source: "提款到期日期" },
        { key: "PROP-FINANCING-DETAIL-CURRENCY", id: "PROP-FINANCING-DETAIL-CURRENCY", name: "币种", role: "ISO 币种", type: "文本", nullable: "否", source: "借据币种" },
        { key: "PROP-FINANCING-DETAIL-FX-RATE", id: "PROP-FINANCING-DETAIL-FX-RATE", name: "汇率", role: "折算汇率", type: "数值", nullable: "否", source: "提款折算人民币汇率" },
        { key: "PROP-FINANCING-DETAIL-ORIGINAL-BALANCE", id: "PROP-FINANCING-DETAIL-ORIGINAL-BALANCE", name: "原币余额", role: "原币金额", type: "数值", nullable: "否", source: "借据余额（原币）" },
        { key: "PROP-FINANCING-DETAIL-CNY-BALANCE", id: "PROP-FINANCING-DETAIL-CNY-BALANCE", name: "折合人民币余额", role: "单位：元", type: "数值", nullable: "否", source: "借据余额（折合人民币）" },
        { key: "PROP-FINANCING-DETAIL-INTEREST-RATE", id: "PROP-FINANCING-DETAIL-INTEREST-RATE", name: "当前利率", role: "单位：%", type: "数值", nullable: "否", source: "当前利率" },
        { key: "PROP-FINANCING-DETAIL-RATE-TYPE", id: "PROP-FINANCING-DETAIL-RATE-TYPE", name: "利率形式", role: "固定 / 浮动", type: "枚举", nullable: "否", source: "利率形式" },
        { key: "PROP-FINANCING-DETAIL-FINANCING-TYPE", id: "PROP-FINANCING-DETAIL-FINANCING-TYPE", name: "融资类型", role: "业务分类", type: "枚举", nullable: "否", source: "融资类型" },
        { key: "PROP-FINANCING-DETAIL-TERM-TYPE", id: "PROP-FINANCING-DETAIL-TERM-TYPE", name: "期限种类", role: "短期 / 中期 / 长期", type: "枚举", nullable: "否", source: "期限种类" },
        { key: "PROP-FINANCING-DETAIL-GUARANTEE-TYPE", id: "PROP-FINANCING-DETAIL-GUARANTEE-TYPE", name: "担保方式", role: "业务属性", type: "枚举", nullable: "是", source: "担保方式" }
      ]
    },
    {
      key: "institution",
      id: "OBJ-FINANCIAL-INSTITUTION",
      type: "Object Type",
      name: "融资机构",
      definition: "向融资主体提供具体融资、可按问题余额归集并作为协商对象的金融机构。",
      identity: "机构编码",
      title: "机构名称",
      identityPropertyId: "PROP-FINANCIAL-INSTITUTION-CODE",
      titlePropertyId: "PROP-FINANCIAL-INSTITUTION-NAME",
      source: "金融机构参考",
      properties: [
        { key: "PROP-FINANCIAL-INSTITUTION-CODE", id: "PROP-FINANCIAL-INSTITUTION-CODE", name: "机构编码", role: "稳定身份 · 非空唯一", type: "文本", nullable: "否", source: "机构编码" },
        { key: "PROP-FINANCIAL-INSTITUTION-NAME", id: "PROP-FINANCIAL-INSTITUTION-NAME", name: "机构名称", role: "可读标题", type: "文本", nullable: "否", source: "机构名称" },
        { key: "PROP-FINANCIAL-INSTITUTION-CATEGORY", id: "PROP-FINANCIAL-INSTITUTION-CATEGORY", name: "机构类别", role: "业务分类", type: "文本", nullable: "否", source: "机构类别" }
      ]
    },
    {
      key: "owner",
      id: "OBJ-FINANCING-OWNER",
      type: "Object Type",
      name: "融资负责人",
      definition: "承接融资主体优化待办的业务责任实体，不等同于登录账号或权限角色。",
      identity: "负责人标识",
      title: "负责人名称",
      identityPropertyId: "PROP-FINANCING-OWNER-ID",
      titlePropertyId: "PROP-FINANCING-OWNER-NAME",
      source: "融资负责人参考",
      properties: [
        { key: "PROP-FINANCING-OWNER-ID", id: "PROP-FINANCING-OWNER-ID", name: "负责人标识", role: "稳定身份 · 非空唯一", type: "文本", nullable: "否", source: "负责人标识" },
        { key: "PROP-FINANCING-OWNER-NAME", id: "PROP-FINANCING-OWNER-NAME", name: "负责人名称", role: "可读标题", type: "文本", nullable: "否", source: "负责人名称" }
      ]
    }
  ];

  var PROPERTY_RESOURCES = OBJECTS.reduce(function (all, object) {
    return all.concat(object.properties.map(function (property) {
      return Object.assign({}, property, {
        type: "Property",
        dataType: property.type,
        parentKey: object.key,
        parentId: object.id,
        parentName: object.name,
        definition: object.name + "的“" + property.name + "”，以稳定语义身份随精确 Published 版本提供给获准消费者。"
      });
    }));
  }, []);

  var LINKS = [
    {
      key: "link_subject_detail",
      id: "LINK-ENTITY-FINANCING",
      type: "Link Type",
      name: "主体拥有融资",
      reverse: "融资属于主体",
      sourceObject: "融资主体",
      targetObject: "融资明细",
      sourceObjectId: "OBJ-FINANCING-ENTITY",
      targetObjectId: "OBJ-FINANCING-DETAIL",
      sourceEndpointKey: "PROP-FINANCING-ENTITY-UNIT-CODE",
      targetEndpointKey: "field.detail.subject_code",
      direction: "融资主体 → 融资明细",
      cardinality: "一对多",
      endpoints: "融资主体.单位编码 ↔ 融资明细.主体单位编码",
      facts: "5,218 条"
    },
    {
      key: "link_detail_institution",
      id: "LINK-FINANCING-INSTITUTION",
      type: "Link Type",
      name: "融资由机构提供",
      reverse: "机构提供融资",
      sourceObject: "融资明细",
      targetObject: "融资机构",
      sourceObjectId: "OBJ-FINANCING-DETAIL",
      targetObjectId: "OBJ-FINANCIAL-INSTITUTION",
      sourceEndpointKey: "field.detail.institution_code",
      targetEndpointKey: "PROP-FINANCIAL-INSTITUTION-CODE",
      direction: "融资明细 → 融资机构",
      cardinality: "多对一",
      endpoints: "融资明细.机构编码 ↔ 融资机构.机构编码",
      facts: "5,218 条"
    },
    {
      key: "link_subject_owner",
      id: "LINK-ENTITY-OWNER",
      type: "Link Type",
      name: "主体由负责人承接",
      reverse: "负责人承接主体优化待办",
      sourceObject: "融资主体",
      targetObject: "融资负责人",
      sourceObjectId: "OBJ-FINANCING-ENTITY",
      targetObjectId: "OBJ-FINANCING-OWNER",
      sourceEndpointKey: "field.subject.owner_id",
      targetEndpointKey: "PROP-FINANCING-OWNER-ID",
      direction: "融资主体 → 融资负责人",
      cardinality: "多对一",
      endpoints: "融资主体.负责人标识 ↔ 融资负责人.负责人标识",
      facts: "574 条"
    }
  ];

  var METRICS = [
    { key: "metric_balance", id: "MET-FIN-BALANCE", type: "Metric", name: "融资余额", unit: "人民币元", scope: "集团、单一融资主体、融资主体集合", appliesToObjectIds: ["OBJ-FINANCING-ENTITY"], dependsOn: ["LINK-ENTITY-FINANCING", "PROP-FINANCING-DETAIL-CNY-BALANCE"], definition: "所选融资明细折合人民币余额之和。", zero: "不适用" },
    { key: "metric_weighted_cost", id: "MET-WAVG-COST", type: "Metric", name: "余额加权平均融资成本", unit: "%", scope: "集团、单一融资主体、融资主体集合", appliesToObjectIds: ["OBJ-FINANCING-ENTITY"], dependsOn: ["LINK-ENTITY-FINANCING", "PROP-FINANCING-DETAIL-CNY-BALANCE", "PROP-FINANCING-DETAIL-INTEREST-RATE"], definition: "按折合人民币余额加权计算融资成本。", zero: "分母为零时显示无法计算" },
    { key: "metric_floating_ratio", id: "MET-FLOATING-RATE-SHARE", type: "Metric", name: "浮动利率余额占比", unit: "%", scope: "集团、单一融资主体、融资主体集合", appliesToObjectIds: ["OBJ-FINANCING-ENTITY"], dependsOn: ["LINK-ENTITY-FINANCING", "PROP-FINANCING-DETAIL-CNY-BALANCE", "PROP-FINANCING-DETAIL-RATE-TYPE"], definition: "浮动利率余额占融资余额的比例。", zero: "分母为零时显示无法计算" },
    { key: "metric_short_ratio", id: "MET-SHORT-DEBT-SHARE", type: "Metric", name: "短期债务余额占比", unit: "%", scope: "集团、单一融资主体、融资主体集合", appliesToObjectIds: ["OBJ-FINANCING-ENTITY"], dependsOn: ["LINK-ENTITY-FINANCING", "PROP-FINANCING-DETAIL-CNY-BALANCE", "PROP-FINANCING-DETAIL-TERM-TYPE"], definition: "短期融资余额占融资余额的比例。", zero: "分母为零时显示无法计算" },
    { key: "metric_fx_ratio", id: "MET-FX-FINANCING-SHARE", type: "Metric", name: "外币融资余额占比", unit: "%", scope: "集团、单一融资主体、融资主体集合", appliesToObjectIds: ["OBJ-FINANCING-ENTITY"], dependsOn: ["LINK-ENTITY-FINANCING", "PROP-FINANCING-DETAIL-CNY-BALANCE", "PROP-FINANCING-DETAIL-CURRENCY"], definition: "非人民币融资折合人民币余额占比。", zero: "分母为零时显示无法计算" },
    { key: "metric_high_cost_ratio", id: "MET-HIGH-COST-SHARE", type: "Metric", name: "高成本融资余额占比", unit: "%", scope: "集团、单一融资主体、融资主体集合", appliesToObjectIds: ["OBJ-FINANCING-ENTITY"], dependsOn: ["LINK-ENTITY-FINANCING", "PROP-FINANCING-DETAIL-CNY-BALANCE", "PROP-FINANCING-DETAIL-INTEREST-RATE"], definition: "高于当前有效成本界限的融资余额占比。", zero: "分母为零时显示无法计算" },
    { key: "metric_credit_ratio", id: "MET-CREDIT-FINANCING-SHARE", type: "Metric", name: "信用融资余额占比", unit: "%", scope: "集团、单一融资主体、融资主体集合", appliesToObjectIds: ["OBJ-FINANCING-ENTITY"], dependsOn: ["LINK-ENTITY-FINANCING", "PROP-FINANCING-DETAIL-CNY-BALANCE", "PROP-FINANCING-DETAIL-GUARANTEE-TYPE"], definition: "担保方式为信用的融资余额占比。", zero: "分母为零时显示无法计算" }
  ];

  var RULES = [
    {
      key: "rule_r01",
      id: "RULE-HIGH-COST",
      type: "Rule",
      code: "R01",
      name: "融资成本偏高",
      appliesToObjectIds: ["OBJ-FINANCING-ENTITY"],
      dependsOn: ["MET-WAVG-COST", "MET-HIGH-COST-SHARE"],
      condition: "主体加权成本高于集团余额加权基准 0.25 个百分点，或高成本融资余额占比大于 20%",
      depends: "余额加权平均融资成本、高成本融资余额占比",
      threshold: "高成本融资界限 2.75%",
      evidence: "指标快照、问题融资、机构贡献与借据"
    },
    {
      key: "rule_r02",
      id: "RULE-FLOATING-EXPOSURE",
      type: "Rule",
      code: "R02",
      name: "浮动利率暴露",
      appliesToObjectIds: ["OBJ-FINANCING-ENTITY"],
      dependsOn: ["MET-FLOATING-RATE-SHARE"],
      condition: "浮动利率余额占比大于 80%",
      depends: "浮动利率余额占比",
      threshold: "80%",
      evidence: "指标快照、浮动利率融资、机构贡献与借据"
    },
    {
      key: "rule_r03",
      id: "RULE-SHORT-DEBT",
      type: "Rule",
      code: "R03",
      name: "短期债务集中",
      appliesToObjectIds: ["OBJ-FINANCING-ENTITY"],
      dependsOn: ["MET-SHORT-DEBT-SHARE"],
      condition: "短期债务余额占比大于 30%",
      depends: "短期债务余额占比",
      threshold: "30%",
      evidence: "指标快照、短期融资、机构贡献与借据"
    }
  ];

  var ACTION_TYPE = {
    key: "action_optimize",
    id: "ACTION-FINANCING-OPTIMIZATION",
    type: "Action Type",
    name: "发起融资优化建议",
    target: "融资主体",
    targetObjectId: "OBJ-FINANCING-ENTITY",
    dependsOn: ["RULE-HIGH-COST", "RULE-FLOATING-EXPOSURE", "RULE-SHORT-DEBT", "LINK-ENTITY-FINANCING", "LINK-FINANCING-INSTITUTION", "LINK-ENTITY-OWNER"],
    inputs: "命中 Rule、指标快照、数据截至时间、优先协商银行、候选融资明细、建议方向、精确本体版本",
    precondition: "同一 Published 版本中的 Rule 与证据完整",
    result: "创建待确认的 Action 请求",
    confirmation: "必须人工确认后，才由决策中心按主体—负责人关系形成待办",
    prohibited: "不直接修改融资事实，不直接创建负责人待办"
  };

  var LEGACY_SEMANTIC_KEY_MAP = {
    "prop.financing_subject.unit_code": "PROP-FINANCING-ENTITY-UNIT-CODE",
    "prop.financing_subject.unit_name": "PROP-FINANCING-ENTITY-UNIT-NAME",
    "prop.financing_subject.sector": "PROP-FINANCING-ENTITY-SECTOR",
    "prop.financing_detail.loan_id": "PROP-FINANCING-DETAIL-LOAN-ID",
    "prop.financing_detail.domestic_overseas": "PROP-FINANCING-DETAIL-DOMESTIC-OVERSEAS",
    "prop.financing_detail.drawdown_date": "PROP-FINANCING-DETAIL-DRAWDOWN-DATE",
    "prop.financing_detail.maturity_date": "PROP-FINANCING-DETAIL-MATURITY-DATE",
    "prop.financing_detail.currency": "PROP-FINANCING-DETAIL-CURRENCY",
    "prop.financing_detail.fx_rate": "PROP-FINANCING-DETAIL-FX-RATE",
    "prop.financing_detail.original_balance": "PROP-FINANCING-DETAIL-ORIGINAL-BALANCE",
    "prop.financing_detail.cny_balance": "PROP-FINANCING-DETAIL-CNY-BALANCE",
    "prop.financing_detail.interest_rate": "PROP-FINANCING-DETAIL-INTEREST-RATE",
    "prop.financing_detail.rate_type": "PROP-FINANCING-DETAIL-RATE-TYPE",
    "prop.financing_detail.financing_type": "PROP-FINANCING-DETAIL-FINANCING-TYPE",
    "prop.financing_detail.term_type": "PROP-FINANCING-DETAIL-TERM-TYPE",
    "prop.financing_detail.guarantee_type": "PROP-FINANCING-DETAIL-GUARANTEE-TYPE",
    "prop.financing_institution.institution_code": "PROP-FINANCIAL-INSTITUTION-CODE",
    "prop.financing_institution.institution_name": "PROP-FINANCIAL-INSTITUTION-NAME",
    "prop.financing_institution.institution_category": "PROP-FINANCIAL-INSTITUTION-CATEGORY",
    "prop.financing_owner.owner_id": "PROP-FINANCING-OWNER-ID",
    "prop.financing_owner.owner_name": "PROP-FINANCING-OWNER-NAME"
  };

  var LEGACY_SEMANTIC_ID_MAP = Object.assign({
    "ontology.group_financing_optimization": "ONT-GROUP-FINANCING-OPTIMIZATION",
    "obj.financing_subject": "OBJ-FINANCING-ENTITY",
    "obj.financing_detail": "OBJ-FINANCING-DETAIL",
    "obj.financing_institution": "OBJ-FINANCIAL-INSTITUTION",
    "obj.financing_owner": "OBJ-FINANCING-OWNER",
    "link.subject_has_detail": "LINK-ENTITY-FINANCING",
    "link.detail_to_institution": "LINK-FINANCING-INSTITUTION",
    "link.subject_to_owner": "LINK-ENTITY-OWNER",
    "metric.financing_balance": "MET-FIN-BALANCE",
    "metric.weighted_financing_cost": "MET-WAVG-COST",
    "metric.floating_rate_ratio": "MET-FLOATING-RATE-SHARE",
    "metric.short_term_debt_ratio": "MET-SHORT-DEBT-SHARE",
    "metric.foreign_currency_ratio": "MET-FX-FINANCING-SHARE",
    "metric.high_cost_ratio": "MET-HIGH-COST-SHARE",
    "metric.credit_financing_ratio": "MET-CREDIT-FINANCING-SHARE",
    "rule.R01": "RULE-HIGH-COST",
    "rule.R02": "RULE-FLOATING-EXPOSURE",
    "rule.R03": "RULE-SHORT-DEBT",
    "action.request_financing_optimization": "ACTION-FINANCING-OPTIMIZATION"
  }, LEGACY_SEMANTIC_KEY_MAP);

  var PUBLISHED_ENDPOINT_ID_MAP = {
    "field.detail.subject_code": "FIELD-FINANCING-DETAIL-ENTITY-CODE",
    "field.detail.institution_code": "FIELD-FINANCING-DETAIL-INSTITUTION-CODE",
    "field.subject.owner_id": "FIELD-FINANCING-ENTITY-OWNER-ID"
  };

  var MEMBERS = [
    { key: "member_subject", id: "member.financing_subject_ref", name: "融资主体参考", grain: "一行一个融资主体", rows: "574", identity: "单位编码", supports: "融资主体" },
    { key: "member_detail", id: "member.financing_detail", name: "融资明细", grain: "一行一笔借据", rows: "5,218", identity: "借据编号", supports: "融资明细、主体—明细关系、明细—机构关系" },
    { key: "member_institution", id: "member.financing_institution_ref", name: "金融机构参考", grain: "一行一个融资机构", rows: "24", identity: "机构编码", supports: "融资机构" },
    { key: "member_owner", id: "member.financing_owner_ref", name: "融资负责人参考", grain: "一行一个融资负责人", rows: "24", identity: "负责人标识", supports: "融资负责人、主体—负责人关系（574 条）" }
  ];

  var MEMBER_BY_OBJECT = {
    subject: "member_subject",
    detail: "member_detail",
    institution: "member_institution",
    owner: "member_owner"
  };

  var EXTRA_SOURCE_FIELDS = {
    subject: [
      { key: "field.subject.owner_id", name: "负责人标识", type: "文本", roleHint: "Link 端点", examples: ["OWNER-001", "OWNER-009", "OWNER-009"] }
    ],
    detail: [
      { key: "field.detail.subject_code", name: "主体单位编码", type: "文本", roleHint: "Link 端点", examples: ["UNIT-553", "UNIT-465", "UNIT-561"] },
      { key: "field.detail.institution_code", name: "机构编码", type: "文本", roleHint: "Link 端点", examples: ["INST-012", "INST-014", "INST-018"] }
    ],
    institution: [],
    owner: []
  };

  var OBJECT_PREVIEW_VALUES = {
    subject: ["UNIT-553 · 单位553 · 集团及直管公司", "UNIT-465 · 单位465 · 核能", "UNIT-561 · 单位561 · 核技术"],
    detail: ["LOAN-004842 · 欧陆银行 · 12.560 亿元", "LOAN-003493 · 融通银行 · 3.580 亿元", "LOAN-005007 · 同州银行 · 0.235 亿元"],
    institution: ["INST-012 · 欧陆银行", "INST-014 · 融通银行", "INST-018 · 同州银行"],
    owner: ["OWNER-001 · 融资负责人001", "OWNER-009 · 融资负责人009", "OWNER-009 · 融资负责人009"]
  };

  var UNIT_DATA = {
    "553": {
      code: "单位553",
      identity: "UNIT-553",
      sector: "集团及直管公司",
      rule: "R01",
      ruleName: "融资成本偏高",
      loanCount: 75,
      balance: 393.134,
      cost: "2.881%",
      keyRatioName: "高成本融资余额占比",
      keyRatio: "77.337%",
      problemBalance: "304.039 亿元",
      problemCount: 54,
      owner: "融资负责人001",
      ownerId: "OWNER-001",
      other: "浮动利率余额占比 0%；短期债务余额占比 0%",
      banks: [
        { id: "INST-012", name: "欧陆银行", problemAmount: 99.586, problemRatio: "32.754%", problemLoanCount: 16, unitBankAmount: 108.848, unitBankLoanCount: 19, institutionSubjectCount: 17, institutionLoanCount: 48 },
        { id: "INST-010", name: "寰宇银行", problemAmount: 65.494, problemRatio: "21.541%", problemLoanCount: 11, unitBankAmount: 82.436, unitBankLoanCount: 16, institutionSubjectCount: 16, institutionLoanCount: 44 },
        { id: "INST-006", name: "海联银行", problemAmount: 58.476, problemRatio: "19.233%", problemLoanCount: 10, unitBankAmount: 98.175, unitBankLoanCount: 17, institutionSubjectCount: 14, institutionLoanCount: 47 }
      ]
    },
    "465": {
      code: "单位465",
      identity: "UNIT-465",
      sector: "核能",
      rule: "R02",
      ruleName: "浮动利率暴露",
      loanCount: 176,
      balance: 770.000,
      cost: "2.197%",
      keyRatioName: "浮动利率余额占比",
      keyRatio: "100.000%",
      problemBalance: "770.000 亿元",
      problemCount: 176,
      owner: "融资负责人009",
      ownerId: "OWNER-009",
      other: "高成本融资余额占比未越线；短期债务余额占比未越线",
      banks: [
        { id: "INST-014", name: "融通银行", problemAmount: 249.081, problemRatio: "32.348%", problemLoanCount: 60, unitBankAmount: 249.081, unitBankLoanCount: 60, institutionSubjectCount: 164, institutionLoanCount: 423 },
        { id: "INST-013", name: "启明银行", problemAmount: 237.763, problemRatio: "30.878%", problemLoanCount: 46, unitBankAmount: 237.763, unitBankLoanCount: 46, institutionSubjectCount: 151, institutionLoanCount: 439 },
        { id: "INST-011", name: "嘉禾银行", problemAmount: 221.527, problemRatio: "28.770%", problemLoanCount: 55, unitBankAmount: 221.527, unitBankLoanCount: 55, institutionSubjectCount: 174, institutionLoanCount: 439 }
      ]
    },
    "561": {
      code: "单位561",
      identity: "UNIT-561",
      sector: "核技术",
      rule: "R03",
      ruleName: "短期债务集中",
      loanCount: 50,
      balance: 20.016,
      cost: "2.228%",
      keyRatioName: "短期债务余额占比",
      keyRatio: "93.545%",
      problemBalance: "18.724 亿元",
      problemCount: 49,
      owner: "融资负责人009",
      ownerId: "OWNER-009",
      other: "高成本融资余额占比未越线；浮动利率余额占比未越线",
      banks: [
        { id: "INST-018", name: "同州银行", problemAmount: 5.047, problemRatio: "26.955%", problemLoanCount: 10, unitBankAmount: 6.339, unitBankLoanCount: 11, institutionSubjectCount: 171, institutionLoanCount: 393 },
        { id: "INST-020", name: "星河银行", problemAmount: 4.603, problemRatio: "24.583%", problemLoanCount: 11, unitBankAmount: 4.603, unitBankLoanCount: 11, institutionSubjectCount: 154, institutionLoanCount: 384 },
        { id: "INST-007", name: "恒信银行", problemAmount: 3.662, problemRatio: "19.558%", problemLoanCount: 11, unitBankAmount: 3.662, unitBankLoanCount: 11, institutionSubjectCount: 158, institutionLoanCount: 386 }
      ]
    }
  };

  var LOAN_SAMPLES = {
    "553": [
      { id: "LOAN-004842", unit: "单位553", bank: "欧陆银行", bankId: "INST-012", amount: 12.560, rate: "2.90%", rateType: "固定利率", term: "长期", currency: "英镑", drawDate: "2019-11-11", dueDate: "2049-09-27" },
      { id: "LOAN-004840", unit: "单位553", bank: "寰宇银行", bankId: "INST-010", amount: 4.596, rate: "2.90%", rateType: "固定利率", term: "长期", currency: "英镑", drawDate: "2019-09-16", dueDate: "2049-09-27" }
    ],
    "465": [
      { id: "LOAN-003493", unit: "单位465", bank: "融通银行", bankId: "INST-014", amount: 3.580, rate: "2.25%", rateType: "浮动利率", term: "长期", currency: "人民币", drawDate: "2024-03-18", dueDate: "2050-10-21" },
      { id: "LOAN-003497", unit: "单位465", bank: "启明银行", bankId: "INST-013", amount: 9.743, rate: "2.15%", rateType: "浮动利率", term: "长期", currency: "人民币", drawDate: "2024-02-26", dueDate: "2051-09-13" }
    ],
    "561": [
      { id: "LOAN-005007", unit: "单位561", bank: "同州银行", bankId: "INST-018", amount: 0.235, rate: "2.20%", rateType: "固定利率", term: "短期", currency: "人民币", drawDate: "2025-08-11", dueDate: "2026-08-10" },
      { id: "LOAN-004941", unit: "单位561", bank: "星河银行", bankId: "INST-020", amount: 0.123, rate: "2.26%", rateType: "固定利率", term: "短期", currency: "人民币", drawDate: "2025-04-10", dueDate: "2026-04-09" }
    ]
  };

  var OWNER_DATA = {
    "OWNER-001": { title: "融资负责人001", subjectCount: 24, featuredUnits: ["553"] },
    "OWNER-009": { title: "融资负责人009", subjectCount: 24, featuredUnits: ["465", "561"] }
  };

  var COMBINATIONS = [
    { units: "单位553 + 单位465 + 单位561", balance: "1,183.150 亿元", cost: "2.425%" },
    { units: "单位553 + 单位465", balance: "1,163.134 亿元", cost: "2.428%" },
    { units: "单位553 + 单位561", balance: "413.150 亿元", cost: "2.849%" },
    { units: "单位465 + 单位561", balance: "790.016 亿元", cost: "2.197%" }
  ];

  var FIXED_QUESTIONS = [
    { code: "Q01", title: "四类对象与三条关系可发现", focus: "稳定身份、关系方向和端点" },
    { code: "Q02", title: "集团融资成本与债务结构", focus: "余额、成本、范围与时点" },
    { code: "Q03", title: "单位553命中 R01", focus: "2.881%、前三家银行与融资负责人001" },
    { code: "Q04", title: "单位465命中 R02", focus: "100%、前三家银行与融资负责人009" },
    { code: "Q05", title: "单位561命中 R03", focus: "93.545%、前三家银行与融资负责人009" },
    { code: "Q06", title: "三家综合融资成本", focus: "1,183.150 亿元、2.425%" },
    { code: "Q07", title: "任意两家综合融资成本", focus: "按融资明细并集余额加权" },
    { code: "Q08", title: "Action Type 同版可发现", focus: "目标、参数、前置证据与人工确认" }
  ];

  var DEFAULT_POSITIONS = {
    subject: { x: 125, y: 220 },
    detail: { x: 390, y: 220 },
    institution: { x: 670, y: 100 },
    owner: { x: 390, y: 430 },
    metric_group: { x: 660, y: 330 },
    rule_group: { x: 890, y: 330 },
    action_optimize: { x: 1040, y: 515 }
  };

  var NODE_DEFINITIONS = [
    { key: "subject", name: "融资主体", kind: "object", type: "Object Type", rows: "574 个实例", meta: "身份：单位编码" },
    { key: "detail", name: "融资明细", kind: "object", type: "Object Type", rows: "5,218 个实例", meta: "身份：借据编号" },
    { key: "institution", name: "融资机构", kind: "object", type: "Object Type", rows: "24 个实例", meta: "身份：机构编码" },
    { key: "owner", name: "融资负责人", kind: "object", type: "Object Type", rows: "24 个实例", meta: "关系事实：574 条" },
    { key: "metric_group", name: "融资指标", kind: "logic", type: "Metric", rows: "7 个定义", meta: "集团 / 单一融资主体 / 融资主体集合" },
    { key: "rule_group", name: "融资规则", kind: "rule", type: "Rule", rows: "R01 · R02 · R03", meta: "当前业务基线" },
    { key: "action_optimize", name: "发起融资优化建议", kind: "action", type: "Action Type", rows: "目标：融资主体", meta: "人工确认后形成待办" }
  ];

  var EDGE_DEFINITIONS = [
    { from: "subject", to: "detail", label: "拥有融资 1:N" },
    { from: "detail", to: "institution", label: "由机构提供 N:1" },
    { from: "subject", to: "owner", label: "由负责人承接 N:1" },
    { from: "subject", to: "metric_group", label: "计算" },
    { from: "metric_group", to: "rule_group", label: "判断" },
    { from: "rule_group", to: "action_optimize", label: "允许请求" }
  ];

  function canonicalSemanticKey(key) {
    return LEGACY_SEMANTIC_KEY_MAP[key] || key;
  }

  function canonicalSemanticId(id) {
    return LEGACY_SEMANTIC_ID_MAP[id] || id;
  }

  function publishedEndpointIdentity(key) {
    return PUBLISHED_ENDPOINT_ID_MAP[key] || key;
  }

  function canonicalKeyList(keys) {
    return (Array.isArray(keys) ? keys : []).map(canonicalSemanticKey);
  }

  function canonicalAssignmentMap(assignments) {
    var normalized = {};
    Object.keys(assignments || {}).forEach(function (key) {
      normalized[key] = canonicalSemanticKey(assignments[key]);
    });
    return normalized;
  }

  function canonicalResourceIdMap(resourceIds) {
    var normalized = {};
    Object.keys(resourceIds || {}).forEach(function (key) {
      normalized[canonicalSemanticKey(key)] = canonicalSemanticId(resourceIds[key]);
    });
    return normalized;
  }

  function cloneContract(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeResourceContract(resource, fallbackKey) {
    if (!resource) return null;
    var contract = cloneContract(resource);
    contract.key = canonicalSemanticKey(contract.key || fallbackKey);
    if (contract.id) contract.id = canonicalSemanticId(contract.id);
    ["parentId", "identityPropertyId", "titlePropertyId", "sourceObjectId", "targetObjectId"].forEach(function (field) {
      if (contract[field]) contract[field] = canonicalSemanticId(contract[field]);
    });
    ["sourceEndpointKey", "targetEndpointKey"].forEach(function (field) {
      if (contract[field]) contract[field] = publishedEndpointIdentity(canonicalSemanticKey(contract[field]));
    });
    if (contract.appliesToObjectIds) contract.appliesToObjectIds = contract.appliesToObjectIds.map(canonicalSemanticId);
    if (contract.dependsOn) contract.dependsOn = contract.dependsOn.map(canonicalSemanticId);
    if (contract.properties) {
      contract.properties = contract.properties.map(function (property) {
        var frozenProperty = cloneContract(property);
        frozenProperty.key = canonicalSemanticKey(frozenProperty.key);
        frozenProperty.id = canonicalSemanticId(frozenProperty.id);
        return frozenProperty;
      });
    }
    return contract;
  }

  function resourceContract(resource) {
    return normalizeResourceContract(resource, resource.key);
  }

  function snapshotResourceContracts(resources) {
    var contracts = {};
    resources.forEach(function (resource) {
      contracts[resource.key] = resourceContract(resource);
    });
    return contracts;
  }

  function snapshotMemberContracts(assignments) {
    var contracts = {};
    Object.keys(assignments || {}).forEach(function (objectKey) {
      var member = MEMBERS.find(function (item) { return item.key === assignments[objectKey]; });
      if (member) contracts[member.key] = cloneContract(member);
    });
    return contracts;
  }

  function isCompletePublishedResourceContract(contract) {
    if (!contract || !contract.id || !contract.key || !contract.name || !contract.type) return false;
    if (contract.type === "Object Type") return Boolean(contract.definition && contract.identityPropertyId && contract.titlePropertyId && contract.source && Array.isArray(contract.properties));
    if (contract.type === "Property") return Boolean(contract.definition && contract.parentId && contract.parentKey && contract.dataType && contract.role && contract.nullable && contract.source);
    if (contract.type === "Link Type") return Boolean(contract.sourceObjectId && contract.targetObjectId && contract.direction && contract.cardinality && contract.sourceEndpointKey && contract.targetEndpointKey && contract.endpoints);
    if (contract.type === "Metric") return Boolean(contract.definition && contract.unit && contract.scope && contract.zero && Array.isArray(contract.dependsOn));
    if (contract.type === "Rule") return Boolean(contract.condition && contract.threshold && contract.evidence && Array.isArray(contract.dependsOn));
    if (contract.type === "Action Type") return Boolean(contract.targetObjectId && contract.inputs && contract.precondition && contract.result && contract.confirmation && contract.prohibited && Array.isArray(contract.dependsOn));
    return false;
  }

  function stableDependencySummary(resource) {
    if (resource.dependsOn && resource.dependsOn.length) return resource.dependsOn.join("；");
    if (resource.type === "Link Type") {
      return resource.sourceObjectId + " → " + resource.targetObjectId + "；端点 " + resource.sourceEndpointKey + " ↔ " + resource.targetEndpointKey;
    }
    if (resource.type === "Property") return resource.parentId + "；来源字段 “" + resource.source + "”";
    if (resource.type === "Object Type") return resource.identityPropertyId + "；" + resource.titlePropertyId;
    return "由精确 Published 版本内的获准资源确定";
  }

  function normalizePublishedEntry(entry) {
    var normalized = Object.assign({}, entry);
    var legacySnapshot = entry.resourceSnapshotVersion !== 2;
    var fallbackResourceKeys = Object.keys(entry.resourceContracts || {});
    normalized.resourceKeys = canonicalKeyList(entry.resourceKeys || fallbackResourceKeys);
    normalized.identityAssignments = canonicalAssignmentMap(entry.identityAssignments);
    normalized.titleAssignments = canonicalAssignmentMap(entry.titleAssignments);
    normalized.endpointFieldKeys = canonicalKeyList(entry.endpointFieldKeys).map(publishedEndpointIdentity);
    normalized.resourceIds = canonicalResourceIdMap(entry.resourceIds);
    var normalizedContracts = {};
    var storedContractsByKey = {};
    Object.keys(entry.resourceContracts || {}).forEach(function (key) {
      storedContractsByKey[canonicalSemanticKey(key)] = entry.resourceContracts[key];
    });
    normalized.resourceKeys.forEach(function (key) {
      var stored = normalizeResourceContract(storedContractsByKey[key], key);
      if (!stored) return;
      stored.key = key;
      stored.id = canonicalSemanticId(stored.id || normalized.resourceIds[key]);
      normalized.resourceIds[key] = stored.id;
      normalizedContracts[key] = stored;
    });
    normalized.resourceContracts = normalizedContracts;
    normalized.resourceSnapshotVersion = 2;
    normalized.resourceSnapshotComplete = !legacySnapshot && normalized.resourceKeys.length > 0 && normalized.resourceKeys.every(function (key) {
      return isCompletePublishedResourceContract(normalizedContracts[key]);
    });
    normalized.memberContracts = Object.assign({}, entry.memberContracts || {});
    var publishedObjectContracts = normalized.resourceKeys.map(function (key) { return normalizedContracts[key]; }).filter(function (contract) { return contract && contract.type === "Object Type"; });
    normalized.resourceSnapshotComplete = normalized.resourceSnapshotComplete && Boolean(normalized.modelContract && normalized.modelContract.name && normalized.modelContract.definition && normalized.modelContract.scenario) && publishedObjectContracts.length > 0 && publishedObjectContracts.every(function (objectContract) {
      var member = normalized.memberContracts[(normalized.objectMembers || {})[objectContract.key]];
      return Boolean(member && member.id && member.name && member.grain && member.identity);
    });
    return normalized;
  }

  function clonePositions() {
    return JSON.parse(JSON.stringify(DEFAULT_POSITIONS));
  }

  function blankState() {
    return {
      schemaVersion: 5,
      sequence: 0,
      model: null,
      resourceIds: {},
      selectedResource: "subject",
      createdObjectKeys: [],
      createdPropertyKeys: [],
      mappedPropertyKeys: [],
      createdLinkKeys: [],
      createdMetricKeys: [],
      createdRuleKeys: [],
      actionCreated: false,
      objectMembers: {},
      identityAssignments: {},
      titleAssignments: {},
      endpointFieldKeys: [],
      mappingFocus: null,
      selectedSemanticVersion: null,
      draftRevisionBase: null,
      draftChangeSummary: null,
      draftSavedAt: null,
      assetVersion: null,
      assetAsOf: null,
      assetReadAt: null,
      mappingFixed: false,
      mappingPreview: "idle",
      mappingPreviewAt: null,
      baselineConfirmed: true,
      validationStatus: "idle",
      validationAt: null,
      publishStatus: "idle",
      semanticVersion: null,
      publishedAt: null,
      semanticHistory: [],
      candidateCycle: 0,
      candidateVersion: null,
      candidateAsOf: null,
      c028Status: "none",
      c028Id: null,
      c029Status: "none",
      c029Id: null,
      t018Status: "none",
      fixedStatus: "none",
      fixedAttempts: 0,
      candidateMappingFixed: false,
      bindingStatus: "none",
      currentBinding: null,
      previousBinding: null,
      bindingHistory: [],
      authorityQuality: "unchecked",
      currentBlocked: false,
      events: [],
      nodePositions: clonePositions(),
      zoom: 0.86,
      panX: 0,
      panY: 0
    };
  }

  function initialState() {
    var draft = blankState();
    draft.model = {
      id: "ONT-GROUP-FINANCING-OPTIMIZATION",
      name: "集团融资优化本体",
      definition: "围绕融资主体、融资明细、融资机构和融资负责人，统一融资成本、债务结构、问题判断与优化行动的业务语义。",
      scenario: "S001 集团融资成本与债务结构优化",
      createdAt: "现有 Draft"
    };
    draft.createdObjectKeys = OBJECTS.map(function (item) { return item.key; });
    draft.createdPropertyKeys = PROPERTY_RESOURCES.map(function (item) { return item.key; });
    draft.mappedPropertyKeys = PROPERTY_RESOURCES.map(function (item) { return item.key; });
    draft.createdLinkKeys = LINKS.map(function (item) { return item.key; });
    draft.createdMetricKeys = METRICS.map(function (item) { return item.key; });
    draft.createdRuleKeys = RULES.map(function (item) { return item.key; });
    draft.actionCreated = true;
    draft.objectMembers = { subject: "member_subject", detail: "member_detail", institution: "member_institution", owner: "member_owner" };
    draft.identityAssignments = { subject: "PROP-FINANCING-ENTITY-UNIT-CODE", detail: "PROP-FINANCING-DETAIL-LOAN-ID", institution: "PROP-FINANCIAL-INSTITUTION-CODE", owner: "PROP-FINANCING-OWNER-ID" };
    draft.titleAssignments = { subject: "PROP-FINANCING-ENTITY-UNIT-NAME", detail: "PROP-FINANCING-DETAIL-LOAN-ID", institution: "PROP-FINANCIAL-INSTITUTION-NAME", owner: "PROP-FINANCING-OWNER-NAME" };
    draft.endpointFieldKeys = ["PROP-FINANCING-ENTITY-UNIT-CODE", "field.subject.owner_id", "field.detail.subject_code", "field.detail.institution_code", "PROP-FINANCIAL-INSTITUTION-CODE", "PROP-FINANCING-OWNER-ID"];
    draft.assetVersion = FINANCING_DATA_VERSIONS[0].id;
    draft.assetAsOf = FINANCING_DATA_VERSIONS[0].asOf;
    OBJECTS.concat(PROPERTY_RESOURCES, LINKS, METRICS, RULES, [ACTION_TYPE]).forEach(function (resource) {
      draft.resourceIds[resource.key] = resource.id;
    });
    return draft;
  }

  var state = loadState();
  var ui = {
    modal: null,
    drawer: null,
    inspectorTab: "overview",
    detailTab: "overview",
    versionTab: "overview",
    dockTab: "events",
    treeQuery: "",
    collapsed: {},
    consumer: "qa",
    catalogView: "cards",
    canvasView: "semantic",
    selectedUnit: null,
    selectedLoan: null,
    selectedBank: null,
    selectedOwner: null,
    selectedDetailResource: null,
    selectedEventId: null,
    memberObject: null,
    publishedSection: "consumption",
    returnModal: null,
    drag: null
  };

  function loadState() {
    try {
      var parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!parsed) return initialState();
      var restored = Object.assign(initialState(), parsed, {
        nodePositions: Object.assign(clonePositions(), parsed.nodePositions || {})
      });
      if (!parsed.schemaVersion && restored.model) {
        restored.createdObjectKeys = OBJECTS.map(function (item) { return item.key; });
        restored.createdPropertyKeys = PROPERTY_RESOURCES.map(function (item) { return item.key; });
        restored.mappedPropertyKeys = PROPERTY_RESOURCES.map(function (item) { return item.key; });
        restored.createdLinkKeys = LINKS.map(function (item) { return item.key; });
        restored.createdMetricKeys = METRICS.map(function (item) { return item.key; });
        restored.createdRuleKeys = RULES.map(function (item) { return item.key; });
        restored.actionCreated = true;
        restored.objectMembers = { subject: "member_subject", detail: "member_detail", institution: "member_institution", owner: "member_owner" };
        restored.identityAssignments = { subject: "PROP-FINANCING-ENTITY-UNIT-CODE", detail: "PROP-FINANCING-DETAIL-LOAN-ID", institution: "PROP-FINANCIAL-INSTITUTION-CODE", owner: "PROP-FINANCING-OWNER-ID" };
        restored.titleAssignments = { subject: "PROP-FINANCING-ENTITY-UNIT-NAME", detail: "PROP-FINANCING-DETAIL-LOAN-ID", institution: "PROP-FINANCIAL-INSTITUTION-NAME", owner: "PROP-FINANCING-OWNER-NAME" };
        restored.endpointFieldKeys = ["PROP-FINANCING-ENTITY-UNIT-CODE", "field.subject.owner_id", "field.detail.subject_code", "field.detail.institution_code", "PROP-FINANCIAL-INSTITUTION-CODE", "PROP-FINANCING-OWNER-ID"];
        restored.schemaVersion = 2;
      }
      restored.createdObjectKeys = Array.isArray(restored.createdObjectKeys) ? restored.createdObjectKeys : [];
      restored.createdPropertyKeys = Array.isArray(restored.createdPropertyKeys) ? restored.createdPropertyKeys : [];
      restored.mappedPropertyKeys = Array.isArray(restored.mappedPropertyKeys) ? restored.mappedPropertyKeys : [];
      restored.createdLinkKeys = Array.isArray(restored.createdLinkKeys) ? restored.createdLinkKeys : [];
      restored.createdMetricKeys = Array.isArray(restored.createdMetricKeys) ? restored.createdMetricKeys : [];
      restored.createdRuleKeys = Array.isArray(restored.createdRuleKeys) ? restored.createdRuleKeys : [];
      restored.endpointFieldKeys = Array.isArray(restored.endpointFieldKeys) ? restored.endpointFieldKeys : [];
      restored.createdPropertyKeys = canonicalKeyList(restored.createdPropertyKeys);
      restored.mappedPropertyKeys = canonicalKeyList(restored.mappedPropertyKeys);
      restored.endpointFieldKeys = canonicalKeyList(restored.endpointFieldKeys);
      restored.identityAssignments = canonicalAssignmentMap(restored.identityAssignments);
      restored.titleAssignments = canonicalAssignmentMap(restored.titleAssignments);
      restored.selectedResource = canonicalSemanticKey(restored.selectedResource);
      restored.mappingFocus = canonicalSemanticKey(restored.mappingFocus);
      restored.resourceIds = canonicalResourceIdMap(restored.resourceIds);
      if (restored.model && restored.model.id) restored.model.id = canonicalSemanticId(restored.model.id);
      restored.events = (Array.isArray(restored.events) ? restored.events : []).map(function (event) {
        return Object.assign({}, event, { id: canonicalSemanticId(event.id) });
      });
      restored.semanticHistory = (Array.isArray(restored.semanticHistory) ? restored.semanticHistory : []).map(normalizePublishedEntry);
      restored.schemaVersion = 5;
      if (restored.mappingPreview === "processing") restored.mappingPreview = "idle";
      if (restored.validationStatus === "processing") restored.validationStatus = "idle";
      if (restored.publishStatus === "processing") restored.publishStatus = "idle";
      if (restored.c028Status === "processing") {
        restored.candidateCycle = Math.max(0, restored.candidateCycle - 1);
        restored.candidateVersion = null;
        restored.candidateAsOf = null;
        restored.c028Status = "none";
        restored.c028Id = null;
      }
      if (restored.c029Status === "processing") {
        restored.c029Status = "none";
        restored.c029Id = null;
        restored.t018Status = "none";
      }
      if (restored.fixedStatus === "processing") restored.fixedStatus = "none";
      if (restored.bindingStatus === "processing") restored.bindingStatus = restored.currentBinding ? "ready" : "none";
      if (restored.authorityQuality === "processing") restored.authorityQuality = "unchecked";
      if (restored.previousBinding && (!restored.currentBinding || restored.previousBinding.semanticVersion !== restored.currentBinding.semanticVersion)) {
        restored.previousBinding = null;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(restored));
      return restored;
    } catch (error) {
      return initialState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function patchState(values) {
    Object.keys(values).forEach(function (key) {
      state[key] = values[key];
    });
    saveState();
    render();
  }

  function two(value) {
    return String(value).padStart(2, "0");
  }

  function stamp() {
    var date = new Date();
    return date.getFullYear() + two(date.getMonth() + 1) + two(date.getDate()) + "-" + two(date.getHours()) + two(date.getMinutes()) + two(date.getSeconds());
  }

  function nowText() {
    return new Date().toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-");
  }

  function nextId(prefix) {
    state.sequence += 1;
    return prefix + "-" + stamp() + "-" + String(state.sequence).padStart(3, "0");
  }

  function addEvent(kind, title, detail, tone, explicitId) {
    var evidenceId = explicitId || nextId("EV");
    state.events.unshift({
      id: evidenceId,
      time: nowText(),
      kind: kind,
      title: title,
      detail: detail,
      tone: tone || "info",
      semanticVersion: state.draftRevisionBase ? null : state.semanticVersion || null
    });
    state.events = state.events.slice(0, 80);
    saveState();
    return evidenceId;
  }

  function completeAsync(startValues, delay, endValues, eventInfo, callback) {
    Object.keys(startValues).forEach(function (key) {
      state[key] = startValues[key];
    });
    saveState();
    render();
    window.setTimeout(function () {
      Object.keys(endValues).forEach(function (key) {
        state[key] = endValues[key];
      });
      if (eventInfo) {
        addEvent(eventInfo.kind, eventInfo.title, eventInfo.detail, eventInfo.tone, eventInfo.id);
      }
      saveState();
      render();
      if (callback) callback();
    }, delay);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
      }[character];
    });
  }

  function formatNumber(value) {
    return Number(value).toLocaleString("zh-CN", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  }

  function formatProblemAmount(value) {
    return Number(value).toLocaleString("zh-CN", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  }

  function status(text, tone, processing) {
    return '<span class="status ' + escapeHtml(tone || "") + (processing ? " processing" : "") + '">' + escapeHtml(text) + "</span>";
  }

  function button(label, action, options) {
    var settings = options || {};
    var className = [
      "btn",
      settings.primary ? "primary" : "",
      settings.danger ? "danger" : "",
      settings.ghost ? "ghost" : "",
      settings.small ? "small" : ""
    ].filter(Boolean).join(" ");
    var attributes = [
      'type="button"',
      'class="' + className + '"',
      'data-action="' + escapeHtml(action) + '"',
      settings.disabled ? "disabled" : "",
      settings.title ? 'title="' + escapeHtml(settings.title) + '"' : ""
    ].filter(Boolean).join(" ");
    return "<button " + attributes + ">" + escapeHtml(label) + "</button>";
  }

  function iconButton(label, action, title, disabled) {
    return '<button type="button" class="icon-btn small" data-action="' + escapeHtml(action) + '" title="' + escapeHtml(title || label) + '"' + (disabled ? " disabled" : "") + ">" + escapeHtml(label) + "</button>";
  }

  function toast(message, tone) {
    var region = document.getElementById("toast-region");
    if (!region) return;
    var item = document.createElement("div");
    item.className = "toast " + (tone || "");
    item.textContent = message;
    region.appendChild(item);
    window.setTimeout(function () {
      item.remove();
    }, 3200);
  }

  function route() {
    return location.hash.replace(/^#/, "").split("?")[0] || "model";
  }

  function navigate(target) {
    if (location.hash === "#" + target) render();
    else location.hash = target;
  }

  function allResourceTemplates() {
    return OBJECTS.concat(PROPERTY_RESOURCES, LINKS, METRICS, RULES, [ACTION_TYPE]);
  }

  function createdObjects() {
    return OBJECTS.filter(function (item) { return state.createdObjectKeys.indexOf(item.key) >= 0; });
  }

  function createdProperties() {
    return PROPERTY_RESOURCES.filter(function (item) { return state.createdPropertyKeys.indexOf(item.key) >= 0; });
  }

  function createdLinks() {
    return LINKS.filter(function (item) { return state.createdLinkKeys.indexOf(item.key) >= 0; });
  }

  function createdMetrics() {
    return METRICS.filter(function (item) { return state.createdMetricKeys.indexOf(item.key) >= 0; });
  }

  function createdRules() {
    return RULES.filter(function (item) { return state.createdRuleKeys.indexOf(item.key) >= 0; });
  }

  function draftResources() {
    return createdObjects().concat(createdProperties(), createdLinks(), createdMetrics(), createdRules(), state.actionCreated ? [ACTION_TYPE] : []);
  }

  function resourceCounts() {
    return {
      objects: createdObjects().length,
      properties: createdProperties().length,
      links: createdLinks().length,
      metrics: createdMetrics().length,
      rules: createdRules().length,
      actions: state.actionCreated ? 1 : 0,
      total: draftResources().length
    };
  }

  function isResourceCreated(key) {
    return draftResources().some(function (item) { return item.key === key; });
  }

  function objectByKey(key) {
    return OBJECTS.find(function (item) { return item.key === key; });
  }

  function objectForResource(resource) {
    if (!resource) return null;
    if (resource.type === "Object Type") return resource;
    if (resource.type === "Property") return objectByKey(resource.parentKey);
    return null;
  }

  function publishedObjectForResource(resource, version) {
    if (!resource) return null;
    if (resource.type === "Object Type") return resource;
    if (resource.type !== "Property") return null;
    return publishedResources(version).find(function (item) { return item.type === "Object Type" && item.key === resource.parentKey; }) || null;
  }

  function sourceFieldsForObject(objectKey) {
    var object = objectByKey(objectKey);
    if (!object) return [];
    return object.properties.map(function (property, index) {
      var previewSets = {
        subject: [["UNIT-553", "UNIT-465", "UNIT-561"], ["单位553", "单位465", "单位561"], ["集团及直管公司", "核能", "核技术"]],
        detail: [["LOAN-004842", "LOAN-003493", "LOAN-005007"], ["境外", "境内", "境内"], ["2019-11-11", "2024-03-18", "2025-08-11"], ["2049-09-27", "2050-10-21", "2026-08-10"], ["英镑", "人民币", "人民币"], ["8.912", "1.000", "1.000"], ["1.409", "3.580", "0.235"], ["12.560", "3.580", "0.235"], ["2.90%", "2.25%", "2.20%"], ["固定利率", "浮动利率", "固定利率"], ["银行贷款", "银行贷款", "银行贷款"], ["长期", "长期", "短期"], ["信用", "信用", "保证"]],
        institution: [["INST-012", "INST-014", "INST-018"], ["欧陆银行", "融通银行", "同州银行"], ["商业银行", "商业银行", "商业银行"]],
        owner: [["OWNER-001", "OWNER-009", "OWNER-009"], ["融资负责人001", "融资负责人009", "融资负责人009"]]
      };
      return {
        key: property.key,
        propertyKey: property.key,
        name: property.source,
        type: property.type,
        roleHint: property.role,
        examples: (previewSets[objectKey] && previewSets[objectKey][index]) || ["—", "—", "—"]
      };
    }).concat(EXTRA_SOURCE_FIELDS[objectKey] || []);
  }

  function requiredEndpointFieldsReady() {
    var required = ["PROP-FINANCING-ENTITY-UNIT-CODE", "field.subject.owner_id", "field.detail.subject_code", "field.detail.institution_code", "PROP-FINANCIAL-INSTITUTION-CODE", "PROP-FINANCING-OWNER-ID"];
    return required.every(function (key) { return state.endpointFieldKeys.indexOf(key) >= 0; });
  }

  function expectedIdentityKey(objectKey) {
    return {
      subject: "PROP-FINANCING-ENTITY-UNIT-CODE",
      detail: "PROP-FINANCING-DETAIL-LOAN-ID",
      institution: "PROP-FINANCIAL-INSTITUTION-CODE",
      owner: "PROP-FINANCING-OWNER-ID"
    }[objectKey] || null;
  }

  function expectedTitleKey(objectKey) {
    return {
      subject: "PROP-FINANCING-ENTITY-UNIT-NAME",
      detail: "PROP-FINANCING-DETAIL-LOAN-ID",
      institution: "PROP-FINANCIAL-INSTITUTION-NAME",
      owner: "PROP-FINANCING-OWNER-NAME"
    }[objectKey] || null;
  }

  function isEndpointFieldKey(key) {
    return [
      "PROP-FINANCING-ENTITY-UNIT-CODE",
      "field.subject.owner_id",
      "field.detail.subject_code",
      "field.detail.institution_code",
      "PROP-FINANCIAL-INSTITUTION-CODE",
      "PROP-FINANCING-OWNER-ID"
    ].indexOf(key) >= 0;
  }

  function objectConfigurationReady(object) {
    if (!object) return false;
    var propertyKeys = object.properties.map(function (item) { return item.key; });
    return Boolean(state.objectMembers[object.key]) &&
      propertyKeys.every(function (key) { return state.createdPropertyKeys.indexOf(key) >= 0 && state.mappedPropertyKeys.indexOf(key) >= 0; }) &&
      Boolean(state.identityAssignments[object.key]) && Boolean(state.titleAssignments[object.key]);
  }

  function allObjectMappingsReady() {
    return createdObjects().length === OBJECTS.length && OBJECTS.every(objectConfigurationReady);
  }

  function currentObject() {
    var selected = resourceByKey(state.selectedResource);
    return objectForResource(selected) || createdObjects()[0] || null;
  }

  function activeNodeDefinitions() {
    var nodes = NODE_DEFINITIONS.filter(function (node) {
      if (["subject", "detail", "institution", "owner"].indexOf(node.key) >= 0) return state.createdObjectKeys.indexOf(node.key) >= 0;
      if (node.key === "metric_group") return state.createdMetricKeys.length > 0;
      if (node.key === "rule_group") return state.createdRuleKeys.length > 0;
      if (node.key === "action_optimize") return state.actionCreated;
      return false;
    });
    return nodes.map(function (node) {
      if (node.key === "metric_group") return Object.assign({}, node, { rows: state.createdMetricKeys.length + " / 7 个定义" });
      if (node.key === "rule_group") return Object.assign({}, node, { rows: state.createdRuleKeys.length + " / 3 个定义" });
      return node;
    });
  }

  function activeEdgeDefinitions() {
    return EDGE_DEFINITIONS.filter(function (edge) {
      if (edge.from === "subject" && edge.to === "detail") return state.createdLinkKeys.indexOf("link_subject_detail") >= 0;
      if (edge.from === "detail" && edge.to === "institution") return state.createdLinkKeys.indexOf("link_detail_institution") >= 0;
      if (edge.from === "subject" && edge.to === "owner") return state.createdLinkKeys.indexOf("link_subject_owner") >= 0;
      if (edge.to === "metric_group") return state.createdMetricKeys.length > 0 && state.createdObjectKeys.indexOf("subject") >= 0;
      if (edge.from === "metric_group" && edge.to === "rule_group") return state.createdMetricKeys.length > 0 && state.createdRuleKeys.length > 0;
      if (edge.to === "action_optimize") return state.createdRuleKeys.length > 0 && state.actionCreated;
      return false;
    });
  }

  function publishedEntry(version) {
    var explicitVersion = arguments.length > 0 && version !== null && version !== undefined && version !== "";
    var wanted = explicitVersion ? version : state.selectedSemanticVersion || state.semanticVersion;
    if (wanted) {
      return state.semanticHistory.find(function (item) { return item.semanticVersion === wanted; }) || null;
    }
    return state.semanticHistory[0] || null;
  }

  function activePublishedVersion() {
    var entry = publishedEntry();
    return entry ? entry.semanticVersion : null;
  }

  function isCurrentOfficialVersion(version) {
    return Boolean(state.currentBinding && state.currentBinding.semanticVersion === version);
  }

  function semanticVersionStatus(version) {
    if (isCurrentOfficialVersion(version)) {
      var currentEntry = publishedEntry(version);
      if (!currentEntry || !currentEntry.resourceSnapshotComplete) return status("当前正式记录 · 快照不完整", "red");
      return status(state.currentBlocked ? "当前正式使用 · 已阻断" : "当前正式使用", state.currentBlocked ? "red" : "green");
    }
    if (version === state.semanticVersion) return status("最新 Published", "blue");
    return status("历史 Published", "");
  }

  function publishedResources(version) {
    var entry = publishedEntry(version);
    if (!entry) return [];
    var keys = entry.resourceKeys || [];
    return keys.map(function (key) {
      var contract = entry.resourceContracts && entry.resourceContracts[key];
      if (!contract) return null;
      var frozen = cloneContract(contract);
      frozen.key = key;
      frozen.id = frozen.id || entry.resourceIds && entry.resourceIds[key];
      return frozen;
    }).filter(Boolean);
  }

  function resourceId(key, version) {
    var publishedVersion = version;
    if (!publishedVersion && ["catalog", "version-detail", "resource-detail", "consumption", "history"].indexOf(route()) >= 0) {
      publishedVersion = activePublishedVersion();
    }
    var entry = publishedVersion ? publishedEntry(publishedVersion) : null;
    if (publishedVersion || ["catalog", "version-detail", "resource-detail", "consumption", "history"].indexOf(route()) >= 0) {
      if (!entry) return "无法定位版本";
      if (entry.resourceContracts && entry.resourceContracts[key] && entry.resourceContracts[key].id) return entry.resourceContracts[key].id;
      if (entry.resourceIds && entry.resourceIds[key]) return entry.resourceIds[key];
      return "资源身份缺失";
    }
    var resource = allResourceTemplates().concat(MEMBERS).find(function (item) { return item.key === key; });
    return resource && resource.id ? resource.id : "非独立资源分组";
  }

  function resourceByKey(key) {
    if (key === "metric_group") {
      return {
        key: key,
        type: "Metric 集合",
        name: "融资指标",
        definition: "七个随同一 Published 语义版本发布的融资 Metric。",
        items: METRICS
      };
    }
    if (key === "rule_group") {
      return {
        key: key,
        type: "Rule 集合",
        name: "融资规则",
        definition: "三条面向不同融资问题的业务判断合同。",
        items: RULES
      };
    }
    var member = MEMBERS.find(function (item) { return item.key === key; });
    if (member) {
      return Object.assign({}, member, {
        type: "数据资产成员",
        definition: member.grain + "；支持 " + member.supports + "。本体只读选择与映射，不维护该成员的数据加工或发布。"
      });
    }
    return allResourceTemplates().find(function (item) {
      return item.key === key;
    }) || OBJECTS[0];
  }

  function generateResourceIds() {
    var ids = {};
    allResourceTemplates().forEach(function (resource) {
      ids[resource.key] = resource.id;
    });
    return ids;
  }

  function generateLoans(unitKey) {
    return (LOAN_SAMPLES[unitKey] || []).slice();
  }

  function semanticStateLabel() {
    if (state.publishStatus === "processing") return status("发布中", "blue", true);
    if (state.draftRevisionBase) return status("Draft 编辑中", "amber");
    if (state.semanticVersion) return status("已发布", "green");
    if (state.validationStatus === "success") return status("可发布", "blue");
    if (state.model) return status("编辑中", "amber");
    return status("未开始", "");
  }

  function dataStateLabel() {
    var currentEntry = state.currentBinding ? publishedEntry(state.currentBinding.semanticVersion) : null;
    if (state.currentBinding && (!currentEntry || !currentEntry.resourceSnapshotComplete)) return status("消费上下文不完整", "red");
    if (state.currentBlocked) return status("当前正式版本已阻断", "red");
    if (state.bindingStatus === "processing") return status("正在切换正式数据", "blue", true);
    if (state.currentBinding) return status("正式数据服务中", "green");
    if (state.c029Status === "processing") return status("正在检查待更新数据", "blue", true);
    if (state.c029Status === "failed") return status("待更新数据不匹配", "red");
    if (state.t018Status === "qualified" && state.fixedStatus === "processing") return status("业务消费验证中", "blue", true);
    if (state.t018Status === "qualified" && state.fixedStatus === "failed") return status("业务消费验证失败", "red");
    if (state.t018Status === "qualified" && state.fixedStatus === "success") return status("等待确认切换", "amber");
    if (state.t018Status === "qualified") return status("可运行消费验证", "amber");
    if (state.c028Status === "accepted") return status("收到待更新数据", "blue");
    return status("等待正式数据绑定", "");
  }

  function validationStateLabel() {
    if (state.fixedStatus === "processing") return status("验证中", "blue", true);
    if (state.fixedStatus === "success") return status("通过", "green");
    if (state.fixedStatus === "failed") return status("失败", "red");
    return status("未验证", "");
  }

  function isPublishedResource(resource) {
    return Boolean(state.semanticVersion && resourceId(resource.key));
  }

  function currentDataVersion() {
    return state.currentBinding ? state.currentBinding.dataVersion : "尚未切换";
  }

  function unitCanPreview() {
    return state.mappingPreview === "success" || Boolean(state.currentBinding);
  }

  function render() {
    var app = document.getElementById("app");
    if (!app) return;
    app.innerHTML = [
      '<div class="app-shell">',
      renderRail(),
      renderTopbar(),
      renderWorkspaceTabs(),
      '<section class="workbench" data-screen-label="' + escapeHtml(route()) + '">',
      renderTreePane(),
      renderStage(),
      renderInspector(),
      "</section>",
      renderEvidenceDock(),
      "</div>",
      renderOverlay()
    ].join("");
  }

  function renderRail() {
    return [
      '<aside class="product-rail" aria-label="平台导航">',
      '<div class="rail-logo" title="Ontology 3.0">O</div>',
      '<button type="button" class="rail-action active" title="本体管理">本</button>',
      '<button type="button" class="rail-action" data-action="open-help" title="帮助">?</button>',
      '<div class="rail-spacer"></div>',
      '<button type="button" class="rail-action" data-action="open-reset" title="重置状态">↺</button>',
      "</aside>"
    ].join("");
  }

  function renderTopbar() {
    return [
      '<header class="topbar">',
      '<div class="product-name"><strong>本体管理</strong><span>数据—语义—决策—行动</span></div>',
      '<div class="top-divider"></div>',
      '<div class="ontology-context">',
      '<b>' + escapeHtml(state.model ? state.model.name : "尚未创建本体") + "</b>",
      semanticStateLabel(),
      dataStateLabel(),
      "</div>",
      '<div class="top-spacer"></div>',
      state.model ? button("保存 Draft", "save-draft", { small: true }) : "",
      state.validationStatus === "success" && (!state.semanticVersion || state.draftRevisionBase) ? button("发布", "open-publish", { primary: true, small: true }) : "",
      '<div class="user-chip"><span>本体管理账号</span><span class="avatar">本</span></div>',
      "</header>"
    ].join("");
  }

  function renderWorkspaceTabs() {
    var items = [
      { key: "model", label: "本体建模", ready: Boolean(state.model), routes: ["model", "mapping", "release"] },
      { key: "catalog", label: "已发布本体", ready: Boolean(state.semanticVersion), blocked: state.currentBlocked || state.c029Status === "failed", routes: ["catalog", "consumption", "history", "version-detail", "resource-detail"] }
    ];
    return '<nav class="workspace-tabs" aria-label="本体管理工作区">' + items.map(function (item) {
      var dotClass = item.blocked ? "blocked" : item.ready ? "ready" : "";
      return '<button type="button" class="workspace-tab ' + (item.routes.indexOf(route()) >= 0 ? "active" : "") + '" data-nav="' + item.key + '"><span class="step-dot ' + dotClass + '"></span>' + escapeHtml(item.label) + "</button>";
    }).join("") + "</nav>";
  }

  function renderTreePane() {
    var title = {
      model: "语义资源",
      mapping: "对象字段映射",
      release: "发布门禁",
      catalog: "正式资源",
      consumption: "数据与消费",
      history: "记录与证据",
      "version-detail": "版本详情",
      "resource-detail": "资源详情"
    }[route()] || "语义资源";
    return [
      '<aside class="tree-pane">',
      '<div class="pane-head"><div class="pane-head-copy"><b>' + title + '</b><small>S001 · 集团融资成本与债务结构优化</small></div></div>',
      '<div class="tree-toolbar"><input class="search-box" data-input="tree-query" value="' + escapeHtml(ui.treeQuery) + '" placeholder="查找名称或稳定身份" /></div>',
      '<div class="pane-body">',
      renderTreeContent(),
      "</div>",
      '<div class="tree-section"><button type="button" class="tree-section-head" data-action="show-s003-boundary"><span>▸</span><b>债务风险监测</b><span class="tree-count">锁</span></button></div>',
      "</aside>"
    ].join("");
  }

  function matchesTree(text) {
    var query = ui.treeQuery.trim().toLowerCase();
    return !query || String(text).toLowerCase().indexOf(query) >= 0;
  }

  function treeSection(key, title, count, content) {
    var collapsed = Boolean(ui.collapsed[key]);
    return [
      '<section class="tree-section">',
      '<button type="button" class="tree-section-head" data-action="toggle-tree:' + escapeHtml(key) + '">',
      "<span>" + (collapsed ? "▸" : "▾") + "</span><b>" + escapeHtml(title) + '</b><span class="tree-count">' + escapeHtml(count) + "</span>",
      "</button>",
      collapsed ? "" : '<div class="tree-list">' + content + "</div>",
      "</section>"
    ].join("");
  }

  function treeItem(key, name, subtitle, kind, action, trailing) {
    if (!matchesTree(name + " " + subtitle + " " + resourceId(key))) return "";
    return [
      '<button type="button" class="tree-item ' + (state.selectedResource === key ? "selected" : "") + '" data-action="' + escapeHtml(action || ("select-resource:" + key)) + '">',
      '<span class="resource-glyph ' + escapeHtml(kind) + '">' + escapeHtml(kind === "object" ? "O" : kind === "property" ? "P" : kind === "link" ? "L" : kind === "metric" ? "M" : kind === "rule" ? "R" : kind === "action" ? "A" : "D") + "</span>",
      '<span><strong>' + escapeHtml(name) + '</strong><small>' + escapeHtml(subtitle) + "</small></span>",
      trailing || "",
      "</button>"
    ].join("");
  }

  function renderTreeContent() {
    if (!state.model) {
      return treeSection("start", "当前工作区", "0", treeItem("start", "尚未创建本体", "先建立独立 Draft，再逐项创建业务资源", "data", "open-create"));
    }
    if (route() === "mapping") {
      var mappingObject = currentObject();
      var fieldItems = mappingObject ? sourceFieldsForObject(mappingObject.key).map(function (field) {
        var created = field.propertyKey && state.createdPropertyKeys.indexOf(field.propertyKey) >= 0;
        var linked = field.propertyKey && state.mappedPropertyKeys.indexOf(field.propertyKey) >= 0;
        var isEndpoint = state.endpointFieldKeys.indexOf(field.key) >= 0;
        var fieldAction = field.propertyKey ? (created ? "focus-property:" + field.propertyKey : "create-property:" + field.propertyKey) : "focus-field:" + field.key;
        return treeItem(field.propertyKey || field.key, field.name, field.type + " · " + (linked ? "已映射" : isEndpoint ? "关系端点" : created ? "待映射" : "未创建"), field.propertyKey ? "property" : "data", fieldAction, linked || isEndpoint ? status("已配置", "green") : created ? status("待映射", "amber") : "");
      }).join("") : "";
      return treeSection("mapping-object", mappingObject ? mappingObject.name : "对象范围", mappingObject ? sourceFieldsForObject(mappingObject.key).length : "0", fieldItems || treeItem("mapping-empty", "尚未选择对象", "从对象详情进入字段映射", "data", "go-model"));
    }
    if (route() === "release") {
      var validationItems = getValidationItems().map(function (item) {
        var tone = state.validationStatus === "success" ? "green" : state.validationStatus === "failed" && !item.ok ? "red" : "";
        var label = state.validationStatus === "idle" || state.validationStatus === "processing" ? "待检查" : item.ok ? "通过" : "失败";
        return treeItem("validation_" + item.key, item.name, item.location, item.kind, item.action, status(label, tone));
      }).join("");
      return treeSection("validation", "统一校验", String(getValidationItems().length), validationItems) +
        treeSection("published", "Published 版本", state.semanticHistory.length, state.semanticHistory.map(function (version) {
          return treeItem("history_" + version.semanticVersion, version.semanticVersion, version.publishedAt, "data", "select-semantic:" + version.semanticVersion);
        }).join(""));
    }
    if (route() === "consumption") {
      var compatiblePrevious = previousBindingForCurrent();
      var contextItems = [
        treeItem("context_current", "当前正式使用版本", state.currentBinding ? state.currentBinding.semanticVersion : "尚未切换正式数据", "data", "select-context:current", state.currentBlocked ? status("阻断", "red") : state.currentBinding ? status("服务中", "green") : ""),
        treeItem("context_candidate", "待更新数据", state.candidateVersion || "当前没有待处理数据", "data", "select-context:candidate", state.t018Status === "qualified" ? status("可验证", "blue") : state.c029Status === "failed" ? status("不匹配", "red") : ""),
        treeItem("context_previous", "上一可信数据", compatiblePrevious ? compatiblePrevious.dataVersion : "当前语义版本尚无记录", "data", "select-context:previous", compatiblePrevious ? status("可回退", "") : "")
      ].join("");
      var consumerItems = ["qa", "decision", "agent", "report"].map(function (consumer) {
        var names = { qa: "智能问数", decision: "决策中心", agent: "Agent 应用", report: "报告中心" };
        return treeItem("consumer_" + consumer, names[consumer], "只读消费 Published 语义资源", "data", "consumer:" + consumer);
      }).join("");
      return treeSection("contexts", "版本状态", "3", contextItems) + treeSection("consumers", "消费方", "4", consumerItems);
    }
    if (route() === "history") {
      var semanticItems = state.semanticHistory.map(function (version) {
        return treeItem("history_" + version.semanticVersion, version.semanticVersion, "Published · " + version.publishedAt, "data", "select-semantic:" + version.semanticVersion);
      }).join("") || treeItem("history_empty", "尚无语义版本", "发布后进入历史", "data", "go-release");
      var bindingItems = state.bindingHistory.map(function (binding) {
        return treeItem("binding_" + binding.bindingId, binding.action + " · " + binding.dataVersion, binding.adoptedAt, "data", "select-binding:" + binding.bindingId);
      }).join("") || treeItem("binding_empty", "尚无正式切换记录", "确认切换或回退后进入记录", "data", "go-consumption");
      return treeSection("semantic-history", "语义版本", state.semanticHistory.length, semanticItems) +
        treeSection("binding-history", "数据切换与回退", state.bindingHistory.length, bindingItems);
    }
    var publishedOnly = ["catalog", "version-detail", "resource-detail"].indexOf(route()) >= 0;
    if (publishedOnly && !state.semanticVersion) {
      return treeSection("catalog-empty", "Published 资源", "0", treeItem("catalog-empty", "正式目录为空", "Draft 资源不会进入目录", "data", "go-release"));
    }
    var objectSource = publishedOnly ? publishedResources().filter(function (item) { return item.type === "Object Type"; }) : createdObjects();
    var propertySource = publishedOnly ? publishedResources().filter(function (item) { return item.type === "Property"; }) : createdProperties();
    var linkSource = publishedOnly ? publishedResources().filter(function (item) { return item.type === "Link Type"; }) : createdLinks();
    var metricSource = publishedOnly ? publishedResources().filter(function (item) { return item.type === "Metric"; }) : createdMetrics();
    var ruleSource = publishedOnly ? publishedResources().filter(function (item) { return item.type === "Rule"; }) : createdRules();
    var actionSource = publishedOnly ? publishedResources().filter(function (item) { return item.type === "Action Type"; }) : state.actionCreated ? [ACTION_TYPE] : [];
    var objectItems = objectSource.map(function (item) {
      return treeItem(item.key, item.name, resourceId(item.key), "object");
    }).join("");
    var propertyItems = propertySource.map(function (item) {
      return treeItem(item.key, item.name, item.parentName + " · " + resourceId(item.key), "property");
    }).join("");
    var linkItemsDefault = linkSource.map(function (item) {
      return treeItem(item.key, item.name, item.cardinality + " · " + item.direction, "link");
    }).join("");
    var metricItems = metricSource.map(function (item) {
      return treeItem(item.key, item.name, item.unit + " · " + item.scope, "metric");
    }).join("");
    var ruleItems = ruleSource.map(function (item) {
      return treeItem(item.key, item.code + " " + item.name, item.threshold, "rule");
    }).join("");
    var actionItems = actionSource.map(function (item) { return treeItem(item.key, item.name, item.target, "action"); }).join("");
    return treeSection("objects", "Object Type", objectSource.length, objectItems) +
      treeSection("properties", "Property", propertySource.length, propertyItems) +
      treeSection("links", "Link Type", linkSource.length, linkItemsDefault) +
      treeSection("metrics", "Metric", metricSource.length, metricItems) +
      treeSection("rules", "Rule", ruleSource.length, ruleItems) +
      treeSection("actions", "Action Type", actionSource.length, actionItems);
  }

  function renderStage() {
    var renderer = {
      model: renderModelStage,
      mapping: renderMappingStage,
      release: renderReleaseStage,
      catalog: renderCatalogStage,
      consumption: renderConsumptionStage,
      history: renderHistoryStage,
      "version-detail": renderVersionDetailStage,
      "resource-detail": renderPublishedResourceDetailStage
    }[route()] || renderModelStage;
    return renderer();
  }

  function stageShell(title, subtitle, actions, body, canvas) {
    return [
      '<main class="workspace-stage">',
      '<div class="stage-head"><div class="stage-title"><b>' + escapeHtml(title) + '</b><span>' + escapeHtml(subtitle) + "</span></div>",
      '<div class="stage-actions">' + (actions || "") + "</div></div>",
      canvas ? body : '<div class="surface-stage">' + body + "</div>",
      "</main>"
    ].join("");
  }

  function renderMissingPublishedVersionStage(title) {
    var requested = state.selectedSemanticVersion || "未指定版本";
    var hasVersions = state.semanticHistory.length > 0;
    var action = hasVersions ? button("返回版本目录", "return-published-directory", { primary: true, small: true }) : button("返回本体建模", "go-model", { primary: true, small: true });
    return stageShell(
      title,
      "无法定位精确 Published 版本",
      action,
      '<div class="surface-grid">' + emptySurface("版本不存在", "所请求的精确语义版本 “" + requested + "” 不存在或已无法定位。系统不会自动回落到其他版本。", hasVersions ? "返回版本目录" : "返回本体建模", hasVersions ? "return-published-directory" : "go-model") + "</div>",
      false
    );
  }

  function renderIncompletePublishedSnapshotStage(title, entry) {
    return stageShell(
      title,
      (entry && entry.semanticVersion || "历史 Published 版本") + " · 资源快照不可完整解析",
      button("查看版本记录", "go-history", { primary: true, small: true }),
      '<div class="surface-grid">' + emptySurface("历史快照合同不完整", "该版本未保存完整的业务定义、单位、阈值或字段合同，无法作为正式消费依据。系统不会以其他版本的定义替代。", "查看版本记录", "go-history") + "</div>",
      false
    );
  }

  function renderModelStage() {
    if (!state.model) {
      return stageShell(
        "本体建模工作台",
        "先创建独立 Draft，再从业务对象骨架逐项建立语义资源",
        button("创建本体", "open-create", { primary: true }),
        '<div class="canvas-wrap"><div class="canvas-empty"><section class="empty-panel"><div class="empty-symbol">◇</div><h2>创建一个空白本体 Draft</h2><p>Draft 只建立本体工作区。Object、Property、Link、Metric、Rule 和 Action Type 均需后续逐项创建，发布前不会进入正式目录。</p>' + button("创建本体", "open-create", { primary: true }) + "</section></div></div>",
        true
      );
    }
    var counts = resourceCounts();
    var viewSwitch = '<div class="segmented canvas-view-switch"><button type="button" class="' + (ui.canvasView === "semantic" ? "active" : "") + '" data-action="canvas-view:semantic">语义结构</button><button type="button" class="' + (ui.canvasView === "lineage" ? "active" : "") + '" data-action="canvas-view:lineage">数据沿袭</button></div>';
    var actions = viewSwitch + button("创建业务对象", "open-object-create", { small: true, disabled: counts.objects >= OBJECTS.length }) +
      button("添加关系或业务逻辑", "open-logic-create", { small: true, disabled: counts.objects < OBJECTS.length }) +
      button("统一校验", "go-release", { small: true }) +
      button("恢复布局", "fit-canvas", { small: true }) +
      (!state.semanticVersion ? button("新建空白 Draft", "open-blank-draft", { small: true }) : "") +
      button("保存 Draft", "save-draft", { primary: true, small: true });
    var subtitle = ui.canvasView === "lineage" ? "只读查看数据资产、成员、字段、对象映射和完整上游创建链" : counts.total ? "拖动节点时关系线实时跟随；点击 Object 集中配置结构、映射、逻辑与消费" : "Draft 已创建；请先创建 Object Type 业务骨架";
    return stageShell(state.model.name, subtitle, actions, ui.canvasView === "lineage" ? renderDataLineageCanvas() : renderModelCanvas(), true);
  }

  function renderModelCanvas() {
    var transform = "translate(" + state.panX + "px," + state.panY + "px) scale(" + state.zoom + ")";
    return [
      '<div class="canvas-wrap" id="model-canvas">',
      '<div class="canvas-world" style="transform:' + transform + '">',
      renderEdges(),
      activeNodeDefinitions().map(renderNode).join(""),
      activeNodeDefinitions().length ? "" : '<div class="canvas-empty"><section class="empty-panel"><div class="empty-symbol">O</div><h2>尚无业务对象</h2><p>先逐个创建 Object Type。数据资产和字段映射在对象内部配置，不会显示为一级语义画布的字段连线。</p>' + button("创建业务对象", "open-object-create", { primary: true }) + "</section></div>",
      "</div>",
      '<div class="canvas-toolbar">',
      iconButton("−", "zoom-out", "缩小"),
      '<span class="zoom-value">' + Math.round(state.zoom * 100) + "%</span>",
      iconButton("+", "zoom-in", "放大"),
      iconButton("◎", "fit-canvas", "适配画布"),
      "</div>",
      renderMinimap(),
      "</div>"
    ].join("");
  }

  function renderDataLineageCanvas() {
    var mappedObjects = createdObjects().filter(function (object) { return Boolean(state.objectMembers[object.key]); });
    if (!state.assetVersion || !mappedObjects.length) {
      return '<div class="canvas-wrap lineage-canvas-wrap"><div class="canvas-empty"><section class="empty-panel"><div class="empty-symbol">D</div><h2>尚未建立数据沿袭</h2><p>在 Object Type 的“数据与映射”页签选择已发布数据资产成员后，此处将展开完整上游来源与字段映射。</p>' + (createdObjects().length ? button("返回语义结构", "canvas-view:semantic", { primary: true }) : button("创建业务对象", "open-object-create", { primary: true })) + "</section></div></div>";
    }
    var memberNodes = mappedObjects.map(function (object) {
      var member = MEMBERS.find(function (item) { return item.key === state.objectMembers[object.key]; });
      var fields = sourceFieldsForObject(object.key);
      var fieldNames = fields.slice(0, 4).map(function (field) { return '<span>' + escapeHtml(field.name) + '</span>'; }).join("");
      if (fields.length > 4) fieldNames += '<span class="more">+' + (fields.length - 4) + ' 个字段</span>';
      return '<button type="button" class="lineage-member-node" data-action="select-resource:' + escapeHtml(member.key) + '"><span class="data-node-stripe"></span><div class="lineage-node-head"><span class="data-field-icon">D</span><span><b>' + escapeHtml(member.name) + '</b><small>' + escapeHtml(member.grain + " · " + member.rows + " 行") + '</small></span>' + status("已发布", "green") + '</div><div class="lineage-field-list">' + fieldNames + '</div></button>';
    }).join("");
    var objectNodes = mappedObjects.map(function (object) {
      var mapped = object.properties.filter(function (property) { return state.mappedPropertyKeys.indexOf(property.key) >= 0; }).length;
      return '<button type="button" class="lineage-object-node" data-action="select-resource:' + escapeHtml(object.key) + '"><div class="lineage-node-head"><span class="resource-glyph object">O</span><span><b>' + escapeHtml(object.name) + '</b><small class="mono">' + escapeHtml(object.id) + '</small></span>' + status(mapped + " / " + object.properties.length + " 映射", mapped === object.properties.length ? "green" : "amber") + '</div><div class="lineage-object-meta"><span>身份 ' + escapeHtml(state.identityAssignments[object.key] ? object.identity : "待配置") + '</span><span>标题 ' + escapeHtml(state.titleAssignments[object.key] ? object.title : "待配置") + '</span></div></button>';
    }).join("");
    return [
      '<div class="canvas-wrap lineage-canvas-wrap">',
      '<div class="lineage-topbar"><div><b>融资标准化数据资产</b><span class="mono">' + escapeHtml(state.assetVersion) + '</span><span>数据截至 ' + escapeHtml(state.assetAsOf) + '</span></div><div class="stage-actions">' + status("只读沿袭", "blue") + '<a class="btn small" href="../../data-engineering-prototype-review/review-v3/方案B2.html#/resources/asset/finance-asset-target?tab=lineage" target="_blank" rel="noopener">查看上游资产</a></div></div>',
      '<div class="lineage-flow-canvas">',
      '<div class="lineage-source-chain">',
      '<article class="lineage-data-node source"><span class="data-node-stripe"></span><div class="lineage-node-head"><span class="data-field-icon">F</span><span><b>融资明细一览表</b><small>手工上传工作簿</small></span></div><div class="lineage-node-meta"><span>当前资产来源</span><strong>数据工程维护</strong></div></article>',
      '<span class="lineage-arrow">→</span>',
      '<article class="lineage-data-node process"><span class="data-node-stripe"></span><div class="lineage-node-head"><span class="data-field-icon">Py</span><span><b>融资标准化处理</b><small>字段清洗 · 板块映射 · 机构补充</small></span></div><div class="lineage-node-meta"><span>管道与质量</span><strong>只读引用</strong></div></article>',
      '<span class="lineage-arrow">→</span>',
      '<article class="lineage-data-node asset"><span class="data-node-stripe"></span><div class="lineage-node-head"><span class="data-field-icon">A</span><span><b>融资标准化数据资产</b><small>四成员 · 三关系</small></span></div><div class="lineage-node-meta"><span class="mono">' + escapeHtml(state.assetVersion) + '</span><strong>已发布</strong></div></article>',
      '</div>',
      '<div class="lineage-down-arrow">↓</div>',
      '<div class="lineage-binding-grid"><section><div class="lineage-column-title"><b>数据资产成员与字段</b><span>' + mappedObjects.length + ' 个已选择成员</span></div><div class="lineage-node-stack">' + memberNodes + '</div></section><div class="lineage-map-divider"><span>字段映射</span><i>→</i></div><section><div class="lineage-column-title"><b>Object Type</b><span>稳定身份与标题独立配置</span></div><div class="lineage-node-stack">' + objectNodes + '</div></section></div>',
      '</div></div>'
    ].join("");
  }

  function renderEdges() {
    return activeEdgeDefinitions().map(function (edge, index) {
      var from = state.nodePositions[edge.from];
      var to = state.nodePositions[edge.to];
      var fromX = from.x + 87;
      var fromY = from.y + 52;
      var toX = to.x + 87;
      var toY = to.y + 52;
      var dx = toX - fromX;
      var dy = toY - fromY;
      var length = Math.sqrt(dx * dx + dy * dy);
      var angle = Math.atan2(dy, dx) * 180 / Math.PI;
      var labelX = (fromX + toX) / 2;
      var labelY = (fromY + toY) / 2;
      return '<div class="relation-line" data-edge-line="' + index + '" style="left:' + fromX + "px;top:" + fromY + "px;width:" + length + "px;transform:rotate(" + angle + 'deg)"></div>' +
        '<div class="relation-label" data-edge-label="' + index + '" style="left:' + labelX + "px;top:" + labelY + 'px">' + escapeHtml(edge.label) + "</div>";
    }).join("");
  }

  function updateModelEdgesDom() {
    activeEdgeDefinitions().forEach(function (edge, index) {
      var from = state.nodePositions[edge.from];
      var to = state.nodePositions[edge.to];
      if (!from || !to) return;
      var fromX = from.x + 87;
      var fromY = from.y + 52;
      var toX = to.x + 87;
      var toY = to.y + 52;
      var dx = toX - fromX;
      var dy = toY - fromY;
      var length = Math.sqrt(dx * dx + dy * dy);
      var angle = Math.atan2(dy, dx) * 180 / Math.PI;
      var line = document.querySelector('[data-edge-line="' + index + '"]');
      var label = document.querySelector('[data-edge-label="' + index + '"]');
      if (line) {
        line.style.left = fromX + "px";
        line.style.top = fromY + "px";
        line.style.width = length + "px";
        line.style.transform = "rotate(" + angle + "deg)";
      }
      if (label) {
        label.style.left = (fromX + toX) / 2 + "px";
        label.style.top = (fromY + toY) / 2 + "px";
      }
    });
  }

  function renderNode(node) {
    var position = state.nodePositions[node.key];
    var selectedProperty = PROPERTY_RESOURCES.find(function (item) { return item.key === state.selectedResource; });
    var selected = state.selectedResource === node.key ||
      (selectedProperty && selectedProperty.parentKey === node.key) ||
      (node.key === "metric_group" && String(state.selectedResource).indexOf("metric_") === 0) ||
      (node.key === "rule_group" && String(state.selectedResource).indexOf("rule_") === 0);
    var nodeRows = node.rows;
    if (["subject", "detail", "institution", "owner"].indexOf(node.key) >= 0 && !objectConfigurationReady(objectByKey(node.key))) nodeRows = "业务骨架 · 待配置";
    return [
      '<article class="model-node ' + escapeHtml(node.kind) + (selected ? " selected" : "") + '" style="left:' + position.x + "px;top:" + position.y + 'px" data-node="' + escapeHtml(node.key) + '" data-action="select-resource:' + escapeHtml(node.key) + '">',
      '<div class="node-head" data-node-handle="' + escapeHtml(node.key) + '">',
      '<span class="resource-glyph ' + escapeHtml(node.kind === "logic" ? "metric" : node.kind) + '">' + escapeHtml(node.kind === "object" ? "O" : node.kind === "logic" ? "M" : node.kind === "rule" ? "R" : "A") + "</span>",
      '<div class="node-head-copy"><b>' + escapeHtml(node.name) + '</b><small>' + escapeHtml(node.type) + "</small></div>",
      "</div>",
      '<div class="node-body"><div class="node-row"><span>' + escapeHtml(nodeRows) + '</span><strong>Draft</strong></div><div class="node-row"><span>' + escapeHtml(node.meta) + "</span></div></div>",
      "</article>"
    ].join("");
  }

  function renderMinimap() {
    return '<div class="minimap" title="模型概览">' + activeNodeDefinitions().map(function (node) {
      var position = state.nodePositions[node.key];
      return '<span class="minimap-node" style="left:' + Math.round(position.x / 10) + "px;top:" + Math.round(position.y / 10) + 'px"></span>';
    }).join("") + "</div>";
  }

  function renderInspector() {
    var selected = resourceByKey(state.selectedResource);
    var publishedContext = ["catalog", "consumption", "history", "version-detail", "resource-detail"].indexOf(route()) >= 0;
    var publishedVersion = publishedContext ? activePublishedVersion() : null;
    if (publishedVersion) {
      var publishedSnapshot = publishedEntry(publishedVersion);
      selected = publishedSnapshot && !publishedSnapshot.resourceSnapshotComplete ? {
        key: "incomplete_snapshot",
        id: publishedVersion,
        name: "历史快照合同不完整",
        type: "Published 快照",
        definition: "该版本未保存完整资源合同，不能以其他版本的定义替代。"
      } : publishedResources(publishedVersion).find(function (resource) { return resource.key === state.selectedResource; }) || selected;
    }
    var title = selected.name || "详情";
    var id = selected.key ? resourceId(selected.key) : "";
    return [
      '<aside class="inspector-pane">',
      '<div class="pane-head"><div class="pane-head-copy"><b>' + escapeHtml(title) + '</b><small class="mono">' + escapeHtml(id) + "</small></div>",
      selected.type === "数据资产成员" ? (state.assetVersion ? status("已锁定", "blue") : status("待读取", "")) : state.model ? (["catalog", "version-detail", "resource-detail", "consumption", "history"].indexOf(route()) >= 0 && state.semanticVersion ? status("Published", "green") : status("Draft", "amber")) : status("未开始", ""),
      "</div>",
      renderInspectorTabs(),
      '<div class="pane-body">' + renderInspectorBody(selected) + "</div>",
      "</aside>"
    ].join("");
  }

  function renderInspectorTabs() {
    var tabs = [
      { key: "overview", label: "概览" },
      { key: "properties", label: "属性" },
      { key: "relations", label: "关系" },
      { key: "mapping", label: "数据与映射" },
      { key: "logic", label: "业务逻辑与行动" },
      { key: "consumers", label: "下游消费" }
    ];
    return '<div class="inspector-tabs">' + tabs.map(function (tab) {
      return '<button type="button" class="inspector-tab ' + (ui.inspectorTab === tab.key ? "active" : "") + '" data-action="inspector-tab:' + tab.key + '">' + escapeHtml(tab.label) + "</button>";
    }).join("") + "</div>";
  }

  function renderInspectorBody(resource) {
    if (!state.model) {
      return '<section class="inspector-section"><h3>工作区状态</h3><p>创建本体后，这里会显示所选资源的定义、身份、属性、关系、逻辑、数据映射与下游消费。</p></section>';
    }
    if (ui.inspectorTab === "properties") return renderInspectorProperties(resource);
    if (ui.inspectorTab === "relations") return renderInspectorRelations(resource);
    if (ui.inspectorTab === "logic") return renderInspectorLogic(resource);
    if (ui.inspectorTab === "mapping") return renderInspectorMapping(resource);
    if (ui.inspectorTab === "consumers") return renderInspectorConsumers(resource);
    return renderInspectorOverview(resource);
  }

  function renderInspectorOverview(resource) {
    var definition = resource.definition || resource.condition || resource.result || "当前资源定义";
    var publishedContext = ["catalog", "consumption", "history", "version-detail", "resource-detail"].indexOf(route()) >= 0;
    var publishedVersion = publishedContext ? activePublishedVersion() : null;
    var publishedSnapshot = publishedVersion ? publishedEntry(publishedVersion) : null;
    var fields = [
      ["资源类型", resource.type || "语义资源"],
      ["稳定资源身份", resourceId(resource.key)],
      ["业务名称", resource.name],
      ["语义状态", publishedSnapshot ? "Published" : "Draft"],
      ["精确语义版本", publishedSnapshot ? publishedVersion : "发布后生成"],
      ["业务定义", definition]
    ];
    if (resource.type === "Object Type") {
      var memberAssignments = publishedSnapshot ? publishedSnapshot.objectMembers || {} : state.objectMembers;
      var identityAssignments = publishedSnapshot ? publishedSnapshot.identityAssignments || {} : state.identityAssignments;
      var titleAssignments = publishedSnapshot ? publishedSnapshot.titleAssignments || {} : state.titleAssignments;
      var selectedMember = publishedSnapshot ? publishedSnapshot.memberContracts && publishedSnapshot.memberContracts[memberAssignments[resource.key]] : MEMBERS.find(function (item) { return item.key === memberAssignments[resource.key]; });
      var propertyCount = publishedSnapshot ? publishedResources(publishedVersion).filter(function (item) { return item.type === "Property" && item.parentKey === resource.key; }).length : resource.properties.filter(function (item) { return state.createdPropertyKeys.indexOf(item.key) >= 0; }).length;
      fields.push(["稳定身份", identityAssignments[resource.key] ? resource.identity : "待配置"], ["可读标题", titleAssignments[resource.key] ? resource.title : "待配置"], ["已创建属性", propertyCount + " / " + resource.properties.length], ["主要来源成员", selectedMember ? selectedMember.name : "尚未选择"]);
    }
    if (resource.type === "Property") {
      fields.push(["所属 Object Type", resource.parentName + " [" + resource.parentId + "]"], ["数据类型", resource.type === "Property" ? resource.dataType || resource.type : resource.type], ["属性角色", resource.role], ["允许为空", resource.nullable], ["来源字段", resource.source]);
    }
    if (resource.type === "Link Type") {
      fields.push(["关系方向", resource.direction], ["基数", resource.cardinality], ["端点", resource.endpoints]);
    }
    if (resource.type === "Metric") {
      fields.push(["单位", resource.unit], ["适用范围", resource.scope], ["零分母", resource.zero]);
    }
    if (resource.type === "Rule") {
      fields.push(["依赖 Metric", resource.depends], ["阈值", resource.threshold], ["证据要求", resource.evidence]);
    }
    if (resource.type === "Action Type") {
      fields.push(["目标对象", resource.target], ["前置证据", resource.precondition], ["结果", resource.result]);
    }
    if (resource.type === "数据资产成员") {
      fields.splice(3, 2, ["输入状态", state.assetVersion ? "精确版本已锁定" : "待读取精确版本"], ["数据资产版本", state.assetVersion || "尚未读取"]);
      fields.push(["成员粒度", resource.grain], ["记录数", resource.rows], ["稳定身份字段", resource.identity], ["支持资源", resource.supports], ["管理边界", "本体只读选择和映射；不维护采集、加工、质量或发布"]);
    }
    return '<section class="inspector-section"><h3>资源定义</h3><dl class="kv-list">' + fields.map(function (field) {
      return "<dt>" + escapeHtml(field[0]) + "</dt><dd>" + escapeHtml(field[1]) + "</dd>";
    }).join("") + "</dl></section>" +
      (resource.type === "Rule" ? '<section class="inspector-section"><div class="notice info"><div class="notice-content"><b>本版本规则参数</b><span>发布前统一校验依赖 Metric、阈值、证据要求与测试样例的合同完整性。</span></div></div></section>' : "") +
      '<section class="inspector-section"><h3>可执行操作</h3><div class="stage-actions">' +
      (state.semanticVersion && isResourceCreated(resource.key) ? button("查看正式资源", "open-resource-detail:" + resource.key, { small: true }) : "") +
      (resource.type === "Object Type" && unitCanPreview() ? button("查看实例", "open-unit:553", { small: true }) : "") +
      "</div></section>";
  }

  function renderInspectorProperties(resource) {
    var publishedContext = ["catalog", "consumption", "history", "version-detail", "resource-detail"].indexOf(route()) >= 0;
    var publishedVersion = publishedContext ? activePublishedVersion() : null;
    var versionResources = publishedVersion ? publishedResources(publishedVersion) : null;
    var properties = versionResources && resource.type === "Object Type" ? versionResources.filter(function (item) {
      return item.type === "Property" && item.parentKey === resource.key;
    }) : (resource.properties || []).filter(function (item) { return state.createdPropertyKeys.indexOf(item.key) >= 0; });
    if (resource.type === "Property") {
      return '<section class="inspector-section"><h3>Property 合同</h3><dl class="kv-list"><dt>稳定语义身份</dt><dd class="mono">' + escapeHtml(resource.id) + '</dd><dt>所属对象</dt><dd>' + escapeHtml(resource.parentName + " [" + resource.parentId + "]") + '</dd><dt>数据类型</dt><dd>' + escapeHtml(resource.dataType) + '</dd><dt>属性角色</dt><dd>' + escapeHtml(resource.role) + '</dd><dt>允许为空</dt><dd>' + escapeHtml(resource.nullable) + '</dd><dt>来源字段</dt><dd>' + escapeHtml(resource.source) + '</dd><dt>映射状态</dt><dd>' + (publishedVersion ? "已随本版本冻结" : state.mappedPropertyKeys.indexOf(resource.key) >= 0 ? "已映射" : "待配置") + '</dd></dl><div class="stage-actions" style="margin-top:10px">' + (publishedVersion ? button("查看详情", "open-resource-detail:" + resource.key, { primary: true, small: true }) : button("配置映射", "open-property-mapping:" + resource.key, { primary: true, small: true }) + button("查看所属对象", "select-resource:" + resource.parentKey, { small: true })) + '</div></section>';
    }
    if (resource.type !== "Object Type") return '<section class="inspector-section"><p>当前资源不直接维护 Property。</p></section>';
    if (publishedVersion) {
      return '<section class="inspector-section"><h3>Published Property</h3><p class="section-copy">以下属性来自所选精确语义版本的冻结快照。</p><div class="property-list">' + properties.map(function (property) {
        return '<div class="property-item tree-item"><span class="resource-glyph property">P</span><span><strong>' + escapeHtml(property.name) + '</strong><small class="mono">' + escapeHtml(property.id) + '</small><small>' + escapeHtml(property.role + " · " + property.dataType + " · 已冻结") + '</small></span>' + button("查看详情", "open-resource-detail:" + property.key, { small: true }) + '</div>';
      }).join("") + "</div></section>";
    }
    var allFields = sourceFieldsForObject(resource.key).filter(function (field) { return Boolean(field.propertyKey); });
    return [
      '<section class="inspector-section"><h3>已创建 Property</h3><p class="section-copy">属性由用户从已发布数据资产字段逐项创建或映射，不会自动复制全部源字段。</p><div class="property-list">',
      properties.length ? properties.map(function (property) {
        return '<div class="property-item tree-item"><span class="resource-glyph property">P</span><span><strong>' + escapeHtml(property.name) + '</strong><small class="mono">' + escapeHtml(property.id) + '</small><small>' + escapeHtml(property.role) + " · " + escapeHtml(property.type) + " · " + (state.mappedPropertyKeys.indexOf(property.key) >= 0 ? "已映射" : "待映射") + '</small></span>' + button("配置映射", "open-property-mapping:" + property.key, { small: true }) + '</div>';
      }).join("") : '<p>尚未创建 Property。先在“数据与映射”页签选择来源成员。</p>',
      "</div></section>",
      '<section class="inspector-section"><h3>来源字段</h3><div class="source-field-list">',
      state.objectMembers[resource.key] ? allFields.map(function (field) {
        var created = state.createdPropertyKeys.indexOf(field.propertyKey) >= 0;
        return '<div class="source-field-row"><span><b>' + escapeHtml(field.name) + '</b><small>' + escapeHtml(field.type + " · " + field.roleHint) + '</small></span>' + (created ? status("已创建", "green") : button("创建 Property", "create-property:" + field.propertyKey, { small: true })) + '</div>';
      }).join("") : '<p>选择来源成员后可逐项创建 Property。</p>',
      "</div></section>"
    ].join("");
  }

  function renderInspectorRelations(resource) {
    var publishedContext = ["catalog", "consumption", "history", "version-detail", "resource-detail"].indexOf(route()) >= 0;
    var publishedVersion = publishedContext ? activePublishedVersion() : null;
    if (resource.type === "Link Type") {
      return '<section class="inspector-section"><h3>关系合同</h3><dl class="kv-list"><dt>正向名称</dt><dd>' + escapeHtml(resource.name) + '</dd><dt>反向名称</dt><dd>' + escapeHtml(resource.reverse) + '</dd><dt>方向</dt><dd>' + escapeHtml(resource.direction) + '</dd><dt>基数</dt><dd>' + escapeHtml(resource.cardinality) + '</dd><dt>端点字段</dt><dd>' + escapeHtml(resource.endpoints) + '</dd><dt>端点状态</dt><dd>' + (publishedVersion ? "已随本版本冻结" : requiredEndpointFieldsReady() ? "已配置" : "待配置或不兼容") + "</dd></dl></section>";
    }
    if (resource.type !== "Object Type") return '<section class="inspector-section"><p>请从 Object Type 查看关联关系。</p></section>';
    var relatedLinks = (publishedVersion ? publishedResources(publishedVersion) : LINKS).filter(function (link) { return link.type === "Link Type" && (link.sourceObjectId === resource.id || link.targetObjectId === resource.id); });
    return '<section class="inspector-section"><h3>关联 Link</h3><div class="compact-list">' + relatedLinks.map(function (link) {
      var created = state.createdLinkKeys.indexOf(link.key) >= 0;
      return '<div class="compact-item tree-item"><span class="resource-glyph link">L</span><span><strong>' + escapeHtml(link.name) + '</strong><small>' + escapeHtml(link.direction + " · " + link.cardinality) + '</small></span>' + (publishedVersion ? status("已冻结", "green") : created ? status(requiredEndpointFieldsReady() ? "端点已配置" : "端点待修正", requiredEndpointFieldsReady() ? "green" : "red") : button("创建 Link", "create-link:" + link.key, { small: true })) + '</div>';
    }).join("") + '</div></section><section class="inspector-section"><p>Link 只在一级画布显示对象间的业务关系；字段端点在对象范围的字段映射工作区配置。</p></section>';
  }

  function renderInspectorLogic(resource) {
    var publishedContext = ["catalog", "consumption", "history", "version-detail", "resource-detail"].indexOf(route()) >= 0;
    var publishedVersion = publishedContext ? activePublishedVersion() : null;
    var publishedLogic = publishedVersion ? publishedResources(publishedVersion) : null;
    var supportsLogic = resource.id === "OBJ-FINANCING-ENTITY" || resource.key === "metric_group" || resource.key === "rule_group" || resource.type === "Metric" || resource.type === "Rule" || resource.type === "Action Type";
    var metrics = supportsLogic ? publishedLogic ? publishedLogic.filter(function (item) { return item.type === "Metric"; }) : createdMetrics() : [];
    var rules = supportsLogic ? publishedLogic ? publishedLogic.filter(function (item) { return item.type === "Rule"; }) : createdRules() : [];
    var publishedAction = publishedLogic && publishedLogic.find(function (item) { return item.type === "Action Type"; });
    return [
      '<section class="inspector-section"><h3>Metric</h3><div class="logic-list">',
      metrics.length ? metrics.map(function (metric) {
        return '<button type="button" class="logic-item tree-item" data-action="select-resource:' + metric.key + '"><span class="resource-glyph metric">M</span><span><strong>' + escapeHtml(metric.name) + '</strong><small>' + escapeHtml(metric.unit + " · " + metric.scope) + "</small></span></button>";
      }).join("") : '<p>尚未创建适用于当前对象的 Metric。</p>',
      !publishedVersion && supportsLogic && createdMetrics().length < METRICS.length ? '<div style="margin-top:8px">' + button("添加下一项 Metric", "create-next-metric", { small: true }) + "</div>" : "",
      "</div></section>",
      '<section class="inspector-section"><h3>Rule</h3><div class="logic-list">',
      rules.length ? rules.map(function (rule) {
        return '<button type="button" class="logic-item tree-item" data-action="select-resource:' + rule.key + '"><span class="resource-glyph rule">R</span><span><strong>' + escapeHtml(rule.code + " " + rule.name) + '</strong><small>' + escapeHtml(rule.threshold) + "</small></span></button>";
      }).join("") : '<p>尚未创建适用于当前对象的 Rule。</p>',
      !publishedVersion && supportsLogic && createdRules().length < RULES.length ? '<div style="margin-top:8px">' + button("添加下一项 Rule", "create-next-rule", { small: true }) + "</div>" : "",
      "</div></section>",
      supportsLogic ? '<section class="inspector-section"><h3>Action Type</h3>' + (publishedVersion ? publishedAction ? '<div class="logic-item"><div class="logic-item-head"><span class="resource-glyph action">A</span><b>' + escapeHtml(publishedAction.name) + '</b></div><small>' + escapeHtml(publishedAction.confirmation) + '</small></div>' : '<p>本版本未包含 Action Type。</p>' : state.actionCreated ? '<div class="logic-item"><div class="logic-item-head"><span class="resource-glyph action">A</span><b>' + escapeHtml(ACTION_TYPE.name) + '</b></div><small>' + escapeHtml(ACTION_TYPE.confirmation) + '</small></div>' : button("创建 Action Type", "create-action", { small: true })) + "</section>" : ""
    ].join("");
  }

  function renderInspectorMapping(resource) {
    var publishedContext = ["catalog", "consumption", "history", "version-detail", "resource-detail"].indexOf(route()) >= 0;
    var publishedVersion = publishedContext ? activePublishedVersion() : null;
    var publishedEntrySnapshot = publishedVersion ? publishedEntry(publishedVersion) : null;
    var objectResource = publishedVersion ? publishedObjectForResource(resource, publishedVersion) : objectForResource(resource);
    if (!objectResource) return '<section class="inspector-section"><p>数据资产和字段映射在所属 Object Type 内配置。</p></section>';
    var memberKey = publishedEntrySnapshot ? (publishedEntrySnapshot.objectMembers || {})[objectResource.key] : state.objectMembers[objectResource.key];
    var member = publishedEntrySnapshot ? publishedEntrySnapshot.memberContracts && publishedEntrySnapshot.memberContracts[memberKey] : MEMBERS.find(function (item) { return item.key === memberKey; });
    if (publishedVersion) {
      var frozenProperties = publishedResources(publishedVersion).filter(function (item) { return item.type === "Property" && item.parentKey === objectResource.key; });
      return '<section class="inspector-section"><h3>冻结的数据映射</h3><dl class="kv-list"><dt>精确语义版本</dt><dd class="mono">' + escapeHtml(publishedVersion) + '</dd><dt>数据资产版本</dt><dd class="mono">' + escapeHtml(publishedEntrySnapshot.assetVersion || "发布时未记录") + '</dd><dt>来源成员</dt><dd>' + escapeHtml(member ? member.name : "发布快照中未记录") + '</dd><dt>成员粒度</dt><dd>' + escapeHtml(member ? member.grain : "发布快照中未记录") + '</dd><dt>Property</dt><dd>' + frozenProperties.length + ' 项</dd><dt>稳定身份</dt><dd class="mono">' + escapeHtml(objectResource.identityPropertyId) + '</dd><dt>可读标题</dt><dd class="mono">' + escapeHtml(objectResource.titlePropertyId) + '</dd><dt>映射状态</dt><dd>已随本版本冻结，只读</dd></dl></section>';
    }
    var createdCount = objectResource.properties.filter(function (item) { return state.createdPropertyKeys.indexOf(item.key) >= 0; }).length;
    var mappedCount = objectResource.properties.filter(function (item) { return state.mappedPropertyKeys.indexOf(item.key) >= 0; }).length;
    return [
      '<section class="inspector-section"><h3>来源资产成员</h3>',
      member ? '<dl class="kv-list"><dt>数据资产</dt><dd>融资标准化数据资产</dd><dt>精确数据版本</dt><dd class="mono">' + escapeHtml(state.assetVersion) + '</dd><dt>已选成员</dt><dd>' + escapeHtml(member.name) + '</dd><dt>成员粒度</dt><dd>' + escapeHtml(member.grain) + '</dd><dt>数据截至时间</dt><dd>' + escapeHtml(state.assetAsOf) + '</dd></dl>' : '<div class="notice info"><div class="notice-content"><b>尚未选择来源成员</b><span>Object 业务骨架可以先创建；Property 必须从已发布资产成员的字段开始逐项配置。</span></div></div>',
      '<div class="stage-actions" style="margin-top:10px">' + button(member ? "更换来源成员" : "选择数据资产成员", "select-object-member:" + objectResource.key, { primary: true, small: true }) + '</div></section>',
      '<section class="inspector-section"><h3>配置进度</h3><dl class="kv-list"><dt>Property</dt><dd>' + createdCount + " / " + objectResource.properties.length + ' 已创建</dd><dt>字段映射</dt><dd>' + mappedCount + " / " + objectResource.properties.length + ' 已保存</dd><dt>稳定身份</dt><dd>' + (state.identityAssignments[objectResource.key] ? objectResource.identity : "待指定") + '</dd><dt>可读标题</dt><dd>' + (state.titleAssignments[objectResource.key] ? objectResource.title : "待指定") + '</dd><dt>对象预览</dt><dd>' + (objectConfigurationReady(objectResource) ? "可运行" : "配置未完成") + '</dd></dl></section>',
      member ? '<section class="inspector-section">' + button("进入字段映射工作区", "open-object-mapping:" + objectResource.key, { primary: true, small: true }) + '</section>' : ''
    ].join("");
  }

  function renderInspectorConsumers(resource) {
    var publishedContext = ["catalog", "consumption", "history", "version-detail", "resource-detail"].indexOf(route()) >= 0;
    if (!publishedContext) {
      return [
        '<section class="inspector-section"><div class="notice info"><div class="notice-content"><b>发布前消费预览</b><span>当前仍是 Draft。这里仅检查资源发布后可提供的语义范围，不读取或复用已有 Published 版本的正式数据绑定。</span></div></div></section>',
        '<section class="inspector-section"><h3>待发布资源</h3><dl class="kv-list">',
        '<dt>稳定资源身份</dt><dd class="mono">' + escapeHtml(resourceId(resource.key)) + '</dd>',
        '<dt>精确语义版本</dt><dd>发布后生成</dd>',
        '<dt>正式数据绑定</dt><dd>等待发布</dd>',
        '<dt>智能问数</dt><dd>发布后可只读发现获准语义资源</dd>',
        '<dt>决策中心</dt><dd>发布后可只读引用 Rule 与 Action Type</dd>',
        '<dt>Agent 应用</dt><dd>发布后可只读引用获准语义资源</dd>',
        '<dt>报告中心</dt><dd>发布后可按稳定身份和精确版本追溯</dd>',
        '</dl></section>'
      ].join("");
    }
    var publishedVersion = activePublishedVersion();
    if (!publishedVersion) return '<section class="inspector-section"><div class="notice error"><div class="notice-content"><b>无法定位 Published 版本</b><span>请返回已发布本体目录重新选择精确语义版本。</span></div></div></section>';
    var publishedSnapshot = publishedEntry(publishedVersion);
    if (!publishedSnapshot.resourceSnapshotComplete) return '<section class="inspector-section"><div class="notice error"><div class="notice-content"><b>消费上下文不完整</b><span>该版本缺少完整资源快照，不能声明为可消费，也不会使用其他版本定义替代。</span></div></div></section>';
    var resourceIdentity = resourceId(resource.key);
    return [
      '<section class="inspector-section"><h3>资源级消费预览</h3><dl class="kv-list">',
      "<dt>稳定资源身份</dt><dd class=\"mono\">" + escapeHtml(resourceIdentity) + "</dd>",
      "<dt>精确语义版本</dt><dd class=\"mono\">" + escapeHtml(publishedVersion) + "</dd>",
      "<dt>获准数据版本</dt><dd class=\"mono\">" + escapeHtml(currentDataVersion()) + "</dd>",
      "<dt>智能问数</dt><dd>对象、关系、Metric、Rule、Action Type 的只读语义上下文</dd>",
      "<dt>决策中心</dt><dd>Rule 证据与 Action Type 引用</dd>",
      "<dt>Agent 应用</dt><dd>获准语义资源与只读证据定位</dd>",
      "<dt>报告中心</dt><dd>稳定语义身份、生成时精确版本与历史解析</dd>",
      "</dl></section>",
      '<section class="inspector-section">' + button("查看 Published 消费包", "go-consumption", { primary: true, small: true }) + "</section>"
    ].join("");
  }

  function renderEvidenceDock() {
    return [
      '<section class="evidence-dock">',
      '<div class="evidence-head"><b>证据与运行记录</b><span>仅在用户执行操作后生成</span><div class="evidence-spacer"></div>',
      '<button type="button" class="dock-tab ' + (ui.dockTab === "events" ? "active" : "") + '" data-action="dock-tab:events">操作记录</button>',
      '<button type="button" class="dock-tab ' + (ui.dockTab === "versions" ? "active" : "") + '" data-action="dock-tab:versions">版本证据</button>',
      "</div>",
      '<div class="evidence-body">' + renderEvidenceBody() + "</div>",
      "</section>"
    ].join("");
  }

  function renderEvidenceBody() {
    var publishedRoute = ["catalog", "consumption", "history", "version-detail", "resource-detail"].indexOf(route()) >= 0;
    var contextVersion = publishedRoute ? activePublishedVersion() : null;
    var events = state.events.filter(function (event) {
      return publishedRoute ? event.semanticVersion === contextVersion : !event.semanticVersion;
    });
    if (ui.dockTab === "versions") {
      events = events.filter(function (event) {
        return ["发布", "C028", "C029", "T018", "T019", "回退", "数据质量"].indexOf(event.kind) >= 0;
      });
    }
    if (!events.length) return '<div class="dock-empty">尚无记录。创建、校验、发布、数据检查或正式切换后将在这里形成证据。</div>';
    return '<div class="event-list">' + events.map(function (event) {
      var kindLabel = {
        "草稿": "Draft",
        C028: "待更新数据",
        C029: "匹配检查",
        T018: "消费验证条件",
        T019: "正式数据切换"
      }[event.kind] || event.kind;
      return [
        '<div class="event-row">',
        '<span class="event-time">' + escapeHtml(event.time) + "</span>",
        '<span class="status ' + (event.tone === "success" ? "green" : event.tone === "error" ? "red" : "blue") + '">' + escapeHtml(kindLabel) + "</span>",
        '<b class="event-title">' + escapeHtml(event.title) + "</b>",
        '<span class="event-detail">' + escapeHtml(event.detail) + "</span>",
        button("查看证据", "open-event-evidence:" + encodeURIComponent(event.id), { small: true }),
        "</div>"
      ].join("");
    }).join("") + "</div>";
  }

  function emptySurface(title, copy, actionLabel, action) {
    return '<section class="panel span-12"><div class="panel-body"><div class="empty-panel"><div class="empty-symbol">◇</div><h2>' + escapeHtml(title) + '</h2><p>' + escapeHtml(copy) + "</p>" + (actionLabel ? button(actionLabel, action, { primary: true }) : "") + "</div></div></section>";
  }

  function renderInstancePreviewPanel() {
    var units = Object.keys(UNIT_DATA).map(function (key) {
      var unit = UNIT_DATA[key];
      return [
        '<article class="question-card">',
        '<div class="property-item-head"><b>' + escapeHtml(unit.code) + '</b>' + status(unit.rule, unit.rule === "R01" ? "amber" : unit.rule === "R02" ? "blue" : "violet") + "</div>",
        '<div class="result">' + escapeHtml(unit.cost) + "</div>",
        '<p>' + escapeHtml(unit.sector + " · " + unit.loanCount + " 笔借据 · " + formatNumber(unit.balance) + " 亿元") + "</p>",
        '<p>' + escapeHtml(unit.keyRatioName + " " + unit.keyRatio + " · " + unit.owner) + "</p>",
        '<div style="margin-top:8px">' + button("查看详情", "open-unit:" + key, { small: true }) + "</div>",
        "</article>"
      ].join("");
    }).join("");
    return '<section class="panel span-12"><div class="panel-head"><div class="panel-head-copy"><h3>实例预览</h3><p>可从主体下钻已核验借据样例、机构与负责人；仅在预览成功后显示</p></div>' + status("可预览", "green") + '</div><div class="panel-body"><div class="question-grid">' + units + "</div></div></section>";
  }

  function renderMappingStage() {
    if (!state.model || !createdObjects().length) {
      return stageShell("字段映射工作区", "字段映射属于 Object Type，不在一级语义画布展示字段连线", "", '<div class="surface-grid">' + emptySurface("先创建业务对象", "创建 Object Type 业务骨架后，再从对象详情选择已发布数据资产成员。", "返回本体建模", "go-model") + "</div>", false);
    }
    var object = currentObject();
    var member = object && MEMBERS.find(function (item) { return item.key === state.objectMembers[object.key]; });
    if (!object || !member) {
      return stageShell("字段映射工作区", "先在 Object Type 的“数据与映射”页签选择来源成员", button("返回对象详情", "back-object", { small: true }), '<div class="surface-grid">' + emptySurface("尚未选择来源成员", "已发布数据资产成员是 Property 创建与字段映射的来源。", "选择数据资产成员", "select-object-member:" + (object ? object.key : createdObjects()[0].key)) + "</div>", false);
    }
    var fields = sourceFieldsForObject(object.key);
    var properties = PROPERTY_RESOURCES.filter(function (item) {
      return item.parentKey === object.key && state.createdPropertyKeys.indexOf(item.key) >= 0;
    });
    var focusKey = state.mappingFocus || (properties[0] && properties[0].key) || (fields[0] && fields[0].key);
    var focusedProperty = properties.find(function (item) { return item.key === focusKey; });
    var focusedField = fields.find(function (item) { return item.key === focusKey || item.propertyKey === focusKey; }) || fields[0];
    var height = Math.max(fields.length, properties.length, 2) * 58 + 42;
    var lines = properties.filter(function (property) { return state.mappedPropertyKeys.indexOf(property.key) >= 0; }).map(function (property) {
      var fieldIndex = fields.findIndex(function (field) { return field.propertyKey === property.key; });
      var propertyIndex = properties.findIndex(function (item) { return item.key === property.key; });
      if (fieldIndex < 0 || propertyIndex < 0) return "";
      var y1 = 67 + fieldIndex * 58;
      var y2 = 67 + propertyIndex * 58;
      var active = focusKey === property.key ? " active" : "";
      return '<path class="mapping-wire' + active + '" d="M 285 ' + y1 + ' C 365 ' + y1 + ', 395 ' + y2 + ', 475 ' + y2 + '"></path>';
    }).join("");
    var fieldRows = fields.map(function (field) {
      var created = field.propertyKey && state.createdPropertyKeys.indexOf(field.propertyKey) >= 0;
      var mapped = field.propertyKey && state.mappedPropertyKeys.indexOf(field.propertyKey) >= 0;
      var endpoint = state.endpointFieldKeys.indexOf(field.key) >= 0;
      var action = field.propertyKey ? (created ? "focus-property:" + field.propertyKey : "create-property:" + field.propertyKey) : "focus-field:" + field.key;
      return '<button type="button" class="map-row data-row ' + ((focusKey === field.key || focusKey === field.propertyKey) ? "focused" : "") + '" data-action="' + escapeHtml(action) + '"><span class="data-field-icon">D</span><span><b>' + escapeHtml(field.name) + '</b><small>' + escapeHtml(field.type + " · " + field.roleHint) + '</small></span><span>' + (mapped ? status("已映射", "green") : endpoint ? status("端点", "blue") : created ? status("待映射", "amber") : status("未创建", "")) + "</span></button>";
    }).join("");
    var propertyRows = properties.map(function (property) {
      var mapped = state.mappedPropertyKeys.indexOf(property.key) >= 0;
      return '<button type="button" class="map-row semantic-row ' + (focusKey === property.key ? "focused" : "") + '" data-action="focus-property:' + escapeHtml(property.key) + '"><span class="resource-glyph property">P</span><span><b>' + escapeHtml(property.name) + '</b><small class="mono">' + escapeHtml(property.id) + '</small></span><span>' + status(mapped ? "已映射" : "待映射", mapped ? "green" : "amber") + "</span></button>";
    }).join("") || '<div class="mapping-column-empty"><b>尚无 Property</b><span>从左侧数据字段逐项创建，或选择字段映射到已有 Property。</span></div>';
    var issue = "";
    if (state.c029Status === "failed" && !state.candidateMappingFixed) issue = '<div class="notice error"><div class="notice-content"><b>待更新数据的机构端点发生变化</b><span>3 条融资明细无法连接融资机构。系统不会按同名字段自动迁移；请核对机构编码并保存重新映射。</span></div><div class="notice-actions">' + button("确认重新映射", "fix-candidate-mapping", { small: true }) + '</div></div>';
    else if (state.mappingPreview === "failed") issue = '<div class="notice error"><div class="notice-content"><b>字段或关系端点不兼容</b><span>系统不会按同名字段自动迁移。请定位具体字段，重新保存映射或重新指定 Link 端点后再试。</span></div></div>';
    else if (state.mappingPreview === "processing") issue = '<div class="notice info"><div class="notice-content"><b>正在核验对象与关系</b><span>检查身份唯一性、字段类型、空值约束和 Link 端点覆盖。</span></div></div>';
    else if (state.mappingPreview === "success") issue = '<div class="notice success"><div class="notice-content"><b>对象与关系预览可用</b><span>四类对象、三条关系及实例范围均已通过当前 Draft 的映射检查。</span></div></div>';
    var focusPanel = "";
    if (focusedProperty) {
      var isMapped = state.mappedPropertyKeys.indexOf(focusedProperty.key) >= 0;
      var identityCompatible = focusedProperty.key === expectedIdentityKey(focusedProperty.parentKey);
      var titleCompatible = focusedProperty.key === expectedTitleKey(focusedProperty.parentKey);
      var endpointCompatible = isEndpointFieldKey(focusedProperty.key);
      var identityAssigned = state.identityAssignments[focusedProperty.parentKey] === focusedProperty.key;
      var titleAssigned = state.titleAssignments[focusedProperty.parentKey] === focusedProperty.key;
      var endpointAssigned = state.endpointFieldKeys.indexOf(focusedProperty.key) >= 0;
      var roleActions = button(isMapped ? "重新保存映射" : "保存字段映射", "save-field-mapping:" + focusedProperty.key, { primary: true, small: true }) +
        button(identityAssigned ? "已设为身份" : "设为身份", "set-property-role:" + focusedProperty.key + ":identity", { small: true, disabled: !isMapped || !identityCompatible || identityAssigned }) +
        button(titleAssigned ? "已设为标题" : "设为标题", "set-property-role:" + focusedProperty.key + ":title", { small: true, disabled: !isMapped || !titleCompatible || titleAssigned }) +
        button(endpointAssigned ? "已设为 Link 端点" : "设为 Link 端点", "set-endpoint:" + focusedProperty.key, { small: true, disabled: !isMapped || !endpointCompatible || endpointAssigned });
      var compatibility = identityCompatible || titleCompatible || endpointCompatible ? "可配置角色已按对象身份、标题与关系端点合同筛选。" : "当前字段仅作为业务属性，不可设为对象身份、标题或关系端点。";
      focusPanel = '<section class="panel span-12"><div class="panel-head"><div class="panel-head-copy"><h3>' + escapeHtml(focusedProperty.name) + '</h3><p class="mono">' + escapeHtml(focusedProperty.id) + '</p></div>' + status(isMapped ? "已映射" : "待映射", isMapped ? "green" : "amber") + '</div><div class="panel-body"><div class="mapping-focus-grid"><dl class="kv-list"><dt>来源字段</dt><dd>' + escapeHtml(focusedField ? focusedField.name : focusedProperty.source) + '</dd><dt>数据类型</dt><dd>' + escapeHtml(focusedProperty.dataType) + '</dd><dt>允许为空</dt><dd>' + escapeHtml(focusedProperty.nullable) + '</dd><dt>示例值</dt><dd>' + escapeHtml((focusedField && focusedField.examples || []).join(" · ")) + '</dd></dl><div><h4>映射和角色</h4><div class="stage-actions">' + roleActions + '</div><p class="section-copy">' + escapeHtml(compatibility) + '</p></div></div></div></section>';
    } else if (focusedField) {
      var fieldEndpointAssigned = state.endpointFieldKeys.indexOf(focusedField.key) >= 0;
      focusPanel = '<section class="panel span-12"><div class="panel-head"><div class="panel-head-copy"><h3>' + escapeHtml(focusedField.name) + '</h3><p>数据资产字段 · ' + escapeHtml(focusedField.type) + '</p></div></div><div class="panel-body"><div class="stage-actions">' + (focusedField.propertyKey ? button("创建 Property", "create-property:" + focusedField.propertyKey, { primary: true, small: true }) : button(fieldEndpointAssigned ? "已设为 Link 端点" : "设为 Link 端点", "set-endpoint:" + focusedField.key, { primary: true, small: true, disabled: fieldEndpointAssigned })) + '</div></div></section>';
    }
    var preview = properties.some(function (property) { return state.mappedPropertyKeys.indexOf(property.key) >= 0; }) ? '<section class="panel span-12"><div class="panel-head"><div class="panel-head-copy"><h3>真实实例预览</h3><p>随当前对象映射刷新，不展示未映射字段的推测结果</p></div></div><div class="panel-body"><div class="preview-records">' + (OBJECT_PREVIEW_VALUES[object.key] || []).map(function (value) { return '<div><span class="resource-glyph object">O</span><b>' + escapeHtml(value) + '</b></div>'; }).join("") + "</div></div></section>" : "";
    var actions = button("返回对象详情", "back-object", { small: true }) + button("检查全部对象与关系", "run-mapping-preview", { primary: true, small: true, disabled: state.mappingPreview === "processing" });
    return stageShell(object.name + " · 字段映射", member.name + " · " + member.grain + " · 自动聚焦当前属性", actions, '<div class="surface-grid">' + (issue ? '<section class="panel span-12"><div class="panel-body">' + issue + "</div></section>" : "") + '<section class="panel span-12 mapping-workspace-panel"><div class="mapping-workspace" style="--mapping-height:' + height + 'px"><div class="mapping-column"><div class="mapping-column-head"><b>数据资产字段</b><span>' + fields.length + ' 个可用字段</span></div>' + fieldRows + '</div><svg class="mapping-wires" viewBox="0 0 760 ' + height + '" preserveAspectRatio="none">' + lines + '</svg><div class="mapping-column"><div class="mapping-column-head"><b>本体属性</b><span>' + properties.length + ' 个已创建 Property</span></div>' + propertyRows + '</div></div></section>' + focusPanel + preview + "</div>", false);
  }

  function getValidationItems() {
    var counts = resourceCounts();
    return [
      { key: "model", name: "4 个 Object Type 均已逐项创建", ok: counts.objects === 4, location: "本体建模工作台", kind: "object", action: "go-model" },
      { key: "properties", name: "21 个 Property 均已从来源字段创建并保存映射", ok: counts.properties === 21 && state.mappedPropertyKeys.length === 21, location: "融资主体 · 属性", kind: "property", action: "repair-resource:subject:properties" },
      { key: "identity", name: "四类对象均有明确身份、标题和来源成员", ok: allObjectMappingsReady(), location: "融资主体 · 数据与映射", kind: "object", action: "repair-resource:subject:mapping" },
      { key: "links", name: "3 个 Link 两端存在且端点可以匹配", ok: counts.links === 3 && requiredEndpointFieldsReady() && state.mappingPreview === "success", location: "融资明细 · 机构编码端点", kind: "link", action: "repair-mapping:detail:field.detail.institution_code" },
      { key: "metrics", name: "7 个 Metric 范围、单位、时间与零分母处理完整", ok: counts.metrics === 7, location: "融资指标", kind: "metric", action: "repair-resource:metric_group:logic" },
      { key: "rules", name: "3 个 Rule 依赖、条件、阈值、证据与样例完整", ok: counts.rules === 3 && state.baselineConfirmed, location: "融资规则", kind: "rule", action: "repair-resource:rule_group:logic" },
      { key: "action", name: "Action Type 目标、输入、前置证据与人工确认完整", ok: counts.actions === 1, location: "发起融资优化建议", kind: "action", action: "repair-resource:action_optimize:logic" },
      { key: "terminology", name: "首选名称、同义词与不推荐表达完整", ok: counts.total === 39, location: "余额加权平均融资成本 · 概览", kind: "object", action: "repair-resource:metric_weighted_cost:overview" }
    ];
  }

  function renderReleaseStage() {
    if (!state.model) {
      return stageShell("统一校验", "统一检查对象、关系、Metric、Rule 与 Action Type", "", '<div class="surface-grid">' + emptySurface("先创建本体", "没有 Draft 资源可以校验。", "进入本体建模工作台", "go-model") + "</div>", false);
    }
    var items = getValidationItems();
    var counts = resourceCounts();
    var passed = items.filter(function (item) { return item.ok; }).length;
    var allReady = passed === items.length;
    var actions = state.semanticVersion && !state.draftRevisionBase ?
      button("查看 Published 目录", "go-catalog", { primary: true, small: true }) :
      state.validationStatus === "success" ?
        button("发布语义版本", "open-publish", { primary: true, small: true }) :
        button(state.validationStatus === "processing" ? "校验中" : "运行统一校验", "run-validation", { primary: true, small: true, disabled: state.validationStatus === "processing" });
    var resultNotice = "";
    if (state.validationStatus === "processing") {
      resultNotice = '<div class="notice info"><div class="notice-content"><b>正在运行统一校验</b><span>候选资源仍保持 Draft，不会提前进入正式目录。</span></div></div>';
    } else if (state.validationStatus === "failed") {
      resultNotice = '<div class="notice error"><div class="notice-content"><b>发布被未通过项阻断</b><span>修正后重新校验；失败不会产生语义版本。</span></div></div>';
    } else if (state.validationStatus === "success") {
      resultNotice = '<div class="notice success"><div class="notice-content"><b>全部发布门禁通过</b><span>可以原子发布 4 个 Object Type、21 个 Property、3 个 Link Type、7 个 Metric、3 个 Rule 和 1 个 Action Type。</span></div></div>';
    }
    if (state.semanticVersion && !state.draftRevisionBase) {
      resultNotice = '<div class="notice success"><div class="notice-content"><b>语义版本已发布</b><span>' + escapeHtml(state.semanticVersion) + " · " + escapeHtml(state.publishedAt) + "。当前仍等待正式数据绑定。</span></div></div>";
    }
    var rows = items.map(function (item, index) {
      var checked = state.validationStatus !== "idle" && state.validationStatus !== "processing";
      var iconClass = !checked ? "" : item.ok ? "pass" : "fail";
      var iconText = !checked ? "·" : item.ok ? "✓" : "!";
      var stateText = !checked ? status("待检查", "") : item.ok ? status("通过", "green") : status("失败", "red");
      return '<div class="validation-row"><span class="validation-icon ' + iconClass + '">' + iconText + '</span><div class="validation-copy"><b>' + escapeHtml(item.name) + '</b><small>' + escapeHtml(item.location) + '</small></div><div class="stage-actions">' + stateText + (!item.ok && state.validationStatus === "failed" ? button("去修正", item.action, { small: true, ghost: true }) : "") + "</div></div>";
    }).join("");
    return stageShell(
      "统一校验与发布",
      "失败项阻断发布；警告必须有允许继续的明确解释；Published 与 Draft 严格分开",
      actions,
      [
        '<div class="surface-grid">',
        '<section class="panel span-12"><div class="panel-body">' + (resultNotice || '<div class="notice info"><div class="notice-content"><b>尚未运行统一校验</b><span>当前可检查 ' + items.length + " 类发布合同，已具备 " + passed + " 类前置条件。</span></div></div>") + "</div></section>",
        '<section class="panel span-7"><div class="panel-head"><div class="panel-head-copy"><h3>发布门禁</h3><p>' + passed + " / " + items.length + " 类前置条件已具备</p></div>" + (allReady ? status("可运行", "blue") : status("存在缺口", "amber")) + '</div><div class="panel-body"><div class="validation-list">' + rows + "</div></div></section>",
        '<section class="panel span-5"><div class="panel-head"><div class="panel-head-copy"><h3>发布范围</h3><p>只发布当前 Draft 中已完成校验的资源</p></div></div><div class="panel-body"><dl class="kv-list"><dt>Object Type</dt><dd>' + counts.objects + '</dd><dt>Property</dt><dd>' + counts.properties + '</dd><dt>Link Type</dt><dd>' + counts.links + '</dd><dt>Metric</dt><dd>' + counts.metrics + '</dd><dt>Rule</dt><dd>' + counts.rules + '</dd><dt>Action Type</dt><dd>' + counts.actions + '</dd><dt>资源总计</dt><dd>' + counts.total + '</dd><dt>当前状态</dt><dd>' + (state.draftRevisionBase || !state.semanticVersion ? "Draft" : "Published") + '</dd><dt>基于版本</dt><dd class="mono">' + escapeHtml(state.draftRevisionBase || "首次发布") + '</dd><dt>发布后版本</dt><dd class="mono">确认发布后生成</dd></dl></div></section>',
        state.semanticHistory.length ? '<section class="panel span-12"><div class="panel-head"><div class="panel-head-copy"><h3>Published 历史</h3><p>旧版本定义不会被新版本原地覆盖</p></div></div><div class="panel-body flush">' + renderSemanticHistoryTable() + "</div></section>" : "",
        "</div>"
      ].join(""),
      false
    );
  }

  function renderSemanticHistoryTable(versions) {
    var rows = versions || state.semanticHistory;
    return '<table class="data-table"><thead><tr><th>语义版本</th><th>状态</th><th>发布时间</th><th>资源范围</th><th>操作</th></tr></thead><tbody>' + rows.map(function (version) {
      var counts = version.counts || { objects: 4, properties: 21, links: 3, metrics: 7, rules: 3, actions: 1, total: 39 };
      return '<tr><td class="mono">' + escapeHtml(version.semanticVersion) + '</td><td>' + semanticVersionStatus(version.semanticVersion) + '</td><td>' + escapeHtml(version.publishedAt) + '</td><td>' + counts.objects + ' Object · ' + counts.properties + ' Property · ' + counts.links + ' Link · ' + counts.metrics + ' Metric · ' + counts.rules + ' Rule · ' + counts.actions + ' Action Type（' + counts.total + ' 项）</td><td>' + button("查看详情", "open-version-detail:" + version.semanticVersion, { small: true }) + "</td></tr>";
    }).join("") + "</tbody></table>";
  }

  function publishedWorkspaceNav(active) {
    var items = [
      ["version-detail", "版本概览"],
      ["catalog", "资源与模型"],
      ["consumption", "数据与消费"],
      ["consumption", "更新与回退"],
      ["history", "记录与证据"]
    ];
    return '<div class="published-tabs">' + items.map(function (item, index) {
      var key = item[0] + (index === 3 ? "-update" : "");
      return '<button type="button" class="published-tab ' + (active === key ? "active" : "") + '" data-action="published-tab:' + key + '">' + escapeHtml(item[1]) + "</button>";
    }).join("") + "</div>";
  }

  function renderCatalogStage() {
    if (!state.semanticVersion) {
      return stageShell("已发布本体", "只展示已发布资源；Draft 不进入正式目录", button("进入统一校验", "go-release", { primary: true, small: true }), '<div class="surface-grid">' + emptySurface("正式目录为空", "完成统一校验并发布后，资源才会进入 Published 目录。", "进入统一校验", "go-release") + "</div>", false);
    }
    var entry = publishedEntry();
    if (!entry) return renderMissingPublishedVersionStage("已发布本体");
    if (!entry.resourceSnapshotComplete) return renderIncompletePublishedSnapshotStage("已发布本体", entry);
    var version = entry.semanticVersion;
    var resources = publishedResources(entry && entry.semanticVersion).filter(function (resource) {
      return matchesTree(resource.name + " " + resource.type + " " + resourceId(resource.key, version));
    });
    var actions = '<div class="segmented"><button type="button" class="' + (ui.catalogView === "cards" ? "active" : "") + '" data-action="catalog-cards">卡片</button><button type="button" class="' + (ui.catalogView === "list" ? "active" : "") + '" data-action="catalog-list">列表</button><button type="button" class="' + (ui.catalogView === "model" ? "active" : "") + '" data-action="catalog-model">模型全景</button></div>' +
      button(state.draftRevisionBase ? "继续编辑 Draft" : "基于所选版本创建 Draft", state.draftRevisionBase ? "go-model" : "open-revision", { small: true }) +
      button("查看消费包", "go-consumption", { primary: true, small: true });
    var content = ui.catalogView === "list" ? renderCatalogList(resources, version) : ui.catalogView === "model" ? renderPublishedModelPanorama(resources, version) : renderCatalogCards(resources, version);
    var counts = entry && entry.counts || resourceCounts();
    var versionOptions = state.semanticHistory.map(function (item) { return '<option value="' + escapeHtml(item.semanticVersion) + '"' + (item.semanticVersion === version ? " selected" : "") + '>' + escapeHtml(item.semanticVersion + " · " + item.publishedAt) + '</option>'; }).join("");
    return stageShell("已发布本体", version + " · 资源、正式数据与记录均归属于这个精确语义版本", actions, [
      '<div class="surface-grid">',
      '<section class="panel span-12"><div class="panel-body">' + publishedWorkspaceNav("catalog") + '</div></section>',
      '<section class="panel span-12"><div class="published-context"><div><span>本体</span><b>' + escapeHtml(entry.modelContract && entry.modelContract.name || "本体名称缺失") + '</b></div><label><span>Published 语义版本</span><select data-input="published-version">' + versionOptions + '</select></label><div><span>版本状态</span>' + semanticVersionStatus(version) + '</div>' + button("查看版本详情", "open-version-detail:" + version, { small: true }) + '</div></section>',
      '<section class="panel span-12"><div class="panel-body"><div class="stat-grid"><div class="stat-item blue"><span>全部语义资源</span><strong>' + counts.total + '</strong><small>同一精确 Published 版本</small></div><div class="stat-item"><span>Object / Property</span><strong>' + counts.objects + ' / ' + counts.properties + '</strong><small>属性可独立定位</small></div><div class="stat-item green"><span>Link / Metric / Rule</span><strong>' + counts.links + ' / ' + counts.metrics + ' / ' + counts.rules + '</strong><small>只沿 Published Link 导航</small></div><div class="stat-item amber"><span>Action Type</span><strong>' + counts.actions + '</strong><small>只定义可请求行动</small></div></div></div></section>',
      '<section class="panel span-12"><div class="panel-head"><div class="panel-head-copy"><h3>正式资源</h3><p>显示名称不作为唯一身份；同名资源不得自动迁移</p></div>' + status("Published", "green") + '</div><div class="panel-body">' + content + "</div></section>",
      "</div>"
    ].join(""), false);
  }

  function renderCatalogCards(resources, version) {
    if (!resources.length) return '<div class="empty-panel"><h2>没有匹配的资源</h2><p>调整左侧搜索条件后重试。</p></div>';
    return '<div class="member-grid">' + resources.map(function (resource) {
      var kind = resource.type === "Object Type" ? "object" : resource.type === "Property" ? "property" : resource.type === "Link Type" ? "link" : resource.type === "Metric" ? "metric" : resource.type === "Rule" ? "rule" : "action";
      var glyph = kind === "property" ? "P" : kind.charAt(0).toUpperCase();
      return '<article class="member-card"><div class="member-card-head"><span class="resource-glyph ' + kind + '">' + glyph + '</span><div><h4>' + escapeHtml(resource.name) + '</h4><p>' + escapeHtml(resource.definition || resource.condition || resource.result || resource.direction) + '</p></div>' + status("Published", "green") + '</div><div class="member-meta"><span class="mono">' + escapeHtml(resourceId(resource.key, version)) + '</span><span class="mono">' + escapeHtml(version) + '</span></div><div style="margin-top:8px">' + button("查看详情", "open-resource-detail:" + resource.key, { small: true }) + "</div></article>";
    }).join("") + "</div>";
  }

  function renderCatalogList(resources, version) {
    return '<table class="data-table"><thead><tr><th>业务名称</th><th>类型</th><th>稳定资源身份</th><th>精确语义版本</th><th>状态</th><th></th></tr></thead><tbody>' + resources.map(function (resource) {
      return '<tr><td><b>' + escapeHtml(resource.name) + '</b></td><td>' + escapeHtml(resource.type) + '</td><td class="mono">' + escapeHtml(resourceId(resource.key, version)) + '</td><td class="mono">' + escapeHtml(version) + '</td><td>' + status("Published", "green") + '</td><td>' + button("查看详情", "open-resource-detail:" + resource.key, { small: true }) + "</td></tr>";
    }).join("") + "</tbody></table>";
  }

  function renderPublishedModelPanorama(resources, version) {
    var objects = resources.filter(function (resource) { return resource.type === "Object Type"; });
    var links = resources.filter(function (resource) { return resource.type === "Link Type"; });
    var metrics = resources.filter(function (resource) { return resource.type === "Metric"; });
    var rules = resources.filter(function (resource) { return resource.type === "Rule"; });
    var actions = resources.filter(function (resource) { return resource.type === "Action Type"; });
    var objectKeyById = {};
    objects.forEach(function (object) { objectKeyById[object.id] = object.key; });
    var nodes = objects.map(function (object) {
      return { key: object.key, name: object.name, kind: "object", type: object.type, rows: "稳定身份 " + object.identityPropertyId, targetKey: object.key };
    });
    if (metrics.length) nodes.push({ key: "metric_group", name: "融资指标", kind: "logic", type: "Metric", rows: metrics.length + " 个 Metric", targetKey: metrics[0].key });
    if (rules.length) nodes.push({ key: "rule_group", name: "融资规则", kind: "rule", type: "Rule", rows: rules.length + " 个 Rule", targetKey: rules[0].key });
    actions.forEach(function (action) {
      nodes.push({ key: action.key, name: action.name, kind: "action", type: action.type, rows: "目标 " + action.target, targetKey: action.key });
    });
    var edges = links.map(function (link) {
      return { from: objectKeyById[link.sourceObjectId], to: objectKeyById[link.targetObjectId], label: link.name + " " + link.cardinality };
    }).filter(function (edge) { return edge.from && edge.to; });
    if (metrics.length) {
      var metricObjectKey = objectKeyById[(metrics[0].appliesToObjectIds || [])[0]];
      if (metricObjectKey) edges.push({ from: metricObjectKey, to: "metric_group", label: "计算" });
    }
    if (metrics.length && rules.length) edges.push({ from: "metric_group", to: "rule_group", label: "判断" });
    if (rules.length && actions.length) edges.push({ from: "rule_group", to: actions[0].key, label: "允许请求" });
    var edgeMarkup = edges.map(function (edge) {
      var from = DEFAULT_POSITIONS[edge.from];
      var to = DEFAULT_POSITIONS[edge.to];
      if (!from || !to) return "";
      var fromX = from.x + 87;
      var fromY = from.y + 52;
      var toX = to.x + 87;
      var toY = to.y + 52;
      var dx = toX - fromX;
      var dy = toY - fromY;
      var length = Math.sqrt(dx * dx + dy * dy);
      var angle = Math.atan2(dy, dx) * 180 / Math.PI;
      return '<div class="relation-line" style="left:' + fromX + 'px;top:' + fromY + 'px;width:' + length + 'px;transform:rotate(' + angle + 'deg)"></div><div class="relation-label" style="left:' + ((fromX + toX) / 2) + 'px;top:' + ((fromY + toY) / 2) + 'px">' + escapeHtml(edge.label) + '</div>';
    }).join("");
    var nodeMarkup = nodes.map(function (node) {
      var position = DEFAULT_POSITIONS[node.key];
      if (!position) return "";
      return '<button type="button" class="model-node published-node ' + escapeHtml(node.kind) + '" style="left:' + position.x + 'px;top:' + position.y + 'px" data-action="open-resource-detail:' + escapeHtml(node.targetKey) + '"><div class="node-head"><span class="resource-glyph ' + escapeHtml(node.kind === "logic" ? "metric" : node.kind) + '">' + escapeHtml(node.kind === "object" ? "O" : node.kind === "logic" ? "M" : node.kind === "rule" ? "R" : "A") + '</span><div class="node-head-copy"><b>' + escapeHtml(node.name) + '</b><small>' + escapeHtml(node.type) + '</small></div></div><div class="node-body"><div class="node-row"><span>' + escapeHtml(node.rows) + '</span><strong>Published</strong></div><div class="node-row"><span class="mono">' + escapeHtml(version) + '</span></div></div></button>';
    }).join("");
    return '<div class="published-model-canvas"><div class="published-model-world">' + edgeMarkup + nodeMarkup + '</div></div>';
  }

  function renderConsumptionStage() {
    if (!state.semanticVersion) {
      return stageShell("数据与消费", "先发布精确语义版本，再管理正式数据绑定", button("进入统一校验", "go-release", { primary: true, small: true }), '<div class="surface-grid">' + emptySurface("尚无 Published 语义版本", "Draft 和待检查资源不得进入正式消费范围。", "进入统一校验", "go-release") + "</div>", false);
    }
    var contextVersion = activePublishedVersion();
    if (!contextVersion) return renderMissingPublishedVersionStage("数据与消费");
    var contextEntry = publishedEntry(contextVersion);
    if (!contextEntry.resourceSnapshotComplete) return renderIncompletePublishedSnapshotStage("数据与消费", contextEntry);
    if (contextVersion !== state.semanticVersion) return renderHistoricalConsumptionStage(contextVersion);
    var updateMode = ui.publishedSection === "update";
    var primaryAction = "";
    if (!updateMode) {
      primaryAction = button("处理数据更新", "published-tab:consumption-update", { primary: true, small: true });
    } else if (!state.candidateVersion) {
      primaryAction = button(state.currentBinding ? "接收待更新数据" : "接收首个数据版本", "read-c028", { primary: true, small: true });
    } else if (state.c028Status === "accepted" && state.c029Status === "none") {
      primaryAction = button("检查数据与本体", "process-c029", { primary: true, small: true });
    } else if (state.c029Status === "failed") {
      primaryAction = state.candidateMappingFixed ? button("重新检查", "retry-c029", { primary: true, small: true }) : button("重新映射", "go-mapping", { primary: true, small: true });
    } else if (state.t018Status === "qualified" && state.fixedStatus !== "success") {
      primaryAction = button(state.fixedStatus === "failed" ? "重试业务消费验证" : "运行业务消费验证", "run-fixed-validation", { primary: true, small: true, disabled: state.fixedStatus === "processing" });
    } else if (state.t018Status === "qualified" && state.fixedStatus === "success" && state.bindingStatus !== "processing") {
      primaryAction = button("切换为正式数据", "open-adopt", { primary: true, small: true });
    } else if (state.currentBinding && state.candidateVersion === null) {
      primaryAction = button("接收待更新数据", "read-c028", { primary: true, small: true });
    }
    var bindingCards = renderBindingCards();
    var flow = renderConsumptionFlow();
    var fixedPanel = renderFixedQuestionPanel();
    var qualityNotice = "";
    if (state.currentBinding && state.candidateCycle >= 2 && state.authorityQuality === "unchecked" && !state.candidateVersion) {
      qualityNotice = '<div class="notice info"><div class="notice-content"><b>可检查当前正式数据状态</b><span>检查只读取数据工程发布的质量事实；本体不会修改数据版本。</span></div><div class="notice-actions">' + button("检查当前状态", "check-authority-quality", { small: true }) + "</div></div>";
    } else if (state.authorityQuality === "processing") {
      qualityNotice = '<div class="notice info"><div class="notice-content"><b>正在检查当前正式数据状态</b><span>检查完成前继续使用当前正式版本。</span></div></div>';
    } else if (state.currentBlocked) {
      qualityNotice = '<div class="notice error"><div class="notice-content"><b>当前正式数据发现质量阻断</b><span>受影响版本的新请求已停止；若同一语义版本内存在上一可信数据且证据完整，可确认回退。</span></div><div class="notice-actions">' + (previousBindingForCurrent() ? button("回退上一可信数据", "open-rollback", { small: true }) : "") + "</div></div>";
    }
    return stageShell(
      updateMode ? "更新与回退" : "数据与消费",
      updateMode ? contextVersion + " · 按顺序完成匹配检查、业务消费验证与正式切换" : contextVersion + " · 查看正式数据范围与下游只读消费状态",
      primaryAction,
      [
        '<div class="surface-grid">',
        updateMode && qualityNotice ? '<section class="panel span-12"><div class="panel-body">' + qualityNotice + "</div></section>" : "",
        '<section class="panel span-12"><div class="panel-body">' + publishedWorkspaceNav(ui.publishedSection === "update" ? "consumption-update" : "consumption") + "</div></section>",
        '<section class="panel span-12"><div class="panel-head"><div class="panel-head-copy"><h3>正式、待更新与上一可信数据</h3><p>同一次消费不得混用不同语义版本或数据版本</p></div></div><div class="panel-body">' + bindingCards + "</div></section>",
        updateMode ? '<section class="panel span-12"><div class="panel-head"><div class="panel-head-copy"><h3>数据更新流程</h3><p>失败时继续使用当前正式版本，并保留修正、重试与回退入口</p></div></div><div class="panel-body">' + flow + "</div></section>" : "",
        updateMode ? fixedPanel : "",
        updateMode ? "" : '<section class="panel span-12"><div class="panel-head"><div class="panel-head-copy"><h3>Published 语义消费预览</h3><p>只读显示本体向下游提供什么，不进入下游模块内部页面</p></div></div>' + renderConsumerPreview() + "</section>",
        "</div>"
      ].join(""),
      false
    );
  }

  function renderHistoricalConsumptionStage(version) {
    var updateMode = ui.publishedSection === "update";
    var isOfficialCurrent = isCurrentOfficialVersion(version);
    var bindings = state.bindingHistory.filter(function (binding) { return binding.semanticVersion === version; });
    var rows = bindings.length ? '<table class="data-table"><thead><tr><th>动作</th><th>数据版本</th><th>数据截至时间</th><th>时间</th><th>记录</th></tr></thead><tbody>' + bindings.map(function (binding) {
      return '<tr><td>' + escapeHtml(binding.action) + '</td><td class="mono">' + escapeHtml(binding.dataVersion) + '</td><td>' + escapeHtml(binding.asOf) + '</td><td>' + escapeHtml(binding.adoptedAt) + '</td><td class="mono">' + escapeHtml(binding.bindingId) + '</td></tr>';
    }).join("") + '</tbody></table>' : '<div class="empty-panel"><h2>该版本没有正式数据记录</h2><p>语义版本已发布，但没有数据切换、失败或回退记录。</p></div>';
    return stageShell(updateMode ? "更新与回退" : "数据与消费", version + (isOfficialCurrent ? " · 当前正式使用版本只读上下文" : " · 历史 Published 版本只读上下文"), button("返回最新 Published", "select-current-published", { primary: true, small: true }), '<div class="surface-grid"><section class="panel span-12"><div class="panel-body">' + publishedWorkspaceNav(updateMode ? "consumption-update" : "consumption") + '</div></section><section class="panel span-12"><div class="panel-head"><div class="panel-head-copy"><h3>' + (isOfficialCurrent ? "当前正式数据记录" : "历史版本数据记录") + '</h3><p>数据更新只能在最新 Published 版本中发起</p></div>' + status(isOfficialCurrent ? "当前正式使用" : "只读", isOfficialCurrent ? "green" : "blue") + '</div><div class="panel-body flush">' + rows + '</div></section>' + (updateMode ? '' : '<section class="panel span-12"><div class="panel-head"><div class="panel-head-copy"><h3>Published 语义消费预览</h3><p>' + (isOfficialCurrent ? "下游当前按这一精确版本和正式数据组合读取" : "下游仍可按本版本稳定身份追溯旧正式证据") + '</p></div></div>' + renderConsumerPreview() + '</section>') + '</div>', false);
  }

  function renderBindingCards() {
    function card(kind, title, binding, statusMarkup, copy) {
      return '<article class="binding-card ' + kind + '"><div class="property-item-head"><h4>' + escapeHtml(title) + '</h4>' + statusMarkup + '</div><div class="binding-pair"><b class="mono">' + escapeHtml(binding ? binding.semanticVersion : "无语义版本") + '</b><b class="mono">' + escapeHtml(binding ? binding.dataVersion : "无数据版本") + '</b></div><p>' + escapeHtml(copy) + "</p></article>";
    }
    var currentTone = state.currentBlocked ? status("受阻断", "red") : state.currentBinding ? status("服务中", "green") : status("尚未切换", "");
    var currentCopy = state.currentBinding ? "数据截至 " + state.currentBinding.asOf + "；切换时间 " + state.currentBinding.adoptedAt : "待更新数据通过全部检查并经用户确认后，才会成为正式数据。";
    var candidate = state.candidateVersion ? { semanticVersion: state.semanticVersion, dataVersion: state.candidateVersion } : null;
    var candidateTone = state.c029Status === "failed" ? status("不匹配", "red") :
      state.c029Status === "processing" ? status("检查中", "blue", true) :
        state.t018Status === "qualified" && state.fixedStatus === "processing" ? status("消费验证中", "blue", true) :
          state.t018Status === "qualified" && state.fixedStatus === "failed" ? status("消费验证失败", "red") :
            state.t018Status === "qualified" && state.fixedStatus === "success" ? status("等待确认切换", "amber") :
              state.t018Status === "qualified" ? status("可运行验证", "amber") :
                state.c028Status === "accepted" ? status("已收到", "amber") :
                  state.c028Status === "processing" ? status("接收中", "blue", true) :
                    state.candidateVersion ? status("待更新", "amber") : status("当前无待更新", "");
    var matchText = state.c029Status === "processing" ? "检查中" : state.c029Status === "success" ? "匹配" : state.c029Status === "failed" ? "不匹配" : "未检查";
    var readinessText = state.t018Status === "qualified" ? "已具备消费验证条件" : state.t018Status === "not_qualified" ? "暂不具备" : "待判断";
    var candidateCopy = state.candidateVersion ? "数据截至 " + state.candidateAsOf + "；匹配检查 " + matchText + "；" + readinessText : "当前没有待处理的数据更新。";
    var compatiblePrevious = previousBindingForCurrent();
    var previousTone = compatiblePrevious ? status("可回退", "") : status("无记录", "");
    var previousCopy = compatiblePrevious ? "数据截至 " + compatiblePrevious.asOf + "；与当前正式语义版本一致，可用于受控回退。" : "当前正式语义版本内尚无上一可信数据。";
    return '<div class="binding-grid">' +
      card(state.currentBlocked ? "blocked" : "current", "当前正式使用版本", state.currentBinding, currentTone, currentCopy) +
      card("candidate", "待更新数据", candidate, candidateTone, candidateCopy) +
      card("previous", "上一可信数据", compatiblePrevious, previousTone, previousCopy) +
      "</div>";
  }

  function bindingForVersion(version) {
    if (state.currentBinding && state.currentBinding.semanticVersion === version) return state.currentBinding;
    return state.bindingHistory.find(function (binding) { return binding.semanticVersion === version; }) || null;
  }

  function renderVersionBindingSummary(version) {
    var binding = bindingForVersion(version);
    var isOfficialCurrent = isCurrentOfficialVersion(version);
    return '<div class="binding-grid"><article class="binding-card ' + (binding ? "current" : "candidate") + '"><div class="property-item-head"><h4>语义状态</h4>' + status("Published", "green") + '</div><div class="binding-pair"><b class="mono">' + escapeHtml(version) + '</b><b>' + escapeHtml(binding ? isOfficialCurrent ? "正式数据服务中" : "历史正式记录" : "等待数据绑定") + '</b></div><p>语义发布与正式数据切换分别记录。</p></article><article class="binding-card previous"><div class="property-item-head"><h4>正式数据</h4>' + status(binding ? isOfficialCurrent ? "当前正式使用" : "历史记录" : "无记录", binding ? isOfficialCurrent ? "green" : "blue" : "") + '</div><div class="binding-pair"><b class="mono">' + escapeHtml(binding ? binding.dataVersion : "尚未切换") + '</b><b>' + escapeHtml(binding ? "数据截至 " + binding.asOf : "等待数据更新流程") + '</b></div><p>' + escapeHtml(binding ? "切换时间 " + binding.adoptedAt : "匹配检查、业务消费验证和用户确认均未完成。") + '</p></article></div>';
  }

  function renderConsumptionFlow() {
    var steps = [
      {
        index: "1",
        title: "收到待更新数据",
        copy: state.candidateVersion || "等待数据工程提交已发布数据版本",
        status: state.c028Status === "processing" ? status("接收中", "blue", true) : state.c028Status === "accepted" ? status("已收到", "blue") : status("未开始", "")
      },
      {
        index: "2",
        title: "检查数据与本体是否匹配",
        copy: "对象、属性类型、关系端点和成员范围",
        status: state.c029Status === "processing" ? status("检查中", "blue", true) : state.c029Status === "success" ? status("匹配", "green") : state.c029Status === "failed" ? status("不匹配", "red") : status("未开始", "")
      },
      {
        index: "3",
        title: "具备消费验证条件",
        copy: state.t018Status === "qualified" ? "版本、证据定位和本体匹配结果完整" : "匹配检查通过后再判断",
        status: state.t018Status === "qualified" ? status("已具备", "green") : state.c029Status === "failed" ? status("不具备", "red") : status("未判断", "")
      },
      {
        index: "4",
        title: "运行业务消费验证",
        copy: state.fixedStatus === "success" ? "8 / 8 业务问题通过" : state.fixedStatus === "failed" ? "7 / 8 完成，需重试" : "验证智能问数与行动引用所需的业务结果",
        status: state.fixedStatus === "processing" ? status("验证中", "blue", true) : state.fixedStatus === "success" ? status("通过", "green") : state.fixedStatus === "failed" ? status("失败", "red") : status("未开始", "")
      },
      {
        index: "5",
        title: "用户确认切换为正式数据",
        copy: state.currentBinding ? "当前数据截至 " + state.currentBinding.asOf : "确认前继续使用当前正式版本",
        status: state.bindingStatus === "processing" ? status("切换中", "blue", true) : state.candidateVersion && state.fixedStatus === "success" ? status("等待确认", "amber") : state.currentBinding ? status("已正式使用", "green") : status("未开始", "")
      }
    ];
    return '<div class="flow-rail">' + steps.map(function (step) {
      return '<article class="flow-step"><span class="flow-step-index">' + step.index + '</span><h4>' + escapeHtml(step.title) + '</h4><p class="mono">' + escapeHtml(step.copy) + "</p>" + step.status + "</article>";
    }).join("") + "</div>";
  }

  function renderFixedQuestionPanel() {
    if (!state.candidateVersion) return "";
    var summary = state.fixedStatus === "success" ? status("8 / 8 通过", "green") :
      state.fixedStatus === "failed" ? status("7 / 8 完成", "red") :
        state.fixedStatus === "processing" ? status("验证中", "blue", true) : status("未验证", "");
    var cards = FIXED_QUESTIONS.map(function (question, index) {
      var itemStatus = state.fixedStatus === "success" ? status("通过", "green") :
        state.fixedStatus === "failed" && index === 4 ? status("超时", "red") :
          state.fixedStatus === "failed" ? status("通过", "green") :
            state.fixedStatus === "processing" ? status("验证中", "blue", true) : status("待运行", "");
      return '<article class="compact-item"><div class="compact-item-head"><b>' + escapeHtml(question.code + " " + question.title) + '</b>' + itemStatus + '</div><small>' + escapeHtml(question.focus) + "</small></article>";
    }).join("");
    return '<section class="panel span-12"><div class="panel-head"><div class="panel-head-copy"><h3>业务消费验证</h3><p>单个问题成功不会自动完成整个数据更新流程</p></div>' + summary + '</div><div class="panel-body"><div class="member-grid">' + cards + "</div></div></section>";
  }

  function renderConsumerPreview() {
    var consumers = [
      { key: "qa", name: "智能问数" },
      { key: "decision", name: "决策中心" },
      { key: "agent", name: "Agent 应用" },
      { key: "report", name: "报告中心" }
    ];
    var tabs = '<div class="consumer-tabs">' + consumers.map(function (consumer) {
      return '<button type="button" class="consumer-tab ' + (ui.consumer === consumer.key ? "active" : "") + '" data-action="consumer:' + consumer.key + '">' + escapeHtml(consumer.name) + "</button>";
    }).join("") + "</div>";
    var version = activePublishedVersion();
    var versionBindings = state.bindingHistory.filter(function (binding) { return binding.semanticVersion === version; });
    var isOfficialCurrent = isCurrentOfficialVersion(version);
    var current = isOfficialCurrent ? state.currentBinding : versionBindings[0] || null;
    var previous = state.previousBinding && state.previousBinding.semanticVersion === version ? state.previousBinding : null;
    var official = publishedResources(version);
    var resourceRows = [
      ["Object Type", official.filter(function (item) { return item.type === "Object Type"; }).map(function (item) { return item.name + " [" + resourceId(item.key, version) + "]"; }).join("；")],
      ["Property", official.filter(function (item) { return item.type === "Property"; }).map(function (item) { return item.parentName + "." + item.name + " [" + resourceId(item.key, version) + "]"; }).join("；")],
      ["Link", official.filter(function (item) { return item.type === "Link Type"; }).map(function (item) { return item.direction + " [" + resourceId(item.key, version) + "]"; }).join("；")],
      ["Metric", official.filter(function (item) { return item.type === "Metric"; }).map(function (item) { return item.name + " [" + resourceId(item.key, version) + "]"; }).join("；")],
      ["Rule", official.filter(function (item) { return item.type === "Rule"; }).map(function (item) { return item.code + " " + item.name + " [" + resourceId(item.key, version) + "]"; }).join("；")],
      ["Action Type", official.filter(function (item) { return item.type === "Action Type"; }).map(function (item) { return item.name + " [" + resourceId(item.key, version) + "]"; }).join("；")]
    ];
    var consumerCopy = {
      qa: "可发现、绑定并只读引用 Published 对象、关系、Metric、Rule 与 Action Type；只沿 Published Link 导航，不按源字段临时 Join。",
      decision: "只读接收 Rule 证据与同版 Action Type 引用；提醒、人工确认和待办运行不在本页面配置。",
      agent: "只读接收获准语义资源与证据定位；不得创建、修改或重新解释本体定义。",
      report: "按稳定资源身份和报告生成时精确 Published 版本定位历史定义；不在本体内比对报告内容。"
    }[ui.consumer];
    return [
      tabs,
      '<div class="panel-body"><div class="notice info"><div class="notice-content"><b>' + escapeHtml(consumers.find(function (item) { return item.key === ui.consumer; }).name) + '</b><span>' + escapeHtml(consumerCopy) + "</span></div></div>",
      '<dl class="kv-list" style="margin-top:10px"><dt>精确语义版本</dt><dd class="mono">' + escapeHtml(version) + '</dd><dt>正式数据版本</dt><dd class="mono">' + escapeHtml(current ? current.dataVersion : "尚未切换") + '</dd><dt>数据截至时间</dt><dd>' + escapeHtml(current ? current.asOf : "尚未切换") + '</dd><dt>当前消费状态</dt><dd>' + (isOfficialCurrent && state.currentBlocked ? "当前正式版本已阻断" : current ? isOfficialCurrent ? "正式数据服务中" : "历史正式记录" : "等待数据绑定") + '</dd><dt>上一可信数据</dt><dd class="mono">' + escapeHtml(previous ? previous.dataVersion : "无") + "</dd></dl>",
      '<div class="table-wrap" style="margin-top:10px"><table class="data-table"><thead><tr><th>资源类型</th><th>获准资源、稳定身份与方向</th></tr></thead><tbody>' + resourceRows.map(function (row) {
        return "<tr><td><b>" + escapeHtml(row[0]) + "</b></td><td>" + escapeHtml(row[1]) + "</td></tr>";
      }).join("") + "</tbody></table></div>",
      (current || state.fixedStatus === "success") ? '<div class="question-grid" style="margin-top:10px">' + Object.keys(UNIT_DATA).map(function (key) {
        var unit = UNIT_DATA[key];
        return '<article class="question-card"><div class="property-item-head"><h4>' + escapeHtml(unit.code + " · " + unit.rule) + '</h4>' + status(current ? "正式证据可定位" : "待更新证据可定位", current ? "green" : "blue") + '</div><div class="result">' + escapeHtml(unit.cost) + '</div><p>' + escapeHtml(unit.keyRatioName + " " + unit.keyRatio) + '</p><p>' + escapeHtml(unit.banks.slice(0, 3).map(function (bank) { return bank.name; }).join("、")) + '</p>' + button("查看详情", "open-unit:" + key, { small: true }) + "</article>";
      }).join("") + "</div>" : "",
      (current || state.fixedStatus === "success") ? '<div class="table-wrap" style="margin-top:10px"><table class="data-table"><thead><tr><th>融资主体集合</th><th>合计融资余额</th><th>余额加权平均融资成本</th><th>范围说明</th></tr></thead><tbody>' + COMBINATIONS.map(function (item) {
        return '<tr><td><b>' + escapeHtml(item.units) + '</b></td><td>' + escapeHtml(item.balance) + '</td><td>' + escapeHtml(item.cost) + '</td><td>按主体身份去重后合并融资明细；板块仅作为集合筛选条件</td></tr>';
      }).join("") + "</tbody></table></div>" : "",
      "</div>"
    ].join("");
  }

  function renderHistoryStage() {
    var entry = publishedEntry();
    if (state.semanticVersion && !entry) return renderMissingPublishedVersionStage("记录与证据");
    var version = entry ? entry.semanticVersion : null;
    var actions = state.semanticVersion ? button("查看资源与模型", "go-catalog", { primary: true, small: true }) : button("进入统一校验", "go-release", { primary: true, small: true });
    var semanticTable = entry ? renderSemanticHistoryTable([entry]) : '<div class="empty-panel"><h2>尚无语义版本</h2><p>完成发布后形成不可原地修改的历史记录。</p></div>';
    var versionBindings = state.bindingHistory.filter(function (binding) { return binding.semanticVersion === version; });
    var versionEvents = state.events.filter(function (event) { return event.semanticVersion === version; });
    var bindingTable = versionBindings.length ? '<table class="data-table"><thead><tr><th>记录</th><th>动作</th><th>语义版本</th><th>数据版本</th><th>时间</th><th>状态</th></tr></thead><tbody>' + versionBindings.map(function (binding) {
      return '<tr><td class="mono">' + escapeHtml(binding.bindingId) + '</td><td>' + escapeHtml(binding.action) + '</td><td class="mono">' + escapeHtml(binding.semanticVersion) + '</td><td class="mono">' + escapeHtml(binding.dataVersion) + '</td><td>' + escapeHtml(binding.adoptedAt) + '</td><td>' + status(binding.bindingId === (state.currentBinding && state.currentBinding.bindingId) ? "当前" : "历史", binding.bindingId === (state.currentBinding && state.currentBinding.bindingId) ? "green" : "") + "</td></tr>";
    }).join("") + "</tbody></table>" : '<div class="empty-panel"><h2>尚无正式切换记录</h2><p>待更新数据通过检查并确认切换后形成记录。</p></div>';
    return stageShell("记录与证据", version + " · 只展示归属于这个精确语义版本的更新、验证、切换、失败与回退记录", actions, [
      '<div class="surface-grid">',
      '<section class="panel span-12"><div class="panel-body">' + publishedWorkspaceNav("history") + '</div></section>',
      '<section class="panel span-12"><div class="panel-head"><div class="panel-head-copy"><h3>版本上下文</h3><p>升级、弃用或替代后，旧正式结果仍按原精确版本定位</p></div></div><div class="panel-body flush">' + semanticTable + "</div></section>",
      '<section class="panel span-12"><div class="panel-head"><div class="panel-head-copy"><h3>正式数据切换与回退</h3><p>匹配检查、业务消费验证和用户确认分别留证</p></div></div><div class="panel-body flush">' + bindingTable + "</div></section>",
      '<section class="panel span-12"><div class="panel-head"><div class="panel-head-copy"><h3>事件证据</h3><p>失败原因、责任位置与恢复动作不会被重试覆盖</p></div></div><div class="panel-body"><div class="validation-list">' + (versionEvents.length ? versionEvents.slice(0, 20).map(function (event) {
        return '<div class="validation-row"><span class="validation-icon ' + (event.tone === "success" ? "pass" : event.tone === "error" ? "fail" : "") + '">' + (event.tone === "success" ? "✓" : event.tone === "error" ? "!" : "·") + '</span><div class="validation-copy"><b>' + escapeHtml(event.title) + '</b><small>' + escapeHtml(event.detail) + '</small></div><span class="mono muted">' + escapeHtml(event.id) + "</span></div>";
      }).join("") : '<div class="dock-empty" style="color:var(--ink-500)">尚无事件证据</div>') + "</div></div></section>",
      "</div>"
    ].join(""), false);
  }

  function renderVersionDetailStage() {
    var entry = publishedEntry();
    if (!entry && state.semanticHistory.length) return renderMissingPublishedVersionStage("版本概览");
    if (!entry) return stageShell("版本概览", "先发布语义版本", button("返回本体建模", "go-model", { primary: true, small: true }), '<div class="surface-grid">' + emptySurface("尚无 Published 版本", "统一校验通过并执行发布后生成版本详情。", "进入统一校验", "go-release") + "</div>", false);
    if (!entry.resourceSnapshotComplete) return renderIncompletePublishedSnapshotStage("版本概览", entry);
    var counts = entry.counts || { objects: 4, properties: 21, links: 3, metrics: 7, rules: 3, actions: 1, total: 39 };
    var resources = publishedResources(entry.semanticVersion);
    var tabs = [
      ["overview", "版本概览"], ["resources", "资源清单"], ["mapping", "数据映射合同"], ["logic", "业务逻辑"],
      ["validation", "校验证据"], ["lineage", "依赖沿袭"], ["consumption", "消费状态"], ["changes", "版本变更"]
    ];
    var tabBar = '<div class="detail-tabs">' + tabs.map(function (item) { return '<button type="button" class="detail-tab ' + (ui.versionTab === item[0] ? "active" : "") + '" data-action="version-tab:' + item[0] + '">' + escapeHtml(item[1]) + "</button>"; }).join("") + "</div>";
    var body = "";
    if (ui.versionTab === "resources") {
      body = '<section class="panel span-12"><div class="panel-head"><div class="panel-head-copy"><h3>版本资源清单</h3><p>每个资源都以稳定语义身份和本精确版本定位</p></div></div><div class="panel-body">' + renderCatalogList(resources, entry.semanticVersion) + "</div></section>";
    } else if (ui.versionTab === "mapping") {
      var publishedObjects = resources.filter(function (resource) { return resource.type === "Object Type"; });
      body = '<section class="panel span-12"><div class="panel-head"><div class="panel-head-copy"><h3>数据映射合同</h3><p>映射随本语义版本冻结；数据更新不按同名字段自动迁移</p></div></div><div class="panel-body"><div class="member-grid">' + publishedObjects.map(function (object) {
        var memberKey = (entry.objectMembers || {})[object.key];
        var member = entry.memberContracts && entry.memberContracts[memberKey];
        var objectProperties = resources.filter(function (resource) { return resource.type === "Property" && resource.parentKey === object.key; });
        var identityProperty = objectProperties.find(function (property) { return property.id === object.identityPropertyId; });
        var titleProperty = objectProperties.find(function (property) { return property.id === object.titlePropertyId; });
        return '<article class="member-card"><div class="member-card-head"><span class="resource-glyph object">O</span><div><h4>' + escapeHtml(object.name) + '</h4><p>' + escapeHtml(member ? member.name + " · " + member.grain : "发布快照中未记录来源成员") + '</p></div>' + status(member ? "已冻结" : "缺失", member ? "green" : "red") + '</div><div class="member-meta"><span>身份 ' + escapeHtml(identityProperty ? identityProperty.name : "快照缺失") + '</span><span>标题 ' + escapeHtml(titleProperty ? titleProperty.name : "快照缺失") + '</span><span>Property ' + objectProperties.length + '</span></div></article>';
      }).join("") + "</div></div></section>";
    } else if (ui.versionTab === "logic") {
      body = '<section class="panel span-12"><div class="panel-head"><div class="panel-head-copy"><h3>业务逻辑与行动</h3><p>Metric 计算事实，Rule 判断问题，Action Type 定义可请求行动</p></div></div><div class="panel-body"><div class="stat-grid"><div class="stat-item green"><span>Metric</span><strong>' + counts.metrics + '</strong><small>正式定义</small></div><div class="stat-item amber"><span>Rule</span><strong>' + counts.rules + '</strong><small>R01 · R02 · R03</small></div><div class="stat-item"><span>Action Type</span><strong>' + counts.actions + '</strong><small>需人工确认</small></div><div class="stat-item blue"><span>适用对象</span><strong style="font-size:13px">融资主体</strong><small>精确版本内引用</small></div></div></div></section>';
    } else if (ui.versionTab === "validation") {
      var validationEvidence = entry.validationEvidence || [];
      body = '<section class="panel span-12"><div class="panel-head"><div class="panel-head-copy"><h3>发布校验证据</h3><p>校验结果由实际发布前操作形成</p></div>' + status(validationEvidence.length ? "通过" : "证据缺失", validationEvidence.length ? "green" : "red") + '</div><div class="panel-body"><div class="validation-list">' + (validationEvidence.length ? validationEvidence.map(function (item) { return '<div class="validation-row"><span class="validation-icon pass">✓</span><div class="validation-copy"><b>' + escapeHtml(item.name) + '</b><small>' + escapeHtml(item.location) + '</small></div>' + status("通过", "green") + '</div>'; }).join("") : '<div class="notice error"><div class="notice-content"><b>无法定位发布校验证据</b><span>本版本不会使用当前 Draft 的校验结果进行补写。</span></div></div>') + "</div></div></section>";
    } else if (ui.versionTab === "lineage") {
      body = '<section class="panel span-12"><div class="panel-head"><div class="panel-head-copy"><h3>依赖沿袭</h3><p>数据链只读，不能在本体管理中修改数据工程管道</p></div></div><div class="panel-body"><div class="lineage-path"><span>融资工作簿</span><i>→</i><span>标准化处理</span><i>→</i><span>融资标准化数据资产</span><i>→</i><span>对象与字段映射</span><i>→</i><span>' + escapeHtml(entry.semanticVersion) + '</span></div><dl class="kv-list" style="margin-top:12px"><dt>数据资产版本</dt><dd class="mono">' + escapeHtml(entry.assetVersion || "发布时未绑定正式数据") + '</dd><dt>数据截至时间</dt><dd>' + escapeHtml(entry.assetAsOf || "等待正式数据绑定") + '</dd><dt>上游维护</dt><dd>数据工程只读引用</dd><dt>本体范围依据</dt><dd>获准资产、本体映射和场景清单</dd></dl></div></section>';
    } else if (ui.versionTab === "consumption") {
      body = '<section class="panel span-12"><div class="panel-head"><div class="panel-head-copy"><h3>数据与消费状态</h3><p>语义发布不会自动变为正式数据服务</p></div></div><div class="panel-body">' + renderVersionBindingSummary(entry.semanticVersion) + '<div class="stage-actions" style="margin-top:12px">' + button("查看数据与消费", "go-consumption", { primary: true, small: true }) + "</div></div></section>";
    } else if (ui.versionTab === "changes") {
      body = '<section class="panel span-12"><div class="panel-head"><div class="panel-head-copy"><h3>版本变更</h3><p>旧正式版本保持可追溯，不被新版本原地覆盖</p></div></div><div class="panel-body"><dl class="kv-list"><dt>变更摘要</dt><dd>' + escapeHtml(entry.changeSummary || "首次发布集团融资语义模型") + '</dd><dt>发布时间</dt><dd>' + escapeHtml(entry.publishedAt) + '</dd><dt>发布记录</dt><dd class="mono">' + escapeHtml(entry.publicationId) + '</dd><dt>替代关系</dt><dd>' + (state.semanticHistory.length > 1 ? "可从版本历史查看前后版本" : "首次发布，无被替代版本") + "</dd></dl></div></section>";
    } else {
      body = '<section class="panel span-12"><div class="panel-head"><div class="panel-head-copy"><h3>' + escapeHtml(entry.semanticVersion) + '</h3><p>Published 语义版本详情</p></div>' + semanticVersionStatus(entry.semanticVersion) + '</div><div class="panel-body"><div class="stat-grid"><div class="stat-item blue"><span>资源总数</span><strong>' + counts.total + '</strong><small>精确版本内冻结</small></div><div class="stat-item"><span>Object / Property</span><strong>' + counts.objects + ' / ' + counts.properties + '</strong><small>业务结构</small></div><div class="stat-item green"><span>Link / Metric / Rule</span><strong>' + counts.links + ' / ' + counts.metrics + ' / ' + counts.rules + '</strong><small>关系与逻辑</small></div><div class="stat-item amber"><span>Action Type</span><strong>' + counts.actions + '</strong><small>可请求行动</small></div></div><dl class="kv-list" style="margin-top:12px"><dt>本体</dt><dd>' + escapeHtml(entry.modelContract && entry.modelContract.name || "本体名称缺失") + '</dd><dt>适用场景</dt><dd>' + escapeHtml(entry.modelContract && entry.modelContract.scenario || "场景信息缺失") + '</dd><dt>发布时间</dt><dd>' + escapeHtml(entry.publishedAt) + '</dd><dt>当前状态</dt><dd>语义已发布；' + (bindingForVersion(entry.semanticVersion) ? isCurrentOfficialVersion(entry.semanticVersion) ? "正式数据服务中" : "历史正式记录" : "等待数据绑定") + '</dd><dt>Owner</dt><dd>本体管理</dd><dt>变更摘要</dt><dd>' + escapeHtml(entry.changeSummary || "首次发布集团融资语义模型") + "</dd></dl></div></section>";
    }
    return stageShell("版本详情", entry.semanticVersion + " · 精确版本上下文", button("返回资源与模型", "go-catalog", { small: true }), '<div class="surface-grid"><section class="panel span-12"><div class="panel-body">' + publishedWorkspaceNav("version-detail") + tabBar + "</div></section>" + body + "</div>", false);
  }

  function renderPublishedResourceDetailStage() {
    var version = state.selectedSemanticVersion || state.semanticVersion;
    var selectedEntry = publishedEntry(version);
    if (!selectedEntry) return renderMissingPublishedVersionStage("资源详情");
    if (!selectedEntry.resourceSnapshotComplete) return renderIncompletePublishedSnapshotStage("资源详情", selectedEntry);
    var resource = publishedResources(version).find(function (item) { return item.key === ui.selectedDetailResource; });
    if (!resource) return stageShell("资源详情", "资源不存在或不属于所选 Published 版本", button("返回资源与模型", "return-published-directory", { primary: true, small: true }), '<div class="surface-grid">' + emptySurface("无法定位正式资源", "请从精确 Published 版本的资源清单重新打开。", "返回资源与模型", "return-published-directory") + "</div>", false);
    var tabs = [["overview", "概览"], ["definition", "定义与结构"], ["mapping", "映射与依赖"], ["lineage", "沿袭与消费"], ["records", "版本记录"]];
    var tabBar = '<div class="detail-tabs">' + tabs.map(function (item) { return '<button type="button" class="detail-tab ' + (ui.detailTab === item[0] ? "active" : "") + '" data-action="detail-tab:' + item[0] + '">' + escapeHtml(item[1]) + "</button>"; }).join("") + "</div>";
    var owner = "本体管理";
    var resourceEntry = publishedEntry(version);
    var publishedObject = publishedObjectForResource(resource, version);
    var sourceMemberKey = publishedObject && resourceEntry && (resourceEntry.objectMembers || {})[publishedObject.key];
    var sourceMember = sourceMemberKey && resourceEntry.memberContracts && resourceEntry.memberContracts[sourceMemberKey];
    var common = '<dl class="kv-list"><dt>业务名称</dt><dd>' + escapeHtml(resource.name) + '</dd><dt>资源类型</dt><dd>' + escapeHtml(resource.type) + '</dd><dt>稳定语义身份</dt><dd class="mono">' + escapeHtml(resourceId(resource.key, version)) + '</dd><dt>精确 Published 版本</dt><dd class="mono">' + escapeHtml(version) + '</dd><dt>状态</dt><dd>Published</dd><dt>适用场景</dt><dd>S001 集团融资成本与债务结构优化</dd><dt>Owner</dt><dd>' + owner + "</dd></dl>";
    var body = "";
    if (ui.detailTab === "definition") body = '<section class="panel span-12"><div class="panel-head"><div class="panel-head-copy"><h3>定义与结构</h3><p>按资源类型展示正式合同</p></div></div><div class="panel-body">' + renderResourceModalDetails(resource, version) + "</div></section>";
    else if (ui.detailTab === "mapping") body = '<section class="panel span-12"><div class="panel-head"><div class="panel-head-copy"><h3>映射与依赖</h3><p>只读展示发布时冻结的数据映射和语义依赖</p></div></div><div class="panel-body"><dl class="kv-list"><dt>来源数据资产</dt><dd>融资标准化数据资产</dd><dt>来源成员</dt><dd>' + escapeHtml(sourceMember ? sourceMember.name + " · " + sourceMember.grain : publishedObject ? "发布快照中来源成员缺失" : "由依赖资源确定") + '</dd><dt>直接依赖</dt><dd class="mono">' + escapeHtml(stableDependencySummary(resource)) + '</dd><dt>迁移规则</dt><dd>字段缺失、类型变化或端点不兼容时阻断；不按同名自动迁移</dd></dl></div></section>';
    else if (ui.detailTab === "lineage") body = '<section class="panel span-12"><div class="panel-head"><div class="panel-head-copy"><h3>沿袭与消费</h3><p>稳定身份和精确版本用于下游只读定位</p></div></div><div class="panel-body"><div class="lineage-path"><span>数据资产成员</span><i>→</i><span>映射</span><i>→</i><span>' + escapeHtml(resource.name) + '</span><i>→</i><span>获准消费者</span></div><dl class="kv-list" style="margin-top:12px"><dt>智能问数</dt><dd>只读引用</dd><dt>决策中心</dt><dd>只读引用 Rule 与 Action Type</dd><dt>Agent 应用</dt><dd>只读引用获准语义资源</dd><dt>报告中心</dt><dd>按本版本长期追溯</dd><dt>当前数据状态</dt><dd>' + (bindingForVersion(version) ? isCurrentOfficialVersion(version) ? "正式数据服务中" : "历史正式记录" : "等待数据绑定") + "</dd></dl></div></section>";
    else if (ui.detailTab === "records") body = '<section class="panel span-12"><div class="panel-head"><div class="panel-head-copy"><h3>版本记录</h3><p>资源定义归属于精确 Published 版本</p></div></div><div class="panel-body"><dl class="kv-list"><dt>所选版本</dt><dd class="mono">' + escapeHtml(version) + '</dd><dt>发布时间</dt><dd>' + escapeHtml((publishedEntry(version) || {}).publishedAt || "—") + '</dd><dt>发布记录</dt><dd class="mono">' + escapeHtml((publishedEntry(version) || {}).publicationId || "—") + '</dd><dt>历史定位</dt><dd>旧正式报告和消费证据继续引用本版本，不回退到最新定义</dd></dl></div></section>';
    else body = '<section class="panel span-12"><div class="panel-head"><div class="panel-head-copy"><h3>' + escapeHtml(resource.name) + '</h3><p>' + escapeHtml(resource.definition || resource.condition || resource.result || resource.direction || "正式语义资源") + '</p></div>' + status("Published", "green") + '</div><div class="panel-body">' + common + "</div></section>";
    return stageShell("资源详情", resource.name + " · " + version, button("返回资源与模型", "go-catalog", { small: true }), '<div class="surface-grid"><section class="panel span-12"><div class="panel-body">' + tabBar + "</div></section>" + body + "</div>", false);
  }

  function renderOverlay() {
    if (ui.drawer === "publish") return renderPublishDrawer();
    if (ui.modal === "create") return renderCreateModal();
    if (ui.modal === "revision") return renderRevisionModal();
    if (ui.modal === "object-create") return renderObjectCreateModal();
    if (ui.modal === "logic-create") return renderLogicCreateModal();
    if (ui.modal === "member-select") return renderMemberSelectModal();
    if (ui.modal === "resource") return renderResourceModal();
    if (ui.modal === "event-evidence") return renderEventEvidenceModal();
    if (ui.modal === "unit") return renderUnitModal();
    if (ui.modal === "loans") return renderLoansModal();
    if (ui.modal === "loan") return renderLoanModal();
    if (ui.modal === "bank") return renderBankModal();
    if (ui.modal === "owner") return renderOwnerModal();
    if (ui.modal === "adopt") return renderAdoptModal();
    if (ui.modal === "rollback") return renderRollbackModal();
    if (ui.modal === "blank-draft") return renderBlankDraftModal();
    if (ui.modal === "reset") return renderResetModal();
    if (ui.modal === "help") return renderHelpModal();
    if (ui.modal === "s003") return renderS003Modal();
    return "";
  }

  function modalShell(title, subtitle, body, foot, wide) {
    return [
      '<div class="modal-layer" data-overlay="close">',
      '<section class="modal ' + (wide ? "wide" : "") + '">',
      '<div class="modal-head"><div class="modal-head-copy"><h2>' + escapeHtml(title) + '</h2><p>' + escapeHtml(subtitle || "") + '</p></div><button type="button" class="icon-btn" data-action="close-overlay" title="关闭">×</button></div>',
      '<div class="modal-body">' + body + "</div>",
      '<div class="modal-foot">' + (foot || button("关闭", "close-overlay", { primary: true })) + "</div>",
      "</section></div>"
    ].join("");
  }

  function renderCreateModal() {
    var body = [
      '<form id="create-model-form">',
      '<div class="form-grid">',
      '<div class="field full"><label for="model-name">本体名称</label><input id="model-name" name="name" required value="集团融资优化本体" /></div>',
      '<div class="field full"><label for="model-definition">业务定义</label><textarea id="model-definition" name="definition" required>围绕融资主体、融资明细、融资机构和融资负责人，统一融资成本、债务结构、问题判断与优化行动的业务语义。</textarea></div>',
      '<div class="field"><label>适用场景</label><input value="S001 集团融资成本与债务结构优化" readonly /></div>',
      '<div class="field"><label>工作方式</label><input value="单一账号配置与发布" readonly /></div>',
      '</div><div class="notice info" style="margin-top:12px"><div class="notice-content"><b>创建空白 Draft 工作区</b><span>本次操作不会自动创建 Object、Property、Link、Metric、Rule 或 Action Type，也不会进入正式资源目录。</span></div></div>',
      "</form>"
    ].join("");
    return modalShell("创建本体", "建立独立 Draft 工作区", body, button("取消", "close-overlay") + button("创建并进入工作台", "submit-create", { primary: true }), false);
  }

  function renderRevisionModal() {
    var entry = publishedEntry();
    var body = '<form id="create-revision-form"><div class="form-grid"><div class="field full"><label for="revision-base">基于 Published 版本</label><input id="revision-base" value="' + escapeHtml(entry ? entry.semanticVersion : state.semanticVersion) + '" readonly /></div><div class="field full"><label for="revision-summary">本次变更说明</label><textarea id="revision-summary" name="summary" required placeholder="说明本次语义定义、映射或消费合同的变更"></textarea><span class="field-hint">新 Draft 不会改变当前 Published 目录和正式数据服务。</span></div></div></form>';
    return modalShell("创建新 Draft", "从精确 Published 版本复制当前语义资源", body, button("取消", "close-overlay") + button("创建并进入工作台", "submit-revision", { primary: true }), false);
  }

  function renderObjectCreateModal() {
    var remaining = OBJECTS.filter(function (item) { return state.createdObjectKeys.indexOf(item.key) < 0; });
    var body = remaining.length ? '<div class="choice-list">' + remaining.map(function (object) {
      return '<article class="choice-row"><span class="resource-glyph object">O</span><div><b>' + escapeHtml(object.name) + '</b><small>' + escapeHtml(object.definition) + '</small><span class="mono">' + escapeHtml(object.id) + '</span></div>' + button("创建对象", "create-object:" + object.key, { primary: true, small: true }) + '</article>';
    }).join("") + '</div><div class="notice info" style="margin-top:12px"><div class="notice-content"><b>只创建业务骨架</b><span>对象创建后仍需在详情页选择来源成员、逐项创建 Property、保存字段映射并指定身份、标题和关系端点。</span></div></div>' : '<div class="empty-panel"><h2>四个业务对象均已创建</h2><p>继续在对象详情中完成属性、关系和数据映射。</p></div>';
    return modalShell("创建 Object Type", "从业务对象骨架开始", body, button("关闭", "close-overlay"), true);
  }

  function renderLogicCreateModal() {
    var linkRows = LINKS.map(function (item) { var created = state.createdLinkKeys.indexOf(item.key) >= 0; return '<article class="choice-row"><span class="resource-glyph link">L</span><div><b>' + escapeHtml(item.name) + '</b><small>' + escapeHtml(item.direction + " · " + item.cardinality) + '</small><span class="mono">' + escapeHtml(item.id) + '</span></div>' + (created ? status("已创建", "green") : button("创建", "create-link:" + item.key, { small: true })) + '</article>'; }).join("");
    var nextMetric = METRICS.find(function (item) { return state.createdMetricKeys.indexOf(item.key) < 0; });
    var nextRule = RULES.find(function (item) { return state.createdRuleKeys.indexOf(item.key) < 0; });
    var body = '<section class="panel"><div class="panel-head"><div class="panel-head-copy"><h3>Link Type</h3><p>关系只出现在一级语义画布；字段端点在对象内部配置</p></div></div><div class="panel-body"><div class="choice-list">' + linkRows + '</div></div></section><section class="panel" style="margin-top:10px"><div class="panel-head"><div class="panel-head-copy"><h3>Metric、Rule 与 Action Type</h3><p>定义按依赖顺序逐项创建</p></div></div><div class="panel-body"><div class="stage-actions">' + (nextMetric ? button("添加 Metric：" + nextMetric.name, "create-next-metric", { small: true }) : status("7 个 Metric 已创建", "green")) + (nextRule ? button("添加 Rule：" + nextRule.code, "create-next-rule", { small: true, disabled: state.createdMetricKeys.length < METRICS.length }) : status("3 个 Rule 已创建", "green")) + (!state.actionCreated ? button("创建 Action Type", "create-action", { small: true, disabled: state.createdRuleKeys.length < RULES.length }) : status("Action Type 已创建", "green")) + '</div></div></section>';
    return modalShell("添加关系与业务逻辑", "资源逐项进入当前 Draft", body, button("关闭", "close-overlay"), true);
  }

  function renderMemberSelectModal() {
    var object = objectByKey(ui.memberObject);
    if (!object) return "";
    var expected = MEMBER_BY_OBJECT[object.key];
    var body = '<div class="choice-list">' + MEMBERS.map(function (member) {
      var compatible = member.key === expected;
      return '<article class="choice-row ' + (compatible ? "" : "disabled") + '"><span class="resource-glyph data">D</span><div><b>' + escapeHtml(member.name) + '</b><small>' + escapeHtml(member.grain + " · " + member.rows + " 行") + '</small><span class="mono">' + escapeHtml(member.id) + '</span></div>' + button(compatible ? "选择成员" : "粒度不兼容", "confirm-object-member:" + object.key + ":" + member.key, { primary: compatible, small: true, disabled: !compatible }) + '</article>';
    }).join("") + '</div><div class="notice info" style="margin-top:12px"><div class="notice-content"><b>只选择已发布数据资产成员</b><span>本体管理只读取精确版本、成员范围和来源链，不编辑数据采集、处理或发布配置。</span></div></div>';
    return modalShell(object.name + " · 选择来源成员", "融资标准化数据资产", body, button("取消", "close-overlay"), true);
  }

  function renderResourceModal() {
    var resource = resourceByKey(state.selectedResource);
    var definition = resource.definition || resource.condition || resource.result || resource.direction || "";
    var isMember = resource.type === "数据资产成员";
    var resourceStatus = isMember ? (state.assetVersion ? "已锁定" : "待读取") : state.semanticVersion ? "Published" : "Draft";
    var resourceVersion = isMember ? (state.assetVersion || "尚未读取") : (state.semanticVersion || "尚未发布");
    var body = [
      '<div class="stat-grid"><div class="stat-item blue"><span>资源类型</span><strong style="font-size:13px">' + escapeHtml(resource.type) + '</strong><small>' + escapeHtml(isMember ? "只读数据输入" : "业务语义资源") + '</small></div><div class="stat-item"><span>资源状态</span><strong style="font-size:13px">' + escapeHtml(resourceStatus) + '</strong><small>配置与正式结果分开</small></div><div class="stat-item"><span>' + escapeHtml(isMember ? "精确数据版本" : "精确语义版本") + '</span><strong class="mono" style="font-size:10px">' + escapeHtml(resourceVersion) + '</strong><small>' + escapeHtml(isMember ? "由数据资产提供" : "不按同名自动迁移") + '</small></div><div class="stat-item green"><span>稳定资源身份</span><strong class="mono" style="font-size:10px">' + escapeHtml(resourceId(resource.key)) + '</strong><small>显示名称不是唯一身份</small></div></div>',
      '<section class="panel" style="margin-top:10px"><div class="panel-head"><div class="panel-head-copy"><h3>' + escapeHtml(resource.name) + '</h3><p>' + escapeHtml(definition) + '</p></div></div><div class="panel-body">' + renderResourceModalDetails(resource) + "</div></section>"
    ].join("");
    var foot = button("关闭", "close-overlay") +
      (resource.name === "融资主体" && unitCanPreview() ? button("查看单位553", "open-unit:553", { primary: true }) : "");
    return modalShell(resource.name, "资源集中详情", body, foot, true);
  }

  function renderResourceModalDetails(resource, version) {
    if (resource.type === "Object Type") {
      var versionResources = version ? publishedResources(version) : null;
      var objectProperties = versionResources ? versionResources.filter(function (item) { return item.type === "Property" && item.parentKey === resource.key; }) : resource.properties;
      var propertyRows = objectProperties.map(function (property) {
        return '<tr><td><button type="button" class="btn ghost small" data-action="open-resource-detail:' + escapeHtml(property.key) + '">' + escapeHtml(property.name) + '</button><span class="cell-sub mono">' + escapeHtml(property.id) + '</span></td><td>' + escapeHtml(property.role) + '</td><td>' + escapeHtml(property.type) + '</td><td>' + escapeHtml(property.nullable) + '</td><td>' + escapeHtml(property.source) + "</td></tr>";
      }).join("");
      var links = (versionResources || LINKS).filter(function (link) {
        return link.type === "Link Type" && (link.sourceObject === resource.name || link.targetObject === resource.name);
      });
      return '<dl class="kv-list"><dt>稳定身份 Property</dt><dd>' + escapeHtml(resource.identity) + ' <span class="mono">[' + escapeHtml(resource.identityPropertyId) + ']</span></dd><dt>可读标题 Property</dt><dd>' + escapeHtml(resource.title) + ' <span class="mono">[' + escapeHtml(resource.titlePropertyId) + ']</span></dd><dt>主要来源成员</dt><dd>' + escapeHtml(resource.source) + '</dd></dl><div class="table-wrap" style="margin-top:10px"><table class="data-table"><thead><tr><th>Property</th><th>角色</th><th>类型</th><th>允许为空</th><th>来源</th></tr></thead><tbody>' + propertyRows + '</tbody></table></div><div class="compact-list" style="margin-top:10px">' + links.map(function (link) {
        return '<div class="compact-item"><div class="compact-item-head"><b>' + escapeHtml(link.name) + '</b>' + status(link.cardinality, "blue") + '</div><small class="mono">' + escapeHtml(link.id) + '</small><small>' + escapeHtml(link.direction + " · 端点 " + link.endpoints + " · 关系事实 " + link.facts) + "</small></div>";
      }).join("") + "</div>";
    }
    if (resource.type === "Property") {
      return '<dl class="kv-list"><dt>稳定语义身份</dt><dd class="mono">' + escapeHtml(resource.id) + '</dd><dt>精确语义版本</dt><dd class="mono">' + escapeHtml(version || activePublishedVersion() || "尚未发布") + '</dd><dt>所属 Object Type</dt><dd>' + escapeHtml(resource.parentName + " [" + resource.parentId + "]") + '</dd><dt>业务定义</dt><dd>' + escapeHtml(resource.definition) + '</dd><dt>数据类型</dt><dd>' + escapeHtml(resource.dataType) + '</dd><dt>属性角色</dt><dd>' + escapeHtml(resource.role) + '</dd><dt>允许为空</dt><dd>' + escapeHtml(resource.nullable) + '</dd><dt>来源字段</dt><dd>' + escapeHtml(resource.source) + '</dd></dl>';
    }
    if (resource.type === "Link Type") {
      return '<dl class="kv-list"><dt>正向名称</dt><dd>' + escapeHtml(resource.name) + '</dd><dt>反向名称</dt><dd>' + escapeHtml(resource.reverse) + '</dd><dt>关系方向</dt><dd>' + escapeHtml(resource.direction) + '</dd><dt>起点 / 终点身份</dt><dd class="mono">' + escapeHtml(resource.sourceObjectId + " → " + resource.targetObjectId) + '</dd><dt>基数</dt><dd>' + escapeHtml(resource.cardinality) + '</dd><dt>稳定端点</dt><dd>' + escapeHtml(resource.endpoints) + '</dd><dt>端点引用</dt><dd class="mono">' + escapeHtml(resource.sourceEndpointKey + " ↔ " + resource.targetEndpointKey) + '</dd><dt>关系事实</dt><dd>' + escapeHtml(resource.facts) + "</dd></dl>";
    }
    if (resource.type === "Metric") {
      return '<dl class="kv-list"><dt>业务定义</dt><dd>' + escapeHtml(resource.definition) + '</dd><dt>单位</dt><dd>' + escapeHtml(resource.unit) + '</dd><dt>适用对象范围</dt><dd>' + escapeHtml(resource.scope) + '</dd><dt>适用对象身份</dt><dd class="mono">' + escapeHtml((resource.appliesToObjectIds || []).join("；")) + '</dd><dt>直接依赖</dt><dd class="mono">' + escapeHtml((resource.dependsOn || []).join("；")) + '</dd><dt>时间语义</dt><dd>使用当前获准数据版本的数据截至时间</dd><dt>零分母处理</dt><dd>' + escapeHtml(resource.zero) + '</dd><dt>术语</dt><dd>首选名称：' + escapeHtml(resource.name) + "；不推荐表达“平均利率”</dd></dl>";
    }
    if (resource.type === "Rule") {
      return '<dl class="kv-list"><dt>规则代码</dt><dd>' + escapeHtml(resource.code) + '</dd><dt>适用对象身份</dt><dd class="mono">' + escapeHtml((resource.appliesToObjectIds || []).join("；")) + '</dd><dt>判断条件</dt><dd>' + escapeHtml(resource.condition) + '</dd><dt>依赖 Metric</dt><dd>' + escapeHtml(resource.depends) + '</dd><dt>依赖身份</dt><dd class="mono">' + escapeHtml((resource.dependsOn || []).join("；")) + '</dd><dt>阈值</dt><dd>' + escapeHtml(resource.threshold) + '</dd><dt>证据要求</dt><dd>' + escapeHtml(resource.evidence) + "</dd></dl>";
    }
    if (resource.type === "Action Type") {
      return '<dl class="kv-list"><dt>目标对象</dt><dd>' + escapeHtml(resource.target) + '</dd><dt>目标对象身份</dt><dd class="mono">' + escapeHtml(resource.targetObjectId) + '</dd><dt>必要参数</dt><dd>' + escapeHtml(resource.inputs) + '</dd><dt>前置证据</dt><dd>' + escapeHtml(resource.precondition) + '</dd><dt>精确依赖</dt><dd class="mono">' + escapeHtml((resource.dependsOn || []).join("；")) + '</dd><dt>结果</dt><dd>' + escapeHtml(resource.result) + '</dd><dt>人工确认</dt><dd>' + escapeHtml(resource.confirmation) + '</dd><dt>禁止越界</dt><dd>' + escapeHtml(resource.prohibited) + "</dd></dl>";
    }
    return '<p>' + escapeHtml(resource.definition || "") + "</p>";
  }

  function renderUnitModal() {
    var unit = UNIT_DATA[ui.selectedUnit];
    if (!unit) return "";
    var bankCards = unit.banks.slice(0, 3).map(function (bank) {
      return '<article class="member-card"><div class="member-card-head"><span class="resource-glyph object">I</span><div><h4>' + escapeHtml(bank.name) + '</h4><p class="mono">' + escapeHtml(bank.id) + '</p></div>' + status(bank.problemRatio, "amber") + '</div><div class="member-meta bank-scope-meta"><span>Rule 问题融资 ' + formatProblemAmount(bank.problemAmount) + ' 亿元 / ' + bank.problemLoanCount + ' 笔</span><span>该单位在该机构全部融资 ' + formatProblemAmount(bank.unitBankAmount) + ' 亿元 / ' + bank.unitBankLoanCount + ' 笔</span><span>机构集团全量 ' + bank.institutionSubjectCount + ' 家主体 / ' + bank.institutionLoanCount + ' 笔</span></div><div style="margin-top:8px">' + button("查看详情", "open-bank:" + ui.selectedUnit + ":" + encodeURIComponent(bank.name), { small: true }) + "</div></article>";
    }).join("");
    var body = [
      '<div class="notice success"><div class="notice-content"><b>' + escapeHtml(unit.rule + " " + unit.ruleName) + '</b><span>该主体在当前规则下仅命中 ' + escapeHtml(unit.rule) + "；规则结果、机构归因与行动类型引用同一 Published 语义版本。</span></div></div>",
      '<div class="stat-grid" style="margin-top:10px"><div class="stat-item blue"><span>融资余额</span><strong>' + formatNumber(unit.balance) + '</strong><small>亿元 · ' + unit.loanCount + ' 笔借据</small></div><div class="stat-item green"><span>余额加权融资成本</span><strong>' + escapeHtml(unit.cost) + '</strong><small>按明细余额加权</small></div><div class="stat-item amber"><span>' + escapeHtml(unit.keyRatioName) + '</span><strong>' + escapeHtml(unit.keyRatio) + '</strong><small>问题集合 ' + escapeHtml(unit.problemBalance) + ' / ' + unit.problemCount + ' 笔</small></div><div class="stat-item"><span>融资负责人</span><strong style="font-size:13px">' + escapeHtml(unit.owner) + '</strong><small class="mono">' + escapeHtml(unit.ownerId) + "</small></div></div>",
      '<section class="panel" style="margin-top:10px"><div class="panel-head"><div class="panel-head-copy"><h3>对象身份与关系</h3><p>稳定身份与可读标题严格区分</p></div></div><div class="panel-body"><dl class="kv-list"><dt>融资主体稳定身份</dt><dd class="mono">' + escapeHtml(unit.identity) + '</dd><dt>身份来源</dt><dd>融资标准化数据资产；用于对象与关系稳定定位</dd><dt>可读标题</dt><dd>' + escapeHtml(unit.code) + '</dd><dt>所属板块</dt><dd>' + escapeHtml(unit.sector) + '</dd><dt>主体→明细</dt><dd>' + unit.loanCount + ' 条关系事实；当前提供已核验样例下钻</dd><dt>主体→负责人</dt><dd>' + escapeHtml(unit.ownerId + " → " + unit.owner) + '</dd><dt>其他判断</dt><dd>' + escapeHtml(unit.other) + "</dd></dl></div></section>",
      '<section class="panel" style="margin-top:10px"><div class="panel-head"><div class="panel-head-copy"><h3>优先协商银行</h3><p>只按该 Rule 的问题融资集合归集，不把单位全部余额当作问题余额</p></div></div><div class="panel-body"><div class="member-grid">' + bankCards + "</div></div></section>"
    ].join("");
    var foot = button("关闭", "close-overlay") + button("查看负责人", "open-owner:" + ui.selectedUnit, { small: true }) + button("查看融资明细", "open-loans:" + ui.selectedUnit, { primary: true });
    return modalShell(unit.code, unit.identity + " · " + unit.sector, body, foot, true);
  }

  function renderLoansModal() {
    var unit = UNIT_DATA[ui.selectedUnit];
    if (!unit) return "";
    var loans = generateLoans(ui.selectedUnit);
    var rows = loans.map(function (loan) {
      return '<tr><td><button type="button" class="btn ghost small mono" data-action="open-loan:' + ui.selectedUnit + ":" + encodeURIComponent(loan.id) + '">' + escapeHtml(loan.id) + '</button></td><td>' + escapeHtml(loan.bank) + '</td><td>' + formatProblemAmount(loan.amount) + ' 亿元</td><td>' + escapeHtml(loan.rate) + '</td><td>' + escapeHtml(loan.rateType) + '</td><td>' + escapeHtml(loan.term) + '</td><td>' + escapeHtml(loan.dueDate) + "</td></tr>";
    }).join("");
    var body = '<div class="notice info"><div class="notice-content"><b>' + unit.loanCount + ' 条主体—明细关系事实</b><span>当前显示 ' + loans.length + ' 笔已核验代表性明细；从 ' + escapeHtml(unit.identity) + " 沿 Published“主体拥有融资”关系下钻，每笔借据使用标准化资产稳定身份定位。</span></div></div><div class=\"table-wrap\" style=\"margin-top:10px;max-height:520px\"><table class=\"data-table\"><thead><tr><th>借据编号</th><th>融资机构</th><th>折合人民币余额</th><th>当前利率</th><th>利率形式</th><th>期限</th><th>到期日</th></tr></thead><tbody>" + rows + '</tbody></table><div class="table-foot-note">显示 ' + loans.length + ' 个代表性实例，该主体共 ' + unit.loanCount + ' 笔融资明细。</div></div>';
    return modalShell(unit.code + " · 融资明细", "点击借据编号查看详情", body, button("返回主体", "back-unit:" + ui.selectedUnit) + button("关闭", "close-overlay"), true);
  }

  function renderLoanModal() {
    var unit = UNIT_DATA[ui.selectedUnit];
    var loans = generateLoans(ui.selectedUnit);
    var loan = loans.find(function (item) { return item.id === ui.selectedLoan; });
    if (!unit || !loan) return "";
    var body = '<div class="stat-grid"><div class="stat-item blue"><span>折合人民币余额</span><strong>' + formatProblemAmount(loan.amount) + '</strong><small>亿元</small></div><div class="stat-item green"><span>当前利率</span><strong>' + escapeHtml(loan.rate) + '</strong><small>' + escapeHtml(loan.rateType) + '</small></div><div class="stat-item"><span>期限种类</span><strong style="font-size:13px">' + escapeHtml(loan.term) + '</strong><small>到期 ' + escapeHtml(loan.dueDate) + '</small></div><div class="stat-item"><span>币种</span><strong style="font-size:13px">' + escapeHtml(loan.currency) + '</strong><small>提款 ' + escapeHtml(loan.drawDate) + "</small></div></div>" +
      '<section class="panel" style="margin-top:10px"><div class="panel-head"><div class="panel-head-copy"><h3>对象与关系</h3><p>融资明细的身份和标题均使用借据编号</p></div></div><div class="panel-body"><dl class="kv-list"><dt>稳定实例身份</dt><dd class="mono">' + escapeHtml(loan.id) + '</dd><dt>身份来源</dt><dd>融资标准化数据资产</dd><dt>可读标题</dt><dd>' + escapeHtml(loan.id) + '</dd><dt>融资属于主体</dt><dd><button class="btn ghost small" data-action="back-unit:' + ui.selectedUnit + '">' + escapeHtml(unit.code + " [" + unit.identity + "]") + '</button></dd><dt>融资由机构提供</dt><dd>' + escapeHtml(loan.bank + " [" + loan.bankId + "]") + '</dd><dt>关系证据</dt><dd>Published Link：融资主体 → 融资明细；融资明细 → 融资机构</dd></dl></div></section>';
    return modalShell(loan.id, "融资明细", body, button("返回借据列表", "open-loans:" + ui.selectedUnit) + button("关闭", "close-overlay"), true);
  }

  function findBank(unitKey, name) {
    var unit = UNIT_DATA[unitKey];
    return unit ? unit.banks.find(function (bank) { return bank.name === name; }) : null;
  }

  function renderBankModal() {
    var unit = UNIT_DATA[ui.selectedUnit];
    var bank = findBank(ui.selectedUnit, ui.selectedBank);
    if (!unit || !bank) return "";
    var body = '<div class="notice info"><div class="notice-content"><b>机构归因证据</b><span>只使用 ' + escapeHtml(unit.rule) + " 的问题融资集合，按问题余额贡献降序排列。</span></div></div>" +
      '<div class="stat-grid" style="margin-top:10px"><div class="stat-item blue"><span>Rule 问题融资</span><strong>' + formatProblemAmount(bank.problemAmount) + '</strong><small>亿元 · ' + bank.problemLoanCount + ' 笔</small></div><div class="stat-item amber"><span>问题余额贡献</span><strong>' + escapeHtml(bank.problemRatio) + '</strong><small>单位问题融资集合内</small></div><div class="stat-item"><span>单位在该机构全部融资</span><strong>' + formatProblemAmount(bank.unitBankAmount) + '</strong><small>亿元 · ' + bank.unitBankLoanCount + ' 笔</small></div><div class="stat-item green"><span>机构集团全量</span><strong>' + bank.institutionLoanCount + '</strong><small>' + bank.institutionSubjectCount + ' 家主体关联借据</small></div></div>' +
      '<section class="panel" style="margin-top:10px"><div class="panel-head"><div class="panel-head-copy"><h3>融资机构对象</h3><p>问题证据、单位全量与机构集团全量分别展示</p></div></div><div class="panel-body"><dl class="kv-list"><dt>稳定实例身份</dt><dd class="mono">' + escapeHtml(bank.id) + '</dd><dt>身份来源</dt><dd>融资标准化数据资产</dd><dt>可读标题</dt><dd>' + escapeHtml(bank.name) + '</dd><dt>机构类别</dt><dd>商业银行</dd><dt>关系方向</dt><dd>融资明细 → 融资机构</dd><dt>Rule 证据范围</dt><dd>' + escapeHtml(unit.problemBalance + " / " + unit.problemCount + " 笔问题借据") + '</dd><dt>当前主体</dt><dd>' + escapeHtml(unit.code + " [" + unit.identity + "]") + "</dd></dl></div></section>";
    return modalShell(bank.name, bank.id, body, button("返回主体", "back-unit:" + ui.selectedUnit) + button("查看主体融资明细", "open-loans:" + ui.selectedUnit, { primary: true }), true);
  }

  function renderOwnerModal() {
    var sourceUnit = UNIT_DATA[ui.selectedUnit];
    if (!sourceUnit) return "";
    var ownerId = sourceUnit.ownerId;
    var owner = OWNER_DATA[ownerId];
    var ownerTitle = owner ? owner.title : sourceUnit.owner;
    var units = owner ? owner.featuredUnits : Object.keys(UNIT_DATA).filter(function (key) { return UNIT_DATA[key].ownerId === ownerId; });
    var unitCards = units.map(function (key) {
      var unit = UNIT_DATA[key];
      return '<article class="compact-item"><div class="compact-item-head"><b>' + escapeHtml(unit.code) + '</b>' + status(unit.rule, "blue") + '</div><small class="mono">' + escapeHtml(unit.identity) + '</small><div style="margin-top:7px">' + button("查看详情", "open-unit:" + key, { small: true }) + "</div></article>";
    }).join("");
    var body = '<section class="panel"><div class="panel-head"><div class="panel-head-copy"><h3>融资负责人对象</h3><p>负责人是业务责任实体，不等同于登录账号或权限角色</p></div></div><div class="panel-body"><dl class="kv-list"><dt>稳定实例身份</dt><dd class="mono">' + escapeHtml(ownerId) + '</dd><dt>身份来源</dt><dd>融资标准化数据资产</dd><dt>可读标题</dt><dd>' + escapeHtml(ownerTitle) + '</dd><dt>反向关系</dt><dd>负责人承接主体优化待办</dd><dt>关联主体总数</dt><dd>' + escapeHtml(owner ? owner.subjectCount : units.length) + '</dd><dt>重点预览</dt><dd>' + units.length + ' 个当前场景主体</dd></dl><div class="compact-list" style="margin-top:10px">' + unitCards + "</div></div></section>";
    return modalShell(ownerTitle, ownerId, body, button("返回主体", "back-unit:" + ui.selectedUnit) + button("关闭", "close-overlay"), false);
  }

  function renderPublishDrawer() {
    var items = getValidationItems();
    var counts = resourceCounts();
    var rows = items.map(function (item) {
      return '<div class="validation-row"><span class="validation-icon ' + (item.ok ? "pass" : "fail") + '">' + (item.ok ? "✓" : "!") + '</span><div class="validation-copy"><b>' + escapeHtml(item.name) + '</b><small>' + escapeHtml(item.location) + '</small></div>' + (item.ok ? status("通过", "green") : status("失败", "red")) + "</div>";
    }).join("");
    return '<div class="drawer-layer" data-overlay="close"><aside class="drawer"><div class="drawer-head"><div class="modal-head-copy"><h2>发布语义版本</h2><p>发布当前 Draft 中通过校验的全部语义资源</p></div><button type="button" class="icon-btn" data-action="close-overlay">×</button></div><div class="drawer-body"><div class="notice success"><div class="notice-content"><b>发布门禁已通过</b><span>版本号与发布证据只会在确认发布后生成。</span></div></div><section class="panel" style="margin-top:10px"><div class="panel-head"><div class="panel-head-copy"><h3>检查结果</h3><p>失败项为零</p></div></div><div class="panel-body"><div class="validation-list">' + rows + '</div></div></section><section class="panel" style="margin-top:10px"><div class="panel-head"><div class="panel-head-copy"><h3>发布范围</h3><p>当前 Draft 的精确资源快照</p></div></div><div class="panel-body"><dl class="kv-list"><dt>Object Type</dt><dd>' + counts.objects + '</dd><dt>Property</dt><dd>' + counts.properties + '</dd><dt>Link Type</dt><dd>' + counts.links + '</dd><dt>Metric / Rule / Action Type</dt><dd>' + counts.metrics + ' / ' + counts.rules + ' / ' + counts.actions + '</dd><dt>资源总计</dt><dd>' + counts.total + '</dd><dt>数据状态</dt><dd>发布后仍显示“等待数据绑定”，不会自动切换为正式数据</dd></dl></div></section></div><div class="drawer-foot">' + button("取消", "close-overlay") + button(state.publishStatus === "processing" ? "发布中" : "确认发布", "confirm-publish", { primary: true, disabled: state.publishStatus === "processing" }) + "</div></aside></div>";
  }

  function renderAdoptModal() {
    var sameSemanticCurrent = state.currentBinding && state.currentBinding.semanticVersion === state.semanticVersion;
    var currentCopy = !state.currentBinding ? "当前没有需要替换的数据版本" : sameSemanticCurrent ? "确认后保留为同一语义版本的上一可信数据" : "属于其他语义版本，仅保留历史记录，不作为本版本回退目标";
    var body = '<div class="notice success"><div class="notice-content"><b>待更新数据已通过全部检查</b><span>数据与本体匹配，已具备消费验证条件，8 / 8 业务问题通过，且能够证明同一精确语义版本和数据版本。</span></div></div><div class="binding-grid" style="margin-top:10px"><article class="binding-card candidate"><h4>Published 语义版本</h4><div class="binding-pair"><b class="mono">' + escapeHtml(state.semanticVersion) + '</b></div></article><article class="binding-card candidate"><h4>待更新数据版本</h4><div class="binding-pair"><b class="mono">' + escapeHtml(state.candidateVersion) + '</b></div><p>数据截至 ' + escapeHtml(state.candidateAsOf) + '</p></article><article class="binding-card previous"><h4>当前正式数据</h4><div class="binding-pair"><b class="mono">' + escapeHtml(state.currentBinding ? state.currentBinding.dataVersion : "首次切换") + '</b></div><p>' + escapeHtml(currentCopy) + "</p></article></div>";
    return modalShell("切换为正式数据", "确认后下游统一读取这一精确语义版本和数据版本", body, button("取消", "close-overlay") + button(state.bindingStatus === "processing" ? "切换中" : "确认切换", "confirm-adopt", { primary: true, disabled: state.bindingStatus === "processing" }), true);
  }

  function renderRollbackModal() {
    var previous = previousBindingForCurrent();
    var body = previous ? '<div class="notice error"><div class="notice-content"><b>当前正式数据的新请求已阻断</b><span>回退不会删除受阻断数据或原切换证据；旧记录继续保留。</span></div></div><div class="binding-grid" style="margin-top:10px"><article class="binding-card blocked"><h4>受阻断当前数据</h4><div class="binding-pair"><b class="mono">' + escapeHtml(state.currentBinding.semanticVersion) + '</b><b class="mono">' + escapeHtml(state.currentBinding.dataVersion) + '</b></div></article><article class="binding-card previous"><h4>上一可信数据</h4><div class="binding-pair"><b class="mono">' + escapeHtml(previous.semanticVersion) + '</b><b class="mono">' + escapeHtml(previous.dataVersion) + '</b></div><p>证据完整且与当前 Published 语义兼容</p></article></div>' : "";
    return modalShell("回退上一可信数据", "需由本体管理账号确认", body, button("取消", "close-overlay") + button("确认回退", "confirm-rollback", { primary: true }), true);
  }

  function renderResetModal() {
    var body = '<div class="notice error"><div class="notice-content"><b>将清除当前工作区产生的全部浏览器状态</b><span>包括后续修改、Published 版本、待更新数据、正式切换记录、证据、布局和实例下钻上下文。重置后恢复完整的 S001 Draft，尚未统一校验，也不会出现在已发布本体中。</span></div></div><dl class="kv-list" style="margin-top:12px"><dt>业务骨架</dt><dd>4 个 Object Type · 21 个 Property · 3 个 Link Type</dd><dt>业务逻辑</dt><dd>7 个 Metric · 3 个 Rule · 1 个 Action Type</dd><dt>数据合同</dt><dd>四成员 · 三关系</dd></dl>';
    return modalShell("重置状态", "恢复集团融资优化本体的 Draft 基线", body, button("取消", "close-overlay") + button("确认重置", "confirm-reset", { danger: true }), false);
  }

  function renderBlankDraftModal() {
    var body = '<div class="notice error"><div class="notice-content"><b>当前 Draft 中的语义资源将被清空</b><span>融资对象、属性、关系、指标、规则、行动类型和数据映射都将移除，随后进入创建本体表单。当前尚无 Published 版本，不影响正式目录。</span></div></div>';
    return modalShell("新建空白 Draft", "从本体定义开始逐项建模", body, button("取消", "close-overlay") + button("继续", "confirm-blank-draft", { danger: true }), false);
  }

  function renderHelpModal() {
    var body = '<dl class="kv-list"><dt>Draft</dt><dd>可以配置和预览，不进入正式目录。</dd><dt>Published</dt><dd>语义定义已经形成精确版本，不表示数据已经正式使用。</dd><dt>待更新数据</dt><dd>数据工程提交的新数据版本，必须经过匹配检查和业务消费验证。</dd><dt>当前正式使用版本</dt><dd>下游统一读取的精确语义版本和数据版本。</dd><dt>上一可信数据</dt><dd>仅保留当前正式语义版本内被替换的可信数据，可用于受控回退。</dd></dl>';
    return modalShell("状态说明", "本体管理中的关键业务状态", body, button("关闭", "close-overlay", { primary: true }), false);
  }

  function renderEventEvidenceModal() {
    var event = state.events.find(function (item) { return item.id === ui.selectedEventId; });
    if (!event) return "";
    var technicalKind = ["C028", "C029", "T018", "T019"].indexOf(event.kind) >= 0 ? event.kind : "不适用";
    var body = '<dl class="kv-list"><dt>业务操作</dt><dd>' + escapeHtml(event.title) + '</dd><dt>结果</dt><dd>' + escapeHtml(event.detail) + '</dd><dt>发生时间</dt><dd>' + escapeHtml(event.time) + '</dd><dt>结果状态</dt><dd>' + escapeHtml(event.tone === "success" ? "成功" : event.tone === "error" ? "失败" : "处理中") + '</dd><dt>追溯标识</dt><dd class="mono">' + escapeHtml(event.id) + '</dd><dt>合同标识</dt><dd class="mono">' + escapeHtml(technicalKind) + '</dd><dt>语义版本</dt><dd class="mono">' + escapeHtml(event.semanticVersion || "当前 Draft") + "</dd></dl>";
    return modalShell("操作证据", "仅用于精确追溯", body, button("关闭", "close-overlay", { primary: true }), false);
  }

  function renderS003Modal() {
    var body = '<div class="notice error"><div class="notice-content"><b>当前数据资产不可消费</b><span>债务风险监测的当前兼容性数据版本不得进入本体，也不得作为其他管道输入。</span></div></div><section class="panel" style="margin-top:10px"><div class="panel-head"><div class="panel-head-copy"><h3>扩展边界</h3><p>场景本身没有永久禁用</p></div></div><div class="panel-body"><dl class="kv-list"><dt>当前允许</dt><dd>只读查看场景边界与阻断原因</dd><dt>当前禁止</dt><dd>创建 Object、Metric、Rule、Action Type，发起数据更新或切换为正式数据</dd><dt>后续进入条件</dt><dd>使用新的正式管道和新的可消费数据资产版本，再按相同发布与消费门禁建设</dd></dl></div></section>';
    return modalShell("债务风险监测", "当前不创建本体资源", body, button("关闭", "close-overlay", { primary: true }), false);
  }

  function closeOverlay() {
    ui.modal = null;
    ui.drawer = null;
    ui.selectedLoan = null;
    ui.selectedBank = null;
    ui.selectedOwner = null;
    render();
  }

  function selectResource(key) {
    if (key === "metric_group") key = "metric_weighted_cost";
    if (key === "rule_group") key = "rule_r01";
    state.selectedResource = key;
    if (["catalog", "version-detail", "resource-detail"].indexOf(route()) >= 0 && publishedResources(activePublishedVersion()).some(function (item) { return item.key === key; })) {
      ui.selectedDetailResource = key;
      ui.detailTab = "overview";
      saveState();
      navigate("resource-detail");
      return;
    }
    saveState();
    render();
  }

  function startC029(isRetry) {
    if (!state.candidateVersion || state.c028Status !== "accepted") {
      toast("请先接收待更新数据", "error");
      return;
    }
    if (isRetry && !state.candidateMappingFixed) {
      toast("请先修正待更新数据的机构端点映射", "error");
      navigate("mapping");
      return;
    }
    var resultId = nextId(isRetry ? "C029-RETRY" : "C029");
    var candidateContract = financingDataVersionForCycle(state.candidateCycle);
    var shouldFail = candidateContract.requiresRemapping && !state.candidateMappingFixed;
    completeAsync(
      { c029Status: "processing", c029Id: resultId, t018Status: "none", fixedStatus: "none" },
      1050,
      { c029Status: shouldFail ? "failed" : "success", t018Status: shouldFail ? "not_qualified" : "qualified" },
      {
        id: resultId,
        kind: "C029",
        title: shouldFail ? "数据与本体匹配检查失败" : isRetry ? "数据与本体重新检查通过" : "数据与本体匹配检查通过",
        detail: shouldFail ? "3 条融资明细的机构端点不兼容；当前正式使用版本未切换" : "对象、关系与兼容性检查完成；当前正式使用版本保持不变",
        tone: shouldFail ? "error" : "success"
      },
      function () {
        if (!shouldFail) {
          addEvent("T018", "已具备消费验证条件", state.candidateVersion + " 的版本、匹配与证据条件完整；尚未切换为正式数据", "success", nextId("T018"));
          render();
        } else {
          toast("匹配检查失败，继续使用当前正式版本", "error");
        }
      }
    );
  }

  function handleAction(action) {
    if (!action) return;
    if (action.indexOf("open-event-evidence:") === 0) {
      ui.selectedEventId = decodeURIComponent(action.slice("open-event-evidence:".length));
      ui.modal = "event-evidence";
      render();
      return;
    }
    if (action.indexOf("canvas-view:") === 0) {
      ui.canvasView = action.slice("canvas-view:".length);
      render();
      return;
    }
    if (action.indexOf("repair-resource:") === 0) {
      var repairParts = action.split(":");
      state.selectedResource = repairParts[1];
      ui.inspectorTab = repairParts[2] || "overview";
      ui.canvasView = "semantic";
      saveState();
      navigate("model");
      return;
    }
    if (action.indexOf("repair-mapping:") === 0) {
      var mappingRepairParts = action.split(":");
      state.selectedResource = mappingRepairParts[1];
      state.mappingFocus = mappingRepairParts.slice(2).join(":");
      saveState();
      navigate("mapping");
      return;
    }
    if (action.indexOf("toggle-tree:") === 0) {
      var treeKey = action.slice("toggle-tree:".length);
      ui.collapsed[treeKey] = !ui.collapsed[treeKey];
      render();
      return;
    }
    if (action.indexOf("select-resource:") === 0) {
      selectResource(action.slice("select-resource:".length));
      return;
    }
    if (action.indexOf("inspector-tab:") === 0) {
      ui.inspectorTab = action.slice("inspector-tab:".length);
      render();
      return;
    }
    if (action.indexOf("detail-tab:") === 0) {
      ui.detailTab = action.slice("detail-tab:".length);
      render();
      return;
    }
    if (action.indexOf("version-tab:") === 0) {
      ui.versionTab = action.slice("version-tab:".length);
      render();
      return;
    }
    if (action.indexOf("published-tab:") === 0) {
      var publishedTarget = action.slice("published-tab:".length);
      if (publishedTarget === "consumption-update") {
        ui.publishedSection = "update";
        navigate("consumption");
      } else {
        ui.publishedSection = "consumption";
        navigate(publishedTarget);
      }
      return;
    }
    if (action.indexOf("open-version-detail:") === 0) {
      state.selectedSemanticVersion = action.slice("open-version-detail:".length);
      ui.versionTab = "overview";
      saveState();
      navigate("version-detail");
      return;
    }
    if (action.indexOf("create-object:") === 0) {
      var objectKey = action.slice("create-object:".length);
      var object = objectByKey(objectKey);
      if (!object || state.createdObjectKeys.indexOf(objectKey) >= 0) return;
      state.createdObjectKeys.push(objectKey);
      state.resourceIds[objectKey] = object.id;
      state.selectedResource = objectKey;
      state.validationStatus = "idle";
      addEvent("Draft", "创建业务对象", object.name + " 已进入当前 Draft；属性和映射仍待配置", "success", nextId("OBJECT"));
      ui.modal = null;
      ui.inspectorTab = "overview";
      saveState();
      render();
      toast(object.name + " 已创建", "success");
      return;
    }
    if (action.indexOf("create-property:") === 0) {
      var propertyKey = action.slice("create-property:".length);
      var property = PROPERTY_RESOURCES.find(function (item) { return item.key === propertyKey; });
      if (!property || state.createdPropertyKeys.indexOf(propertyKey) >= 0) return;
      if (!state.objectMembers[property.parentKey]) {
        toast("请先为所属对象选择数据资产成员", "error");
        return;
      }
      state.createdPropertyKeys.push(propertyKey);
      state.resourceIds[propertyKey] = property.id;
      state.selectedResource = property.parentKey;
      state.mappingFocus = propertyKey;
      state.validationStatus = "idle";
      addEvent("Draft", "从数据字段创建 Property", property.name + " 已创建；等待用户保存字段映射", "success", nextId("PROPERTY"));
      saveState();
      navigate("mapping");
      render();
      toast("Property 已创建，请确认映射和角色", "success");
      return;
    }
    if (action.indexOf("create-link:") === 0) {
      var linkKey = action.slice("create-link:".length);
      var link = LINKS.find(function (item) { return item.key === linkKey; });
      if (!link || state.createdLinkKeys.indexOf(linkKey) >= 0) return;
      state.createdLinkKeys.push(linkKey);
      state.resourceIds[linkKey] = link.id;
      state.selectedResource = linkKey;
      state.validationStatus = "idle";
      addEvent("Draft", "创建 Link Type", link.name + " 已创建；关系端点需在对象字段映射中确认", "success", nextId("LINK"));
      ui.modal = null;
      ui.inspectorTab = "relations";
      saveState();
      render();
      toast(link.name + " 已创建", "success");
      return;
    }
    if (action.indexOf("select-object-member:") === 0) {
      ui.memberObject = action.slice("select-object-member:".length);
      ui.modal = "member-select";
      render();
      return;
    }
    if (action.indexOf("confirm-object-member:") === 0) {
      var memberParts = action.split(":");
      var memberObjectKey = memberParts[1];
      var memberKey = memberParts[2];
      if (MEMBER_BY_OBJECT[memberObjectKey] !== memberKey) {
        toast("成员粒度与对象不兼容", "error");
        return;
      }
      if (!state.assetVersion) {
        state.assetVersion = FINANCING_DATA_VERSIONS[0].id;
        state.assetAsOf = FINANCING_DATA_VERSIONS[0].asOf;
        state.assetReadAt = nowText();
        addEvent("数据资产", "选择已发布数据资产版本", state.assetVersion + "；四成员＋三关系；完整来源链已定位", "success", nextId("ASSET"));
      }
      state.objectMembers[memberObjectKey] = memberKey;
      state.mappingPreview = "idle";
      state.validationStatus = "idle";
      var selectedMember = MEMBERS.find(function (item) { return item.key === memberKey; });
      addEvent("映射", "选择对象来源成员", objectByKey(memberObjectKey).name + " → " + selectedMember.name, "success", nextId("MEMBER"));
      ui.modal = null;
      ui.inspectorTab = "properties";
      state.selectedResource = memberObjectKey;
      saveState();
      render();
      toast("来源成员已选择", "success");
      return;
    }
    if (action.indexOf("open-object-mapping:") === 0) {
      var mappingObjectKey = action.slice("open-object-mapping:".length);
      state.selectedResource = mappingObjectKey;
      var firstCreated = objectByKey(mappingObjectKey).properties.find(function (item) { return state.createdPropertyKeys.indexOf(item.key) >= 0; });
      state.mappingFocus = firstCreated ? firstCreated.key : sourceFieldsForObject(mappingObjectKey)[0].key;
      saveState();
      navigate("mapping");
      return;
    }
    if (action.indexOf("open-property-mapping:") === 0 || action.indexOf("focus-property:") === 0) {
      var focusPropertyKey = action.slice(action.indexOf("open-property-mapping:") === 0 ? "open-property-mapping:".length : "focus-property:".length);
      var focusProperty = PROPERTY_RESOURCES.find(function (item) { return item.key === focusPropertyKey; });
      if (!focusProperty) return;
      state.selectedResource = focusProperty.parentKey;
      state.mappingFocus = focusPropertyKey;
      saveState();
      navigate("mapping");
      render();
      return;
    }
    if (action.indexOf("focus-field:") === 0) {
      state.mappingFocus = action.slice("focus-field:".length);
      saveState();
      render();
      return;
    }
    if (action.indexOf("save-field-mapping:") === 0) {
      var mappedKey = action.slice("save-field-mapping:".length);
      if (state.createdPropertyKeys.indexOf(mappedKey) < 0) return;
      if (state.mappedPropertyKeys.indexOf(mappedKey) < 0) state.mappedPropertyKeys.push(mappedKey);
      state.mappingPreview = "idle";
      state.validationStatus = "idle";
      addEvent("映射", "保存字段映射", resourceByKey(mappedKey).parentName + "." + resourceByKey(mappedKey).name + " 已连接来源字段", "success", nextId("MAP"));
      saveState();
      render();
      toast("字段映射已保存", "success");
      return;
    }
    if (action.indexOf("set-property-role:") === 0) {
      var roleParts = action.split(":");
      var roleProperty = PROPERTY_RESOURCES.find(function (item) { return item.key === roleParts[1]; });
      if (!roleProperty) return;
      if (state.mappedPropertyKeys.indexOf(roleProperty.key) < 0) {
        toast("请先保存该字段的语义映射", "error");
        return;
      }
      if (roleParts[2] === "identity" && roleProperty.key !== expectedIdentityKey(roleProperty.parentKey)) {
        toast("该字段不符合当前对象的稳定身份合同", "error");
        return;
      }
      if (roleParts[2] === "title" && roleProperty.key !== expectedTitleKey(roleProperty.parentKey)) {
        toast("该字段不符合当前对象的可读标题合同", "error");
        return;
      }
      if (roleParts[2] === "identity") state.identityAssignments[roleProperty.parentKey] = roleProperty.key;
      if (roleParts[2] === "title") state.titleAssignments[roleProperty.parentKey] = roleProperty.key;
      state.validationStatus = "idle";
      addEvent("映射", roleParts[2] === "identity" ? "指定对象身份" : "指定对象标题", roleProperty.parentName + " → " + roleProperty.name, "success", nextId("ROLE"));
      saveState();
      render();
      toast(roleParts[2] === "identity" ? "已设为稳定身份" : "已设为可读标题", "success");
      return;
    }
    if (action.indexOf("set-endpoint:") === 0) {
      var endpointKey = action.slice("set-endpoint:".length);
      if (!isEndpointFieldKey(endpointKey)) {
        toast("该字段不属于任何已定义 Link 的端点", "error");
        return;
      }
      if (PROPERTY_RESOURCES.some(function (item) { return item.key === endpointKey; }) && state.mappedPropertyKeys.indexOf(endpointKey) < 0) {
        toast("请先保存该 Property 的字段映射", "error");
        return;
      }
      if (state.endpointFieldKeys.indexOf(endpointKey) < 0) state.endpointFieldKeys.push(endpointKey);
      state.mappingPreview = "idle";
      state.validationStatus = "idle";
      addEvent("映射", "指定 Link 端点字段", endpointKey + " 已加入关系端点合同", "success", nextId("ENDPOINT"));
      saveState();
      render();
      toast("Link 端点已指定", "success");
      return;
    }
    if (action.indexOf("dock-tab:") === 0) {
      ui.dockTab = action.slice("dock-tab:".length);
      render();
      return;
    }
    if (action.indexOf("consumer:") === 0) {
      ui.consumer = action.slice("consumer:".length);
      navigate("consumption");
      render();
      return;
    }
    if (action.indexOf("open-resource-detail:") === 0) {
      var detailKey = action.slice("open-resource-detail:".length);
      state.selectedResource = detailKey;
      ui.selectedDetailResource = detailKey;
      state.selectedSemanticVersion = state.selectedSemanticVersion || state.semanticVersion;
      ui.detailTab = "overview";
      saveState();
      navigate("resource-detail");
      return;
    }
    if (action.indexOf("open-unit:") === 0) {
      if (!unitCanPreview()) {
        toast("完成对象与关系预览后才能打开实例", "error");
        navigate("mapping");
        return;
      }
      ui.selectedUnit = action.slice("open-unit:".length);
      ui.modal = "unit";
      render();
      return;
    }
    if (action.indexOf("open-loans:") === 0) {
      ui.selectedUnit = action.slice("open-loans:".length);
      ui.modal = "loans";
      render();
      return;
    }
    if (action.indexOf("open-loan:") === 0) {
      var loanParts = action.split(":");
      ui.selectedUnit = loanParts[1];
      ui.selectedLoan = decodeURIComponent(loanParts.slice(2).join(":"));
      ui.modal = "loan";
      render();
      return;
    }
    if (action.indexOf("open-bank:") === 0) {
      var bankParts = action.split(":");
      ui.selectedUnit = bankParts[1];
      ui.selectedBank = decodeURIComponent(bankParts.slice(2).join(":"));
      ui.modal = "bank";
      render();
      return;
    }
    if (action.indexOf("open-owner:") === 0) {
      ui.selectedUnit = action.slice("open-owner:".length);
      ui.modal = "owner";
      render();
      return;
    }
    if (action.indexOf("back-unit:") === 0) {
      ui.selectedUnit = action.slice("back-unit:".length);
      ui.modal = "unit";
      render();
      return;
    }
    if (action.indexOf("select-context:") === 0) {
      var context = action.slice("select-context:".length);
      if (context === "current" && state.currentBinding) state.selectedSemanticVersion = state.currentBinding.semanticVersion;
      if (context === "candidate") state.selectedSemanticVersion = state.semanticVersion;
      var compatiblePrevious = previousBindingForCurrent();
      if (context === "previous" && compatiblePrevious) state.selectedSemanticVersion = compatiblePrevious.semanticVersion;
      saveState();
      toast(context === "current" ? "已定位当前正式使用版本" : context === "candidate" ? "已定位待更新数据" : "已定位上一可信数据");
      navigate("consumption");
      return;
    }
    if (action.indexOf("select-semantic:") === 0) {
      state.selectedSemanticVersion = action.slice("select-semantic:".length);
      ui.versionTab = "overview";
      saveState();
      navigate("version-detail");
      return;
    }
    if (action.indexOf("select-binding:") === 0) {
      var selectedBindingId = action.slice("select-binding:".length);
      var selectedBinding = state.bindingHistory.find(function (binding) { return binding.bindingId === selectedBindingId; });
      if (!selectedBinding) {
        toast("无法定位该正式数据切换记录", "error");
        return;
      }
      state.selectedSemanticVersion = selectedBinding.semanticVersion;
      saveState();
      toast("已定位正式数据切换记录 " + selectedBindingId);
      navigate("history");
      return;
    }
    var actions = {
      "open-create": function () {
        ui.modal = "create";
        render();
      },
      "open-revision": function () {
        if (state.candidateVersion) {
          toast("请先完成或退出当前数据更新流程", "error");
          return;
        }
        ui.modal = "revision";
        render();
      },
      "open-object-create": function () {
        ui.modal = "object-create";
        render();
      },
      "open-logic-create": function () {
        ui.modal = "logic-create";
        render();
      },
      "open-help": function () {
        ui.modal = "help";
        render();
      },
      "open-reset": function () {
        ui.modal = "reset";
        render();
      },
      "open-blank-draft": function () {
        if (state.semanticVersion) return;
        ui.modal = "blank-draft";
        render();
      },
      "show-s003-boundary": function () {
        ui.modal = "s003";
        render();
      },
      "close-overlay": closeOverlay,
      "submit-create": function () {
        var form = document.getElementById("create-model-form");
        if (form) form.requestSubmit();
      },
      "submit-revision": function () {
        var form = document.getElementById("create-revision-form");
        if (form) form.requestSubmit();
      },
      "save-draft": function () {
        if (!state.model) return;
        state.draftSavedAt = nowText();
        addEvent("Draft", "保存 Draft", "Draft 已保存；Published 目录和当前正式使用版本未变化", "success", nextId("DRAFT"));
        render();
        toast("Draft 已保存", "success");
      },
      "go-model": function () { closeOverlay(); navigate("model"); },
      "go-mapping": function () {
        closeOverlay();
        if (state.c029Status === "failed" && !state.candidateMappingFixed) {
          state.selectedResource = "institution";
          state.mappingFocus = "PROP-FINANCIAL-INSTITUTION-CODE";
          saveState();
        }
        navigate("mapping");
      },
      "go-release": function () { closeOverlay(); navigate("release"); },
      "go-catalog": function () { closeOverlay(); navigate("catalog"); },
      "go-consumption": function () { closeOverlay(); navigate("consumption"); },
      "go-history": function () { closeOverlay(); navigate("history"); },
      "return-published-directory": function () {
        state.selectedSemanticVersion = state.semanticHistory.some(function (entry) { return entry.semanticVersion === state.semanticVersion; }) ? state.semanticVersion : state.semanticHistory[0] && state.semanticHistory[0].semanticVersion || null;
        ui.catalogView = "cards";
        saveState();
        navigate("catalog");
      },
      "select-current-published": function () {
        state.selectedSemanticVersion = state.semanticVersion;
        saveState();
        render();
      },
      "back-object": function () {
        var object = currentObject();
        if (object) state.selectedResource = object.key;
        ui.inspectorTab = "mapping";
        saveState();
        navigate("model");
      },
      "create-next-metric": function () {
        var metric = METRICS.find(function (item) { return state.createdMetricKeys.indexOf(item.key) < 0; });
        if (!metric) return;
        state.createdMetricKeys.push(metric.key);
        state.resourceIds[metric.key] = metric.id;
        state.selectedResource = metric.key;
        state.validationStatus = "idle";
        addEvent("Draft", "创建 Metric", metric.name + " 已进入当前 Draft", "success", nextId("METRIC"));
        saveState();
        render();
        toast(metric.name + " 已创建", "success");
      },
      "create-next-rule": function () {
        if (state.createdMetricKeys.length < METRICS.length) return toast("请先完成 7 个 Metric", "error");
        var rule = RULES.find(function (item) { return state.createdRuleKeys.indexOf(item.key) < 0; });
        if (!rule) return;
        state.createdRuleKeys.push(rule.key);
        state.resourceIds[rule.key] = rule.id;
        state.selectedResource = rule.key;
        state.validationStatus = "idle";
        addEvent("Draft", "创建 Rule", rule.code + " " + rule.name + " 已进入当前 Draft", "success", nextId("RULE"));
        saveState();
        render();
        toast(rule.code + " 已创建", "success");
      },
      "create-action": function () {
        if (state.createdRuleKeys.length < RULES.length) return toast("请先完成 3 个 Rule", "error");
        if (state.actionCreated) return;
        state.actionCreated = true;
        state.resourceIds[ACTION_TYPE.key] = ACTION_TYPE.id;
        state.selectedResource = ACTION_TYPE.key;
        state.validationStatus = "idle";
        addEvent("Draft", "创建 Action Type", ACTION_TYPE.name + " 已进入当前 Draft；运行记录仍由决策中心拥有", "success", nextId("ACTION"));
        saveState();
        render();
        toast("Action Type 已创建", "success");
      },
      "run-mapping-preview": function () {
        if (!state.assetVersion) {
          toast("请先为对象选择已发布数据资产成员", "error");
          return;
        }
        var pass = allObjectMappingsReady() && requiredEndpointFieldsReady() && state.createdLinkKeys.length === LINKS.length;
        completeAsync(
          { mappingPreview: "processing" },
          900,
          { mappingPreview: pass ? "success" : "failed", mappingPreviewAt: nowText() },
          {
            id: nextId("PREVIEW"),
            kind: "映射",
            title: pass ? "对象与关系预览通过" : "对象与关系预览失败",
            detail: pass ? "574 个主体、5,218 条明细、24 个机构、24 个负责人；三条关系端点未匹配 0" : "存在未保存字段映射、缺失身份/标题或不兼容的 Link 端点",
            tone: pass ? "success" : "error"
          },
          function () {
            toast(pass ? "对象与关系可以预览" : "预览失败，请返回具体对象或字段修正", pass ? "success" : "error");
          }
        );
      },
      "run-validation": function () {
        var mappingPass = allObjectMappingsReady() && requiredEndpointFieldsReady() && state.createdLinkKeys.length === LINKS.length;
        var pass = getValidationItems().every(function (item) {
          return item.key === "links" ? mappingPass : item.ok;
        });
        completeAsync(
          { validationStatus: "processing", mappingPreview: "processing" },
          950,
          {
            validationStatus: pass ? "success" : "failed",
            validationAt: nowText(),
            mappingPreview: mappingPass ? "success" : "failed",
            mappingPreviewAt: nowText()
          },
          {
            id: nextId("VALIDATE"),
            kind: "校验",
            title: pass ? "统一校验通过" : "统一校验失败",
            detail: pass ? "8 类发布门禁全部通过；可以形成 Published 语义版本" : "存在未通过项；未生成语义版本",
            tone: pass ? "success" : "error"
          },
          function () {
            toast(pass ? "统一校验通过" : "统一校验失败，请按责任位置修正", pass ? "success" : "error");
          }
        );
      },
      "open-publish": function () {
        if (state.validationStatus !== "success") {
          toast("请先完成统一校验", "error");
          navigate("release");
          return;
        }
        ui.drawer = "publish";
        render();
      },
      "confirm-publish": function () {
        if (state.publishStatus === "processing") return;
        var semanticVersion = nextId("SEM-FIN");
        var publishedAt = nowText();
        var publicationId = nextId("PUBLISH");
        var publishCounts = resourceCounts();
        var resourcesToPublish = draftResources();
        var publishResourceKeys = resourcesToPublish.map(function (item) { return item.key; });
        var publishResourceIds = {};
        resourcesToPublish.forEach(function (resource) { publishResourceIds[resource.key] = resource.id; });
        var publishResourceContracts = snapshotResourceContracts(resourcesToPublish);
        var publishMembers = Object.assign({}, state.objectMembers);
        var publishMemberContracts = snapshotMemberContracts(publishMembers);
        var publishIdentityAssignments = Object.assign({}, state.identityAssignments);
        var publishTitleAssignments = Object.assign({}, state.titleAssignments);
        var publishEndpointFieldKeys = state.endpointFieldKeys.map(publishedEndpointIdentity);
        var publishValidationEvidence = getValidationItems().map(function (item) { return Object.assign({}, item); });
        var changeSummary = state.draftChangeSummary || "首次发布集团融资语义模型";
        state.publishStatus = "processing";
        saveState();
        render();
        window.setTimeout(function () {
          state.publishStatus = "published";
          state.semanticVersion = semanticVersion;
          state.publishedAt = publishedAt;
          state.semanticHistory.unshift({
            semanticVersion: semanticVersion,
            publishedAt: publishedAt,
            publicationId: publicationId,
            modelContract: cloneContract(state.model),
            counts: publishCounts,
            resourceKeys: publishResourceKeys,
            resourceIds: publishResourceIds,
            resourceContracts: publishResourceContracts,
            resourceSnapshotVersion: 2,
            resourceSnapshotComplete: true,
            objectMembers: publishMembers,
            memberContracts: publishMemberContracts,
            identityAssignments: publishIdentityAssignments,
            titleAssignments: publishTitleAssignments,
            endpointFieldKeys: publishEndpointFieldKeys,
            validationEvidence: publishValidationEvidence,
            assetVersion: state.assetVersion,
            assetAsOf: state.assetAsOf,
            changeSummary: changeSummary
          });
          state.selectedSemanticVersion = semanticVersion;
          state.draftRevisionBase = null;
          state.draftChangeSummary = null;
          state.candidateVersion = null;
          state.c028Status = "none";
          state.c029Status = "none";
          state.t018Status = "none";
          state.fixedStatus = "none";
          addEvent("发布", "发布语义版本", semanticVersion + " 已进入正式资源目录；数据仍等待独立绑定与确认切换", "success", publicationId);
          ui.drawer = null;
          saveState();
          navigate("catalog");
          render();
          toast("Published 语义版本已形成", "success");
        }, 1100);
      },
      "catalog-cards": function () {
        ui.catalogView = "cards";
        render();
      },
      "catalog-list": function () {
        ui.catalogView = "list";
        render();
      },
      "catalog-model": function () {
        ui.catalogView = "model";
        render();
      },
      "read-c028": function () {
        if (!state.semanticVersion) {
          toast("请先发布语义版本", "error");
          return;
        }
        if (state.candidateVersion) {
          toast("当前已有待更新数据正在处理");
          return;
        }
        var cycle = state.candidateCycle + 1;
        var adoptedVersions = adoptedDataVersionIds();
        var dataContract = financingDataVersionForCycle(cycle);
        while (dataContract && adoptedVersions[dataContract.id]) {
          cycle += 1;
          dataContract = financingDataVersionForCycle(cycle);
        }
        if (!dataContract) {
          toast("暂无新的待更新数据；已正式使用过的数据版本不会重复进入更新流程");
          return;
        }
        var version = dataContract.id;
        var requestId = nextId("C028");
        var asOf = dataContract.asOf;
        completeAsync(
          {
            candidateCycle: cycle,
            candidateVersion: version,
            candidateAsOf: asOf,
            c028Status: "processing",
            c028Id: requestId,
            c029Status: "none",
            c029Id: null,
            t018Status: "none",
            fixedStatus: "none",
            fixedAttempts: 0,
            candidateMappingFixed: !dataContract.requiresRemapping
          },
          850,
          { c028Status: "accepted" },
          {
            id: requestId,
            kind: "C028",
            title: "收到待更新数据",
            detail: version + " 已进入待处理队列；当前正式使用版本保持不变",
            tone: "success"
          },
          function () {
            toast("待更新数据已接收", "success");
          }
        );
      },
      "process-c029": function () { startC029(false); },
      "retry-c029": function () { startC029(true); },
      "fix-candidate-mapping": function () {
        state.candidateMappingFixed = true;
        addEvent("映射", "修正待更新数据的机构端点映射", "为当前待更新数据恢复金融机构稳定端点；不接管数据工程来源配置", "success", nextId("MAP-CANDIDATE"));
        saveState();
        navigate("consumption");
        render();
        toast("重新映射已保存，可以再次检查", "success");
      },
      "run-fixed-validation": function () {
        if (state.t018Status !== "qualified") {
          toast("待更新数据尚不具备消费验证条件", "error");
          return;
        }
        var attempt = state.fixedAttempts + 1;
        var shouldFail = state.candidateCycle === 1 && attempt === 1;
        var validationId = nextId("QA-CANDIDATE");
        completeAsync(
          { fixedStatus: "processing", fixedAttempts: attempt },
          1100,
          { fixedStatus: shouldFail ? "failed" : "success" },
          {
            id: validationId,
            kind: "消费验证",
            title: shouldFail ? "业务消费验证未完成" : "业务消费验证通过",
            detail: shouldFail ? "Q05 超时；7 / 8 完成，整体保持未通过，上一可信数据不变" : "8 / 8 通过；证据能够证明同一 Published 语义版本与待更新数据版本",
            tone: shouldFail ? "error" : "success"
          },
          function () {
            toast(shouldFail ? "业务消费验证未全部完成，可重试" : "业务消费验证通过", shouldFail ? "error" : "success");
          }
        );
      },
      "open-adopt": function () {
        if (state.t018Status !== "qualified" || state.fixedStatus !== "success") {
          toast("待更新数据尚未通过全部检查", "error");
          return;
        }
        ui.modal = "adopt";
        render();
      },
      "confirm-adopt": function () {
        if (state.bindingStatus === "processing") return;
        var bindingId = nextId("T019");
        var binding = {
          bindingId: bindingId,
          semanticVersion: state.semanticVersion,
          dataVersion: state.candidateVersion,
          asOf: state.candidateAsOf,
          adoptedAt: nowText(),
          action: "切换正式数据"
        };
        state.bindingStatus = "processing";
        saveState();
        render();
        window.setTimeout(function () {
          var previous = state.currentBinding;
          state.previousBinding = previous && previous.semanticVersion === binding.semanticVersion ? previous : null;
          state.currentBinding = binding;
          state.bindingHistory.unshift(binding);
          state.bindingStatus = "ready";
          state.currentBlocked = false;
          state.authorityQuality = "unchecked";
          state.candidateVersion = null;
          state.candidateAsOf = null;
          state.c028Status = "none";
          state.c028Id = null;
          state.c029Status = "none";
          state.c029Id = null;
          state.t018Status = "none";
          state.fixedStatus = "none";
          state.fixedAttempts = 0;
          addEvent("T019", "切换为正式数据", binding.semanticVersion + " + " + binding.dataVersion + " 已成为当前正式使用版本", "success", bindingId);
          ui.modal = null;
          saveState();
          render();
          toast("已切换为正式数据", "success");
        }, 950);
      },
      "check-authority-quality": function () {
        if (!state.currentBinding) return;
        var eventId = nextId("QUALITY");
        completeAsync(
          { authorityQuality: "processing" },
          950,
          { authorityQuality: "failed", currentBlocked: true },
          {
            id: eventId,
            kind: "数据质量",
            title: "当前正式数据发现事后硬质量失败",
            detail: state.currentBinding.dataVersion + " 的负责人关系覆盖出现确认缺陷；新正式消费已阻断",
            tone: "error"
          },
          function () {
            toast("当前正式数据已受阻断，可检查上一可信数据", "error");
          }
        );
      },
      "open-rollback": function () {
        if (!previousBindingForCurrent()) {
          toast("当前正式语义版本内没有可安全回退的上一可信数据", "error");
          return;
        }
        ui.modal = "rollback";
        render();
      },
      "confirm-rollback": function () {
        var compatiblePrevious = previousBindingForCurrent();
        if (!compatiblePrevious || !state.currentBinding || compatiblePrevious.semanticVersion !== state.currentBinding.semanticVersion) {
          ui.modal = null;
          render();
          toast("回退目标与当前正式语义版本不一致，已阻止回退", "error");
          return;
        }
        var rollbackId = nextId("T019-ROLLBACK");
        var target = compatiblePrevious;
        var recovered = {
          bindingId: rollbackId,
          semanticVersion: target.semanticVersion,
          dataVersion: target.dataVersion,
          asOf: target.asOf,
          adoptedAt: nowText(),
          action: "回退"
        };
        var badBinding = state.currentBinding;
        state.bindingStatus = "processing";
        saveState();
        render();
        window.setTimeout(function () {
          state.currentBinding = recovered;
          state.previousBinding = null;
          state.bindingHistory.unshift(recovered);
          state.bindingStatus = "ready";
          state.currentBlocked = false;
          state.authorityQuality = "recovered";
          addEvent("回退", "回退上一可信数据", recovered.semanticVersion + " + " + recovered.dataVersion + " 已重新成为当前正式使用版本；受阻断版本 " + badBinding.dataVersion + " 仍保留历史证据", "success", rollbackId);
          ui.modal = null;
          saveState();
          render();
          toast("已回退上一可信数据", "success");
        }, 950);
      },
      "zoom-in": function () {
        state.zoom = Math.min(1.35, Math.round((state.zoom + 0.1) * 100) / 100);
        saveState();
        render();
      },
      "zoom-out": function () {
        state.zoom = Math.max(0.45, Math.round((state.zoom - 0.1) * 100) / 100);
        saveState();
        render();
      },
      "fit-canvas": function () {
        state.zoom = 0.78;
        state.panX = 0;
        state.panY = 0;
        state.nodePositions = clonePositions();
        saveState();
        render();
        toast("画布已适配当前视图");
      },
      "confirm-reset": function () {
        localStorage.removeItem(STORAGE_KEY);
        state = initialState();
        ui.modal = null;
        ui.drawer = null;
        ui.inspectorTab = "overview";
        ui.dockTab = "events";
        ui.treeQuery = "";
        ui.consumer = "qa";
        navigate("model");
        render();
        toast("已回到初始状态", "success");
      },
      "confirm-blank-draft": function () {
        state = blankState();
        saveState();
        ui.modal = "create";
        ui.drawer = null;
        ui.inspectorTab = "overview";
        ui.canvasView = "semantic";
        navigate("model");
        render();
      }
    };
    if (actions[action]) actions[action]();
  }

  document.addEventListener("click", function (event) {
    var overlay = event.target.closest("[data-overlay='close']");
    if (overlay && event.target === overlay) {
      closeOverlay();
      return;
    }
    var navigation = event.target.closest("[data-nav]");
    if (navigation) {
      var navigationTarget = navigation.getAttribute("data-nav");
      if (navigationTarget === "catalog" && state.semanticVersion) {
        state.selectedSemanticVersion = state.semanticVersion;
        saveState();
      }
      navigate(navigationTarget);
      return;
    }
    var target = event.target.closest("[data-action]");
    if (target && !target.disabled) {
      handleAction(target.getAttribute("data-action"));
    }
  });

  document.addEventListener("input", function (event) {
    if (event.target.getAttribute("data-input") === "tree-query") {
      ui.treeQuery = event.target.value;
      render();
      var search = document.querySelector("[data-input='tree-query']");
      if (search) {
        search.focus();
        search.setSelectionRange(search.value.length, search.value.length);
      }
    }
  });

  document.addEventListener("change", function (event) {
    if (event.target.getAttribute("data-input") !== "published-version") return;
    state.selectedSemanticVersion = event.target.value;
    saveState();
    render();
  });

  document.addEventListener("submit", function (event) {
    if (event.target.id === "create-revision-form") {
      event.preventDefault();
      var revisionData = new FormData(event.target);
      var summary = String(revisionData.get("summary") || "").trim();
      if (!summary) {
        toast("请填写本次变更说明", "error");
        return;
      }
      state.draftRevisionBase = activePublishedVersion();
      state.draftChangeSummary = summary;
      state.validationStatus = "idle";
      state.validationAt = null;
      state.publishStatus = "idle";
      state.draftSavedAt = nowText();
      addEvent("Draft", "创建新版本 Draft", summary, "success", nextId("DRAFT"));
      ui.modal = null;
      ui.canvasView = "semantic";
      saveState();
      navigate("model");
      render();
      toast("新 Draft 已创建", "success");
      return;
    }
    if (event.target.id !== "create-model-form") return;
    event.preventDefault();
    var formData = new FormData(event.target);
    var name = String(formData.get("name") || "").trim();
    var definition = String(formData.get("definition") || "").trim();
    if (!name || !definition) {
      toast("请填写本体名称和业务定义", "error");
      return;
    }
    state.model = {
      id: nextId("ONTOLOGY"),
      name: name,
      definition: definition,
      scenario: "S001 集团融资成本与债务结构优化",
      createdAt: nowText()
    };
    state.resourceIds = {};
    state.createdObjectKeys = [];
    state.createdPropertyKeys = [];
    state.mappedPropertyKeys = [];
    state.createdLinkKeys = [];
    state.createdMetricKeys = [];
    state.createdRuleKeys = [];
    state.actionCreated = false;
    state.objectMembers = {};
    state.identityAssignments = {};
    state.titleAssignments = {};
    state.endpointFieldKeys = [];
    state.selectedResource = "subject";
    state.draftSavedAt = nowText();
    addEvent("Draft", "创建本体 Draft", name + " 已创建空白工作区；尚未创建任何语义资源", "success", state.model.id);
    ui.modal = null;
    saveState();
    navigate("model");
    render();
    toast("本体 Draft 已创建", "success");
  });

  document.addEventListener("pointerdown", function (event) {
    var handle = event.target.closest("[data-node-handle]");
    if (route() !== "model") return;
    if (handle) {
      var key = handle.getAttribute("data-node-handle");
      var position = state.nodePositions[key];
      ui.drag = {
        mode: "node",
        key: key,
        startX: event.clientX,
        startY: event.clientY,
        nodeX: position.x,
        nodeY: position.y
      };
      event.preventDefault();
      return;
    }
    var canvas = event.target.closest("#model-canvas");
    if (canvas && !event.target.closest("button") && !event.target.closest(".model-node") && !event.target.closest(".minimap")) {
      ui.drag = {
        mode: "canvas",
        startX: event.clientX,
        startY: event.clientY,
        panX: state.panX,
        panY: state.panY
      };
      canvas.classList.add("dragging");
      event.preventDefault();
    }
  });

  document.addEventListener("pointermove", function (event) {
    if (!ui.drag) return;
    if (ui.drag.mode === "canvas") {
      state.panX = Math.round(ui.drag.panX + event.clientX - ui.drag.startX);
      state.panY = Math.round(ui.drag.panY + event.clientY - ui.drag.startY);
      var world = document.querySelector("#model-canvas .canvas-world");
      if (world) world.style.transform = "translate(" + state.panX + "px," + state.panY + "px) scale(" + state.zoom + ")";
      return;
    }
    var dx = (event.clientX - ui.drag.startX) / state.zoom;
    var dy = (event.clientY - ui.drag.startY) / state.zoom;
    var nextX = Math.max(20, Math.min(1000, ui.drag.nodeX + dx));
    var nextY = Math.max(20, Math.min(620, ui.drag.nodeY + dy));
    state.nodePositions[ui.drag.key] = { x: Math.round(nextX), y: Math.round(nextY) };
    var node = document.querySelector('[data-node="' + ui.drag.key + '"]');
    if (node) {
      node.style.left = Math.round(nextX) + "px";
      node.style.top = Math.round(nextY) + "px";
    }
    updateModelEdgesDom();
  });

  document.addEventListener("pointerup", function () {
    if (!ui.drag) return;
    if (ui.drag.mode === "canvas") {
      ui.drag = null;
      saveState();
      var canvas = document.getElementById("model-canvas");
      if (canvas) canvas.classList.remove("dragging");
      return;
    }
    var movedKey = ui.drag.key;
    ui.drag = null;
    saveState();
    render();
    toast("已移动 " + resourceByKey(movedKey).name);
  });

  document.addEventListener("wheel", function (event) {
    var canvas = event.target.closest("#model-canvas");
    if (!canvas || route() !== "model") return;
    event.preventDefault();
    var delta = event.deltaY > 0 ? -0.06 : 0.06;
    state.zoom = Math.max(0.45, Math.min(1.35, Math.round((state.zoom + delta) * 100) / 100));
    saveState();
    render();
  }, { passive: false });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && (ui.modal || ui.drawer)) closeOverlay();
  });

  window.addEventListener("hashchange", function () {
    ui.modal = null;
    ui.drawer = null;
    ui.selectedLoan = null;
    ui.selectedBank = null;
    render();
  });
  if (!location.hash) location.replace("#model");
  render();
})();
