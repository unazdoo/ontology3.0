(() => {
  "use strict";

  const STORAGE_KEY = "ontology-management-task-first-v7";
  const LEGACY_KEYS = ["ontology-management-task-first-v1", "ontology-management-task-first-v2", "ontology-management-task-first-v3", "ontology-management-task-first-v4", "ontology-management-task-first-v5", "ontology-management-task-first-v6"];
  const RESOURCE_OWNER = "本体管理";

  const publishedAsset = {
    id: "ASSET-FINANCING-STANDARDIZED",
    name: "融资标准化数据资产",
    versionLabel: "FIN-ASSET-20251130-v01",
    asOf: "2025-11-30",
    publishedAt: "2025-12-02 10:23:42",
    status: "已发布",
    quality: "基础质量检查通过",
    scope: "四个资产成员、三组成员关系",
    lineage: ["融资一览表", "融资数据标准化管道", "融资标准化数据资产"],
    members: [
      { id: "member.financing_subject_ref", name: "融资主体参考", grain: "一行一个融资主体", rows: 574, identity: "单位编码", target: "融资主体" },
      { id: "member.financing_detail", name: "融资明细", grain: "一行一笔借据", rows: 5218, identity: "借据编号", target: "融资明细" },
      { id: "member.financing_institution_ref", name: "金融机构参考", grain: "一行一个融资机构", rows: 24, identity: "机构编码", target: "融资机构" },
      { id: "member.financing_owner_ref", name: "融资负责人参考", grain: "一行一个负责人", rows: 24, identity: "负责人标识", target: "融资负责人" }
    ],
    fields: {
      "member.financing_subject_ref": [
        { id: "unit_code", name: "单位编码", type: "文本", sample: "UNIT-553" },
        { id: "unit_name", name: "单位名称", type: "文本", sample: "单位553" },
        { id: "sector", name: "产业板块", type: "文本", sample: "集团及直管公司" },
        { id: "owner_id", stableId: "FIELD-FINANCING-ENTITY-OWNER-ID", name: "负责人标识", type: "文本", sample: "OWNER-001" }
      ],
      "member.financing_detail": [
        { id: "loan_id", name: "借据编号", type: "文本", sample: "LOAN-004842" },
        { id: "subject_code", stableId: "FIELD-FINANCING-DETAIL-ENTITY-CODE", name: "单位编码", type: "文本", sample: "UNIT-553" },
        { id: "institution_code", stableId: "FIELD-FINANCING-DETAIL-INSTITUTION-CODE", name: "机构编码", type: "文本", sample: "INST-012" },
        { id: "domestic_overseas", name: "境内外", type: "枚举", sample: "境内" },
        { id: "drawdown_date", name: "提款日期", type: "日期", sample: "2024-03-18" },
        { id: "maturity_date", name: "提款到期日期", type: "日期", sample: "2029-03-18" },
        { id: "currency", name: "借据币种", type: "文本", sample: "人民币" },
        { id: "fx_rate", name: "提款折算人民币汇率", type: "数值", sample: "1.0000" },
        { id: "original_balance", name: "借据余额（原币）", type: "数值", sample: "1256000000" },
        { id: "cny_balance", name: "借据余额（折合人民币）", type: "数值", sample: "1256000000" },
        { id: "interest_rate", name: "当前利率", type: "数值", sample: "2.90" },
        { id: "rate_type", name: "利率形式", type: "枚举", sample: "固定利率" },
        { id: "financing_type", name: "融资类型", type: "枚举", sample: "银行借款" },
        { id: "term_type", name: "期限种类", type: "枚举", sample: "长期" },
        { id: "guarantee_type", name: "担保方式", type: "枚举", sample: "信用" }
      ],
      "member.financing_institution_ref": [
        { id: "institution_code", name: "机构编码", type: "文本", sample: "INST-012" },
        { id: "institution_name", name: "机构名称", type: "文本", sample: "欧陆银行" },
        { id: "institution_category", name: "机构类别", type: "文本", sample: "商业银行" }
      ],
      "member.financing_owner_ref": [
        { id: "owner_id", name: "负责人标识", type: "文本", sample: "OWNER-001" },
        { id: "owner_name", name: "负责人名称", type: "文本", sample: "融资负责人001" }
      ]
    }
  };

  const objectTemplates = [
    {
      id: "OBJ-FINANCING-ENTITY", name: "融资主体", code: "O", definition: "独立承担融资余额、成本、结构判断和优化行动的单位。", identityPropertyId: "PROP-FINANCING-ENTITY-UNIT-CODE", titlePropertyId: "PROP-FINANCING-ENTITY-UNIT-NAME", memberId: "member.financing_subject_ref", linkEndpointFields: ["owner_id"], count: 574,
      properties: [
        { id: "PROP-FINANCING-ENTITY-UNIT-CODE", name: "单位编码", type: "文本", unit: "—", required: true, role: "身份", sourceFieldId: "unit_code", sourceField: "单位编码", definition: "融资主体在跨系统和跨版本中保持稳定的业务身份。" },
        { id: "PROP-FINANCING-ENTITY-UNIT-NAME", name: "单位名称", type: "文本", unit: "—", required: true, role: "标题", sourceFieldId: "unit_name", sourceField: "单位名称", definition: "用于页面、问数和行动证据中的可读名称。" },
        { id: "PROP-FINANCING-ENTITY-SECTOR", name: "所属板块", type: "文本", unit: "—", required: false, role: "业务属性", sourceFieldId: "sector", sourceField: "产业板块", definition: "融资主体所属的统一产业板块。" }
      ]
    },
    {
      id: "OBJ-FINANCING-DETAIL", name: "融资明细", code: "O", definition: "一笔具有独立借据身份、余额、利率、期限与币种的融资事实。", identityPropertyId: "PROP-FINANCING-DETAIL-LOAN-ID", titlePropertyId: "PROP-FINANCING-DETAIL-LOAN-ID", memberId: "member.financing_detail", linkEndpointFields: ["subject_code", "institution_code"], count: 5218,
      properties: [
        { id: "PROP-FINANCING-DETAIL-LOAN-ID", name: "借据编号", type: "文本", unit: "—", required: true, role: "身份、标题", sourceFieldId: "loan_id", sourceField: "借据编号", definition: "每笔融资明细的稳定业务身份。" },
        { id: "PROP-FINANCING-DETAIL-DOMESTIC-OVERSEAS", name: "境内外", type: "枚举", unit: "—", required: false, role: "业务属性", sourceFieldId: "domestic_overseas", sourceField: "境内外", definition: "融资发生的境内外分类。" },
        { id: "PROP-FINANCING-DETAIL-DRAWDOWN-DATE", name: "提款日", type: "日期", unit: "—", required: false, role: "时间", sourceFieldId: "drawdown_date", sourceField: "提款日期", definition: "融资实际提款日期。" },
        { id: "PROP-FINANCING-DETAIL-MATURITY-DATE", name: "到期日", type: "日期", unit: "—", required: false, role: "时间", sourceFieldId: "maturity_date", sourceField: "提款到期日期", definition: "融资约定到期日期。" },
        { id: "PROP-FINANCING-DETAIL-CURRENCY", name: "币种", type: "文本", unit: "—", required: true, role: "业务属性", sourceFieldId: "currency", sourceField: "借据币种", definition: "融资原币币种。" },
        { id: "PROP-FINANCING-DETAIL-FX-RATE", name: "汇率", type: "数值", unit: "人民币/原币", required: true, role: "折算", sourceFieldId: "fx_rate", sourceField: "提款折算人民币汇率", definition: "原币余额折算成人民币的汇率。" },
        { id: "PROP-FINANCING-DETAIL-ORIGINAL-BALANCE", name: "原币余额", type: "数值", unit: "原币元", required: true, role: "金额", sourceFieldId: "original_balance", sourceField: "借据余额（原币）", definition: "数据截至时点的原币余额。" },
        { id: "PROP-FINANCING-DETAIL-CNY-BALANCE", name: "折合人民币余额", type: "数值", unit: "人民币元", required: true, role: "金额", sourceFieldId: "cny_balance", sourceField: "借据余额（折合人民币）", definition: "按获准汇率折合的人民币余额。" },
        { id: "PROP-FINANCING-DETAIL-INTEREST-RATE", name: "当前利率", type: "数值", unit: "%", required: true, role: "成本", sourceFieldId: "interest_rate", sourceField: "当前利率", definition: "数据截至时点的借据执行利率。" },
        { id: "PROP-FINANCING-DETAIL-RATE-TYPE", name: "利率形式", type: "枚举", unit: "—", required: true, role: "结构", sourceFieldId: "rate_type", sourceField: "利率形式", definition: "固定利率或浮动利率。" },
        { id: "PROP-FINANCING-DETAIL-FINANCING-TYPE", name: "融资类型", type: "枚举", unit: "—", required: false, role: "结构", sourceFieldId: "financing_type", sourceField: "融资类型", definition: "银行借款等融资业务分类。" },
        { id: "PROP-FINANCING-DETAIL-TERM-TYPE", name: "期限种类", type: "枚举", unit: "—", required: true, role: "结构", sourceFieldId: "term_type", sourceField: "期限种类", definition: "短期、中期或长期分类。" },
        { id: "PROP-FINANCING-DETAIL-GUARANTEE-TYPE", name: "担保方式", type: "枚举", unit: "—", required: false, role: "结构", sourceFieldId: "guarantee_type", sourceField: "担保方式", definition: "信用、保证或抵质押等担保形式。" }
      ]
    },
    {
      id: "OBJ-FINANCIAL-INSTITUTION", name: "融资机构", code: "O", definition: "向融资主体提供具体融资并可作为协商对象的金融机构。", identityPropertyId: "PROP-FINANCIAL-INSTITUTION-CODE", titlePropertyId: "PROP-FINANCIAL-INSTITUTION-NAME", memberId: "member.financing_institution_ref", linkEndpointFields: [], count: 24,
      properties: [
        { id: "PROP-FINANCIAL-INSTITUTION-CODE", name: "机构编码", type: "文本", unit: "—", required: true, role: "身份", sourceFieldId: "institution_code", sourceField: "机构编码", definition: "融资机构跨借据和跨版本稳定使用的业务身份。" },
        { id: "PROP-FINANCIAL-INSTITUTION-NAME", name: "机构名称", type: "文本", unit: "—", required: true, role: "标题", sourceFieldId: "institution_name", sourceField: "机构名称", definition: "融资机构的业务可读名称。" },
        { id: "PROP-FINANCIAL-INSTITUTION-CATEGORY", name: "机构类别", type: "文本", unit: "—", required: false, role: "业务属性", sourceFieldId: "institution_category", sourceField: "机构类别", definition: "商业银行等机构分类。" }
      ]
    },
    {
      id: "OBJ-FINANCING-OWNER", name: "融资负责人", code: "O", definition: "承接融资主体优化待办的业务责任实体。", identityPropertyId: "PROP-FINANCING-OWNER-ID", titlePropertyId: "PROP-FINANCING-OWNER-NAME", memberId: "member.financing_owner_ref", linkEndpointFields: ["owner_id"], count: 24,
      properties: [
        { id: "PROP-FINANCING-OWNER-ID", name: "负责人标识", type: "文本", unit: "—", required: true, role: "身份", sourceFieldId: "owner_id", sourceField: "负责人标识", definition: "负责人稳定身份，不使用显示名称绑定。" },
        { id: "PROP-FINANCING-OWNER-NAME", name: "负责人名称", type: "文本", unit: "—", required: true, role: "标题", sourceFieldId: "owner_name", sourceField: "负责人名称", definition: "待办和证据中的可读责任人名称。" }
      ]
    }
  ];

  const linkTemplates = [
    { id: "LINK-ENTITY-FINANCING", name: "主体拥有融资", code: "L", sourceObjectId: "OBJ-FINANCING-ENTITY", targetObjectId: "OBJ-FINANCING-DETAIL", direction: "融资主体 → 融资明细", cardinality: "一对多", sourceEndpoint: "PROP-FINANCING-ENTITY-UNIT-CODE", targetEndpointField: "subject_code", targetEndpointFieldStableId: "FIELD-FINANCING-DETAIL-ENTITY-CODE", definition: "一个融资主体拥有零到多笔融资明细。" },
    { id: "LINK-FINANCING-INSTITUTION", name: "融资由机构提供", code: "L", sourceObjectId: "OBJ-FINANCING-DETAIL", targetObjectId: "OBJ-FINANCIAL-INSTITUTION", direction: "融资明细 → 融资机构", cardinality: "多对一", sourceEndpointField: "institution_code", sourceEndpointFieldStableId: "FIELD-FINANCING-DETAIL-INSTITUTION-CODE", targetEndpoint: "PROP-FINANCIAL-INSTITUTION-CODE", definition: "每笔融资由一个金融机构提供。" },
    { id: "LINK-ENTITY-OWNER", name: "主体由负责人承接", code: "L", sourceObjectId: "OBJ-FINANCING-ENTITY", targetObjectId: "OBJ-FINANCING-OWNER", direction: "融资主体 → 融资负责人", cardinality: "多对一", sourceEndpointField: "owner_id", sourceEndpointFieldStableId: "FIELD-FINANCING-ENTITY-OWNER-ID", targetEndpoint: "PROP-FINANCING-OWNER-ID", definition: "融资主体的问题行动由明确负责人承接。" }
  ];

  const metricTemplates = [
    { id: "MET-FIN-BALANCE", name: "融资余额", code: "M", unit: "人民币元", scope: "集团、板块、单一主体、主体集合", time: "数据截至时点", zeroHandling: "没有有效明细时返回无法计算", objectId: "OBJ-FINANCING-ENTITY", depends: ["PROP-FINANCING-DETAIL-CNY-BALANCE", "LINK-ENTITY-FINANCING"], definition: "获准融资明细折合人民币余额之和。" },
    { id: "MET-WAVG-COST", name: "余额加权平均融资成本", code: "M", unit: "%", scope: "集团、板块、单一主体、主体集合", time: "数据截至时点", zeroHandling: "融资余额为零时返回无法计算", objectId: "OBJ-FINANCING-ENTITY", depends: ["MET-FIN-BALANCE", "PROP-FINANCING-DETAIL-INTEREST-RATE"], definition: "以折合人民币余额作为权重的融资成本。" },
    { id: "MET-FLOATING-RATE-SHARE", name: "浮动利率余额占比", code: "M", unit: "%", scope: "集团、板块、单一主体", time: "数据截至时点", zeroHandling: "融资余额为零时返回无法计算", objectId: "OBJ-FINANCING-ENTITY", depends: ["MET-FIN-BALANCE", "PROP-FINANCING-DETAIL-RATE-TYPE"], definition: "浮动利率融资余额占融资余额的比例。" },
    { id: "MET-SHORT-DEBT-SHARE", name: "短期债务余额占比", code: "M", unit: "%", scope: "集团、板块、单一主体", time: "数据截至时点", zeroHandling: "融资余额为零时返回无法计算", objectId: "OBJ-FINANCING-ENTITY", depends: ["MET-FIN-BALANCE", "PROP-FINANCING-DETAIL-TERM-TYPE"], definition: "短期融资余额占融资余额的比例。" },
    { id: "MET-FX-FINANCING-SHARE", name: "外币融资余额占比", code: "M", unit: "%", scope: "集团、板块、单一主体", time: "数据截至时点", zeroHandling: "融资余额为零时返回无法计算", objectId: "OBJ-FINANCING-ENTITY", depends: ["MET-FIN-BALANCE", "PROP-FINANCING-DETAIL-CURRENCY"], definition: "非人民币融资余额占融资余额的比例。" },
    { id: "MET-HIGH-COST-SHARE", name: "高成本融资余额占比", code: "M", unit: "%", scope: "集团、板块、单一主体", time: "数据截至时点", zeroHandling: "融资余额为零时返回无法计算", objectId: "OBJ-FINANCING-ENTITY", depends: ["MET-FIN-BALANCE", "PROP-FINANCING-DETAIL-INTEREST-RATE"], definition: "执行利率高于2.75%的融资余额占比。" },
    { id: "MET-CREDIT-FINANCING-SHARE", name: "信用融资余额占比", code: "M", unit: "%", scope: "集团、板块、单一主体", time: "数据截至时点", zeroHandling: "融资余额为零时返回无法计算", objectId: "OBJ-FINANCING-ENTITY", depends: ["MET-FIN-BALANCE", "PROP-FINANCING-DETAIL-GUARANTEE-TYPE"], definition: "信用类融资余额占融资余额的比例。" }
  ];

  const ruleTemplates = [
    { id: "RULE-HIGH-COST", name: "融资成本偏高", displayCode: "R01", code: "R", objectId: "OBJ-FINANCING-ENTITY", depends: ["MET-WAVG-COST", "MET-HIGH-COST-SHARE"], condition: "主体成本高于集团余额加权基准0.25个百分点，或高成本融资余额占比大于20%", evidence: "指标快照、前三家问题余额贡献机构、关联借据", definition: "识别成本显著偏高、需要优先协商的融资主体。" },
    { id: "RULE-FLOATING-EXPOSURE", name: "浮动利率暴露", displayCode: "R02", code: "R", objectId: "OBJ-FINANCING-ENTITY", depends: ["MET-FLOATING-RATE-SHARE"], condition: "浮动利率余额占比大于80%", evidence: "指标快照、前三家浮动利率余额贡献机构、关联借据", definition: "识别利率波动暴露较高的融资主体。" },
    { id: "RULE-SHORT-DEBT", name: "短期债务集中", displayCode: "R03", code: "R", objectId: "OBJ-FINANCING-ENTITY", depends: ["MET-SHORT-DEBT-SHARE"], condition: "短期债务余额占比大于30%", evidence: "指标快照、前三家短期债务余额贡献机构、关联借据", definition: "识别短期偿付压力集中的融资主体。" }
  ];

  const actionTemplates = [
    { id: "ACTION-FINANCING-OPTIMIZATION", name: "发起融资优化建议", code: "A", objectId: "OBJ-FINANCING-ENTITY", depends: ["RULE-HIGH-COST", "RULE-FLOATING-EXPOSURE", "RULE-SHORT-DEBT", "LINK-ENTITY-FINANCING", "LINK-FINANCING-INSTITUTION", "LINK-ENTITY-OWNER"], parameters: "融资主体、规则命中、指标快照、优先协商银行、关联借据、数据截至时间", prerequisite: "同一正式版本中的目标对象、规则结果和完整证据", result: "形成行动请求；人工确认后由决策中心生成负责人待办", confirmation: "必须人工确认", definition: "在规则命中后允许请求一项受控的融资优化行动。" }
  ];

  const subjectInstances = [
    { id: "UNIT-553", name: "单位553", sector: "集团及直管公司", owner: "融资负责人001", loans: 75, balance: "393.134亿元", cost: "2.881%", rule: "R01", issue: "高成本融资余额占比77.337%", banks: "欧陆银行、寰宇银行、海联银行" },
    { id: "UNIT-465", name: "单位465", sector: "核能", owner: "融资负责人009", loans: 176, balance: "770.000亿元", cost: "2.197%", rule: "R02", issue: "浮动利率余额占比100.000%", banks: "融通银行、启明银行、嘉禾银行" },
    { id: "UNIT-561", name: "单位561", sector: "核技术", owner: "融资负责人009", loans: 50, balance: "20.016亿元", cost: "2.228%", rule: "R03", issue: "短期债务余额占比93.545%", banks: "同州银行、星河银行、恒信银行" }
  ];

  const detailInstances = [
    { id: "LOAN-004842", subject: "单位553", institution: "欧陆银行", balance: "12.560亿元", rate: "2.90%", rateType: "固定利率", term: "长期", currency: "英镑" },
    { id: "LOAN-004840", subject: "单位553", institution: "寰宇银行", balance: "4.596亿元", rate: "2.90%", rateType: "固定利率", term: "长期", currency: "英镑" },
    { id: "LOAN-003493", subject: "单位465", institution: "融通银行", balance: "3.580亿元", rate: "2.25%", rateType: "浮动利率", term: "长期", currency: "人民币" },
    { id: "LOAN-005007", subject: "单位561", institution: "同州银行", balance: "0.235亿元", rate: "2.20%", rateType: "固定利率", term: "短期", currency: "人民币" }
  ];

  const institutionInstances = [
    { id: "INST-012", name: "欧陆银行", category: "商业银行", loans: 48, subjects: 17 },
    { id: "INST-010", name: "寰宇银行", category: "商业银行", loans: 44, subjects: 16 },
    { id: "INST-006", name: "海联银行", category: "商业银行", loans: 47, subjects: 14 },
    { id: "INST-014", name: "融通银行", category: "商业银行", loans: 423, subjects: 164 },
    { id: "INST-018", name: "同州银行", category: "商业银行", loans: 393, subjects: 171 }
  ];

  const ownerInstances = [
    { id: "OWNER-001", name: "融资负责人001", subjects: 24, key: "单位553" },
    { id: "OWNER-009", name: "融资负责人009", subjects: 24, key: "单位465、单位561" }
  ];

  const defaultPositions = {
    "OBJ-FINANCING-ENTITY": { x: 80, y: 110 }, "OBJ-FINANCING-DETAIL": { x: 390, y: 110 }, "OBJ-FINANCIAL-INSTITUTION": { x: 710, y: 110 }, "OBJ-FINANCING-OWNER": { x: 80, y: 320 },
    "LINK-ENTITY-FINANCING": { x: 250, y: 220 }, "LINK-FINANCING-INSTITUTION": { x: 560, y: 220 }, "LINK-ENTITY-OWNER": { x: 80, y: 455 },
    "MET-FIN-BALANCE": { x: 310, y: 340 }, "MET-WAVG-COST": { x: 560, y: 340 }, "MET-FLOATING-RATE-SHARE": { x: 810, y: 340 }, "MET-SHORT-DEBT-SHARE": { x: 980, y: 340 },
    "MET-FX-FINANCING-SHARE": { x: 310, y: 515 }, "MET-HIGH-COST-SHARE": { x: 560, y: 515 }, "MET-CREDIT-FINANCING-SHARE": { x: 810, y: 515 },
    "RULE-HIGH-COST": { x: 460, y: 690 }, "RULE-FLOATING-EXPOSURE": { x: 710, y: 690 }, "RULE-SHORT-DEBT": { x: 960, y: 690 }, "ACTION-FINANCING-OPTIMIZATION": { x: 710, y: 865 }
  };

  function deepClone(value) { return JSON.parse(JSON.stringify(value)); }
  function nowText() { return new Date().toLocaleString("zh-CN", { hour12: false }).replaceAll("/", "-"); }
  function compactStamp() {
    const date = new Date();
    const pad = (value, length = 2) => String(value).padStart(length, "0");
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}${pad(date.getMilliseconds(), 3)}`;
  }
  function uid(prefix) { return `${prefix}-${compactStamp()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`; }
  function normalizeBusinessCode(value) {
    return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");
  }
  function stableSemanticId(prefix, value) {
    const normalized = normalizeBusinessCode(value);
    const code = normalized.startsWith(`${prefix}-`) ? normalized.slice(prefix.length + 1) : normalized;
    return code ? `${prefix}-${code}` : "";
  }
  function stableIdExists(model, id) {
    if (allResources(model).some(resource => resource.id === id)) return true;
    if (state.drafts.some(draft => draft.id !== model?.id && allResources(draft).some(resource => resource.id === id))) return true;
    return state.publishedVersions.some(version => allResources(version.snapshot).some(resource => resource.id === id));
  }

  function versionDataContract(version) {
    return version?.dataContract || publishedAsset;
  }

  function versionMemberById(version, id) {
    return versionDataContract(version).members.find(item => item.id === id) || null;
  }

  function versionFieldById(version, objectId, fieldId) {
    const object = findObject(version?.snapshot, objectId);
    if (!object?.memberId || !fieldId) return null;
    const contract = versionDataContract(version);
    const versionField = (contract.fields?.[object.memberId] || []).find(item => item.id === fieldId);
    if (versionField?.stableId) return versionField;
    const canonicalField = (publishedAsset.fields?.[object.memberId] || []).find(item => item.id === fieldId);
    return versionField ? { ...versionField, stableId: canonicalField?.stableId || null } : canonicalField || null;
  }

  function publishedEndpointDescriptor(version, link, side) {
    const objectId = link?.[`${side}ObjectId`];
    const propertyId = link?.[`${side}Endpoint`];
    if (propertyId) {
      const property = findResource(version?.snapshot, propertyId);
      return { label: property?.name || "Property 端点", stableId: propertyId };
    }
    const fieldId = link?.[`${side}EndpointField`];
    const field = versionFieldById(version, objectId, fieldId);
    const stableId = link?.[`${side}EndpointFieldStableId`] || field?.stableId || null;
    return { label: field?.name || "成员字段端点", stableId };
  }

  function publishedEndpointHtml(version, link, side) {
    const endpoint = publishedEndpointDescriptor(version, link, side);
    return `${escapeHtml(endpoint.label)}<br><span class="mono">${escapeHtml(endpoint.stableId || "稳定身份缺失")}</span>`;
  }

  function freezePublishedSnapshot(draft, contract = publishedAsset) {
    const snapshot = deepClone(draft);
    (snapshot.links || []).forEach(link => {
      ["source", "target"].forEach(side => {
        const fieldId = link[`${side}EndpointField`];
        if (!fieldId) return;
        const object = findObject(snapshot, link[`${side}ObjectId`]);
        const field = (contract.fields?.[object?.memberId] || []).find(item => item.id === fieldId);
        link[`${side}EndpointFieldStableId`] = link[`${side}EndpointFieldStableId`] || field?.stableId || null;
      });
    });
    return snapshot;
  }

  function buildFinancingDraft(id = "draft-financing") {
    return {
      id,
      ontologyStableId: "ONT-GROUP-FINANCING-OPTIMIZATION",
      name: "集团融资业务本体",
      definition: "统一表达融资主体、融资明细、融资机构、融资负责人及其成本、结构规则和受控行动。",
      scene: "集团融资成本与债务结构优化",
      owner: RESOURCE_OWNER,
      status: "编辑中",
      createdAt: nowText(),
      updatedAt: nowText(),
      objects: deepClone(objectTemplates),
      links: deepClone(linkTemplates),
      metrics: deepClone(metricTemplates),
      rules: deepClone(ruleTemplates),
      actionTypes: deepClone(actionTemplates),
      positions: deepClone(defaultPositions),
      validation: { status: "not-run", issues: [], ranAt: null, evidenceId: null },
      changeSummary: "建立融资业务语义骨架、数据映射、指标规则和行动类型。"
    };
  }

  function createInitialState() {
    const financingDraft = buildFinancingDraft();
    return {
      drafts: [financingDraft],
      activeDraftId: financingDraft.id,
      publishedVersions: [],
      selectedPublishedVersionId: null,
      currentFormalVersionId: null,
      records: [],
      seq: 0
    };
  }

  const ui = {
    modal: null,
    drawer: null,
    selectedNodeId: null,
    canvasView: "semantic",
    canvasZoom: window.innerWidth <= 1320 ? 0.5 : 0.55,
    resourceView: "list",
    resourceFilter: "全部",
    selectedMappingFieldId: null,
    selectedMappingPropertyId: null,
    assetChoice: "member.financing_subject_ref",
    resourceObjectId: null,
    linkObjectId: null,
    linkSourceObjectId: null,
    linkTargetObjectId: null,
    toastTimer: null,
    busy: null
  };

  let state = loadState();

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || !Array.isArray(saved.drafts) || !Array.isArray(saved.publishedVersions)) return createInitialState();
      const pointedVersion = saved.publishedVersions.find(version => version.id === saved.currentFormalVersionId && version.formalBinding);
      if (!pointedVersion) {
        const boundVersions = saved.publishedVersions.filter(version => version.formalBinding).sort((left, right) => {
          const leftTime = new Date(left.formalBinding.switchedAt || left.publishedAt || 0).getTime() || 0;
          const rightTime = new Date(right.formalBinding.switchedAt || right.publishedAt || 0).getTime() || 0;
          return rightTime - leftTime;
        });
        saved.currentFormalVersionId = boundVersions[0]?.id || null;
      }
      return saved;
    } catch (error) {
      return createInitialState();
    }
  }

  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function commit(mutator, options = {}) {
    if (typeof mutator === "function") mutator(state);
    saveState();
    render();
    if (options.toast) toast(options.toast, options.tone || "");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }
  function display(value, fallback = "—") { return value === null || value === undefined || value === "" ? fallback : escapeHtml(value); }
  function route() {
    const raw = location.hash.replace(/^#/, "") || "modeling";
    const [path, query = ""] = raw.split("?");
    return { path, params: new URLSearchParams(query) };
  }
  function navigate(path) { location.hash = path; }
  function activeDraft() { return state.drafts.find(item => item.id === state.activeDraftId) || state.drafts[0] || null; }
  function findDraft(id) { return state.drafts.find(item => item.id === id) || null; }
  function findVersion(id) { return state.publishedVersions.find(item => item.id === id) || null; }
  function publishedRouteVersionId(currentRoute = route()) {
    if (currentRoute.path === "published/resource") return currentRoute.params.get("version");
    if (currentRoute.path === "published/version") return currentRoute.params.get("id");
    return null;
  }
  function currentVersion() {
    const r = route();
    const routeVersionId = publishedRouteVersionId(r);
    if (routeVersionId) return findVersion(routeVersionId);
    return findVersion(state.selectedPublishedVersionId) || state.publishedVersions[0] || null;
  }
  function formalServiceVersion() {
    const version = findVersion(state.currentFormalVersionId);
    return version?.formalBinding ? version : null;
  }
  function isCurrentFormalVersion(version) {
    return !!version?.formalBinding && state.currentFormalVersionId === version.id;
  }
  function formalVersionRole(version) {
    return isCurrentFormalVersion(version) ? "current" : version?.formalBinding ? "historical" : "unbound";
  }
  function formalRoleStatus(version) {
    const role = formalVersionRole(version);
    return role === "current" ? status("当前正式使用", "blue") : role === "historical" ? status("历史正式记录", "neutral") : status("等待数据绑定", "amber");
  }
  function allResources(model) {
    if (!model) return [];
    const properties = (model.objects || []).flatMap(object => (object.properties || []).map(property => ({ ...property, kind: "Property", code: "P", parentObjectId: object.id, parentName: object.name })));
    return [
      ...(model.objects || []).map(item => ({ ...item, kind: "Object Type" })),
      ...properties,
      ...(model.links || []).map(item => ({ ...item, kind: "Link Type" })),
      ...(model.metrics || []).map(item => ({ ...item, kind: "Metric" })),
      ...(model.rules || []).map(item => ({ ...item, kind: "Rule" })),
      ...(model.actionTypes || []).map(item => ({ ...item, kind: "Action Type" }))
    ];
  }
  function findResource(model, id) { return allResources(model).find(item => item.id === id) || null; }
  function findObject(model, id) { return (model?.objects || []).find(item => item.id === id) || null; }
  function memberById(id) { return publishedAsset.members.find(item => item.id === id) || null; }
  function fieldsFor(object) { return object?.memberId ? (publishedAsset.fields[object.memberId] || []) : []; }
  function propertyById(object, id) { return (object?.properties || []).find(item => item.id === id) || null; }
  function objectByPropertyId(model, propertyId) { return (model?.objects || []).find(object => propertyById(object, propertyId)) || null; }
  function compatibleTypes(left, right) { return left === right || (left === "文本" && right === "枚举") || (left === "枚举" && right === "文本"); }
  function endpointToken(kind, objectId, id) { return `${kind}|${objectId}|${id}`; }
  function endpointCandidates(model, object) {
    if (!object) return [];
    const properties = (object.properties || [])
      .filter(property => property.sourceFieldId && (property.linkEndpoint || property.id === object.identityPropertyId))
      .map(property => ({ kind: "property", objectId: object.id, id: property.id, label: `${property.name} · Property${property.id === object.identityPropertyId ? " · 身份" : " · Link 端点"}`, type: property.type, propertyId: property.id, fieldId: property.sourceFieldId }));
    const fields = fieldsFor(object)
      .filter(field => (object.linkEndpointFields || []).includes(field.id))
      .map(field => ({ kind: "field", objectId: object.id, id: field.id, label: `${field.name} · 成员字段 · Link 端点`, type: field.type, fieldId: field.id, stableId: field.stableId || null }));
    return [...properties, ...fields];
  }
  function resolveEndpointSelection(model, token) {
    const [kind, objectId, id] = String(token || "").split("|");
    const object = findObject(model, objectId);
    if (!object || !id) return null;
    if (kind === "property") {
      const property = propertyById(object, id);
      if (!property || !property.sourceFieldId || !(property.linkEndpoint || property.id === object.identityPropertyId)) return null;
      return { kind, objectId, id, propertyId: property.id, fieldId: property.sourceFieldId, label: property.name, type: property.type, mapped: !!property.sourceFieldId };
    }
    if (kind === "field") {
      const field = fieldsFor(object).find(item => item.id === id);
      const isEndpoint = (object.linkEndpointFields || []).includes(id);
      return field && isEndpoint ? { kind, objectId, id, fieldId: field.id, stableId: field.stableId || null, label: field.name, type: field.type, mapped: true } : null;
    }
    return null;
  }
  function resolveLinkEndpoint(model, link, side) {
    const objectId = link?.[`${side}ObjectId`];
    const propertyId = link?.[`${side}Endpoint`];
    const fieldId = link?.[`${side}EndpointField`];
    const token = propertyId ? endpointToken("property", objectId, propertyId) : fieldId ? endpointToken("field", objectId, fieldId) : "";
    return resolveEndpointSelection(model, token);
  }
  function endpointText(model, link, side) {
    const endpoint = resolveLinkEndpoint(model, link, side);
    return endpoint ? `${endpoint.label}（${endpoint.type}）` : "未设置";
  }
  function endpointOptionGroups(model) {
    return (model?.objects || []).map(object => {
      const options = endpointCandidates(model, object);
      return `<optgroup label="${escapeHtml(object.name)}">${options.length ? options.map(item => `<option value="${escapeHtml(endpointToken(item.kind, item.objectId, item.id))}">${escapeHtml(item.label)} · ${escapeHtml(item.type)}</option>`).join("") : `<option disabled>请先映射 Property 或选择资产成员</option>`}</optgroup>`;
    }).join("");
  }
  function endpointOptionsForObject(model, objectId, selected = "") {
    const object = findObject(model, objectId);
    const candidates = endpointCandidates(model, object);
    if (!candidates.length) return `<option value="">没有已配置的兼容端点</option>`;
    return `<option value="">选择端点</option>${candidates.map(item => {
      const token = endpointToken(item.kind, item.objectId, item.id);
      return `<option value="${escapeHtml(token)}" ${selected === token ? "selected" : ""}>${escapeHtml(item.label)} · ${escapeHtml(item.type)}</option>`;
    }).join("")}`;
  }
  function resetDraftValidation(draft) {
    if (!draft) return;
    draft.validation = { status: "not-run", issues: [], ranAt: null, evidenceId: null };
    draft.updatedAt = nowText();
  }
  function nextResourcePosition(draft, kind) {
    const configs = {
      link: { x: 250, y: 220, dx: 310, perRow: 3, row: 150 },
      metric: { x: 310, y: 340, dx: 250, perRow: 4, row: 175 },
      rule: { x: 460, y: 690, dx: 250, perRow: 4, row: 155 },
      action: { x: 710, y: 865, dx: 250, perRow: 3, row: 145 }
    };
    const config = configs[kind];
    const count = kind === "link" ? draft.links.length : kind === "metric" ? draft.metrics.length : kind === "rule" ? draft.rules.length : draft.actionTypes.length;
    return { x: config.x + (count % config.perRow) * config.dx, y: config.y + Math.floor(count / config.perRow) * config.row };
  }
  function resourceCounts(model) {
    return {
      objects: model?.objects?.length || 0,
      properties: model?.objects?.reduce((sum, item) => sum + (item.properties?.length || 0), 0) || 0,
      links: model?.links?.length || 0,
      metrics: model?.metrics?.length || 0,
      rules: model?.rules?.length || 0,
      actions: model?.actionTypes?.length || 0
    };
  }
  function mappingIssues(model) {
    const issues = [];
    (model?.objects || []).forEach(object => {
      if (!object.name || !object.definition) issues.push({ type: "对象", targetId: object.id, title: "Object Type 缺少业务名称或定义", location: "overview" });
      if (!object.memberId) issues.push({ type: "对象", targetId: object.id, title: `${object.name}尚未选择数据资产成员`, location: "data" });
      if (!object.identityPropertyId || !propertyById(object, object.identityPropertyId)) issues.push({ type: "对象", targetId: object.id, title: `${object.name}尚未设置有效的稳定身份`, location: "properties" });
      if (!object.titlePropertyId || !propertyById(object, object.titlePropertyId)) issues.push({ type: "对象", targetId: object.id, title: `${object.name}尚未设置有效的可读标题`, location: "properties" });
      (object.properties || []).forEach(property => {
        if (!property.name || !property.definition || !property.type) issues.push({ type: "属性", targetId: object.id, propertyId: property.id, title: `${object.name}存在定义不完整的 Property`, location: "properties" });
        if (property.type === "数值" && (!property.unit || property.unit === "待设置")) issues.push({ type: "属性", targetId: object.id, propertyId: property.id, title: `${object.name}.${property.name}尚未设置业务单位`, location: "properties" });
        if (!property.sourceFieldId) {
          issues.push({ type: "属性映射", targetId: object.id, propertyId: property.id, title: `${object.name}.${property.name}缺少来源字段映射`, location: "mapping" });
          return;
        }
        const field = fieldsFor(object).find(item => item.id === property.sourceFieldId);
        if (!field) issues.push({ type: "属性映射", targetId: object.id, propertyId: property.id, title: `${object.name}.${property.name}的来源字段已不存在`, location: "mapping" });
        else if (!compatibleTypes(field.type, property.type)) issues.push({ type: "属性映射", targetId: object.id, propertyId: property.id, title: `${object.name}.${property.name}的字段类型不兼容：${field.type} 与 ${property.type}`, location: "mapping" });
      });
    });
    (model?.links || []).forEach(link => {
      const source = findObject(model, link.sourceObjectId);
      const target = findObject(model, link.targetObjectId);
      if (!source || !target) {
        issues.push({ type: "关系", targetId: link.id, title: `${link.name}的关系对象不存在`, location: "workbench" });
        return;
      }
      const sourceEndpoint = resolveLinkEndpoint(model, link, "source");
      const targetEndpoint = resolveLinkEndpoint(model, link, "target");
      if (!sourceEndpoint) issues.push({ type: "关系", targetId: source.id, title: `${link.name}的起点端点未设置或已失效`, location: "relations" });
      if (!targetEndpoint) issues.push({ type: "关系", targetId: target.id, title: `${link.name}的终点端点未设置或已失效`, location: "relations" });
      if (sourceEndpoint && !sourceEndpoint.mapped) issues.push({ type: "关系", targetId: source.id, propertyId: sourceEndpoint.propertyId, title: `${link.name}的起点 Property 未完成字段映射`, location: "mapping" });
      if (targetEndpoint && !targetEndpoint.mapped) issues.push({ type: "关系", targetId: target.id, propertyId: targetEndpoint.propertyId, title: `${link.name}的终点 Property 未完成字段映射`, location: "mapping" });
      if (sourceEndpoint && targetEndpoint && !compatibleTypes(sourceEndpoint.type, targetEndpoint.type)) issues.push({ type: "关系", targetId: link.id, title: `${link.name}的端点类型不兼容：${sourceEndpoint.type} 与 ${targetEndpoint.type}`, location: "workbench" });
      if (!link.name || !link.definition || !link.cardinality) issues.push({ type: "关系", targetId: source.id, title: "Link Type 缺少业务名称、定义或基数", location: "relations" });
    });
    return issues;
  }

  function businessLogicIssues(model) {
    const issues = [];
    const resources = allResources(model);
    const resourceById = id => resources.find(item => item.id === id);
    (model?.metrics || []).forEach(metric => {
      const incomplete = !metric.name || !metric.definition || !metric.objectId || !metric.unit || !metric.scope || !metric.time || !metric.zeroHandling || !(metric.depends || []).length;
      if (incomplete) issues.push({ type: "业务逻辑", targetId: metric.id, title: `${metric.name || "Metric"}合同不完整`, location: "logic" });
      if (!findObject(model, metric.objectId)) issues.push({ type: "业务逻辑", targetId: metric.id, title: `${metric.name}的适用对象不存在`, location: "logic" });
      if ((metric.depends || []).some(id => !resourceById(id))) issues.push({ type: "业务逻辑", targetId: metric.id, title: `${metric.name}存在失效依赖`, location: "logic" });
    });
    (model?.rules || []).forEach(rule => {
      const incomplete = !rule.name || !rule.definition || !rule.objectId || !rule.condition || !rule.evidence || !(rule.depends || []).length;
      if (incomplete) issues.push({ type: "业务逻辑", targetId: rule.id, title: `${rule.name || "Rule"}合同不完整`, location: "logic" });
      if (!findObject(model, rule.objectId)) issues.push({ type: "业务逻辑", targetId: rule.id, title: `${rule.name}的适用对象不存在`, location: "logic" });
      if ((rule.depends || []).some(id => resourceById(id)?.kind !== "Metric")) issues.push({ type: "业务逻辑", targetId: rule.id, title: `${rule.name}必须依赖有效 Metric`, location: "logic" });
    });
    (model?.actionTypes || []).forEach(action => {
      const incomplete = !action.name || !action.definition || !action.objectId || !action.parameters || !action.prerequisite || !action.result || action.confirmation !== "必须人工确认" || !(action.depends || []).length;
      if (incomplete) issues.push({ type: "业务逻辑", targetId: action.id, title: `${action.name || "Action Type"}合同不完整`, location: "logic" });
      if (!findObject(model, action.objectId)) issues.push({ type: "业务逻辑", targetId: action.id, title: `${action.name}的目标对象不存在`, location: "logic" });
      if ((action.depends || []).some(id => !["Rule", "Link Type"].includes(resourceById(id)?.kind))) issues.push({ type: "业务逻辑", targetId: action.id, title: `${action.name}存在无效规则或关系依赖`, location: "logic" });
    });
    if (!(model?.metrics || []).length) issues.push({ type: "业务逻辑", targetId: "", title: "至少需要创建一个 Metric", location: "logic" });
    if (!(model?.rules || []).length) issues.push({ type: "业务逻辑", targetId: "", title: "至少需要创建一个 Rule", location: "logic" });
    if (!(model?.actionTypes || []).length) issues.push({ type: "业务逻辑", targetId: "", title: "至少需要创建一个 Action Type", location: "logic" });
    return issues;
  }

  function validationIssues(model) {
    const issues = [];
    const ontologyIdValid = /^ONT-[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(model?.ontologyStableId || "");
    if (!ontologyIdValid) issues.push({ type: "本体", targetId: "", title: "本体缺少有效的稳定语义身份", location: "workbench" });
    if (!(model?.objects || []).length) issues.push({ type: "对象", targetId: "", title: "本体至少需要一个 Object Type", location: "object-create" });
    const resources = allResources(model);
    const seenIds = new Set();
    resources.forEach(resource => {
      const valid = /^(OBJ|PROP|LINK|MET|RULE|ACTION)-[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(resource.id || "");
      const ownerObject = resource.kind === "Property" ? resource.parentObjectId : resource.kind === "Object Type" ? resource.id : "";
      const location = resource.kind === "Property" ? "properties" : ["Metric", "Rule", "Action Type"].includes(resource.kind) ? "logic" : "workbench";
      if (!valid) issues.push({ type: "稳定身份", targetId: ownerObject || resource.id, propertyId: resource.kind === "Property" ? resource.id : "", title: `${resource.name || resource.kind}的稳定语义身份格式无效`, location });
      if (seenIds.has(resource.id)) issues.push({ type: "稳定身份", targetId: ownerObject || resource.id, propertyId: resource.kind === "Property" ? resource.id : "", title: `${resource.name || resource.kind}的稳定语义身份重复`, location });
      seenIds.add(resource.id);
    });
    issues.push(...mappingIssues(model), ...businessLogicIssues(model));
    return issues;
  }

  function status(text, tone = "neutral", pulse = false) { return `<span class="status ${escapeHtml(tone)}${pulse ? " pulse" : ""}"><i></i>${escapeHtml(text)}</span>`; }
  function icon(name) {
    const paths = {
      home: '<path d="M3 11.5 12 4l9 7.5v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
      model: '<circle cx="7" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><circle cx="12" cy="17" r="3"/><path d="m9.5 8.8 1.6 5M14.5 8.8l-1.6 5M10 7h4"/>',
      published: '<path d="M5 3h10l4 4v14H5z"/><path d="M15 3v5h5M8 13h8M8 17h6"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      arrow: '<path d="m9 18 6-6-6-6"/>',
      back: '<path d="m15 18-6-6 6-6"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      warning: '<path d="M12 3 2.8 20h18.4z"/><path d="M12 9v4M12 17h.01"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
      more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
      link: '<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/>',
      database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
      history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
      close: '<path d="m6 6 12 12M18 6 6 18"/>',
      eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.5"/>',
      refresh: '<path d="M20 6v5h-5M4 18v-5h5"/><path d="M6.1 9a7 7 0 0 1 11.4-2L20 11M4 13l2.5 4a7 7 0 0 0 11.4-2"/>',
      layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
      reset: '<path d="M4 4v6h6M20 20v-6h-6"/><path d="M6.5 17.5A8 8 0 0 0 20 12M4 12A8 8 0 0 1 17.5 6.5"/>',
      chevron: '<path d="m9 18 6-6-6-6"/>'
    };
    return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.more}</svg>`;
  }
  function button(label, action, options = {}) {
    const classes = ["btn", options.primary ? "primary" : "", options.danger ? "danger" : "", options.quiet ? "quiet" : "", options.small ? "small" : ""].filter(Boolean).join(" ");
    return `<button type="button" class="${classes}" data-action="${escapeHtml(action)}"${options.value ? ` data-value="${escapeHtml(options.value)}"` : ""}${options.disabled ? " disabled" : ""}>${options.icon ? icon(options.icon) : ""}<span>${escapeHtml(label)}</span></button>`;
  }
  function emptyState(title, text, action = "", label = "", value = "") {
    return `<div class="empty-state"><span class="empty-mark">${icon("layers")}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p>${action ? button(label, action, { primary: true, value }) : ""}</div>`;
  }
  function fact(label, value, mono = false) { return `<div class="fact"><span>${escapeHtml(label)}</span><b class="${mono ? "mono" : ""}">${value}</b></div>`; }
  function tabBar(tabs, active, action = "set-tab") {
    return `<div class="tabs">${tabs.map(([id, label]) => `<button type="button" class="tab ${active === id ? "active" : ""}" data-action="${action}" data-value="${id}">${escapeHtml(label)}</button>`).join("")}</div>`;
  }
  function toast(message, tone = "") {
    const region = document.getElementById("toast-region");
    if (!region) return;
    region.innerHTML = `<div class="toast ${escapeHtml(tone)}">${tone === "error" ? icon("warning") : icon("check")}<span>${escapeHtml(message)}</span></div>`;
    clearTimeout(ui.toastTimer);
    ui.toastTimer = setTimeout(() => { if (region) region.innerHTML = ""; }, 3200);
  }

  function pageMeta(path) {
    if (path.startsWith("published/resource")) return ["已发布本体", "资源详情"];
    if (path.startsWith("published/version")) return ["已发布本体", "版本详情"];
    if (path === "published") return ["已发布本体", "版本目录"];
    if (path.startsWith("modeling/mapping")) return ["本体建模", "字段映射"];
    if (path.startsWith("modeling/object")) return ["本体建模", "对象配置"];
    if (path.startsWith("modeling/validation")) return ["本体建模", "统一校验"];
    if (path.startsWith("modeling/workbench")) return ["本体建模", "本体建模工作台"];
    return ["本体建模", "工作区"];
  }

  function shell(content) {
    const r = route();
    const section = r.path.startsWith("published") ? "published" : "modeling";
    const [module, page] = pageMeta(r.path);
    return `<div class="app-shell">
      <aside class="platform-rail" aria-label="平台导航">
        <span class="platform-logo" aria-label="ontology3.0">O</span>
        <nav class="platform-icons">
          <button type="button" title="数据中心" data-action="open-module" data-value="data">${icon("database")}<span>数</span></button>
          <button type="button" class="active" title="本体管理">${icon("model")}<span>本</span></button>
          <button type="button" title="智能问数" data-action="open-module" data-value="query">${icon("search")}<span>问</span></button>
          <button type="button" title="决策中心" data-action="open-module" data-value="decision">${icon("layers")}<span>策</span></button>
        </nav>
        <div class="rail-spacer"></div>
        <button class="rail-tool" type="button" data-action="open-reset" title="重置状态" aria-label="重置状态">${icon("reset")}</button>
      </aside>
      <aside class="product-nav">
        <div class="product-nav-head"><span class="product-symbol">OM</span><div><strong>本体管理</strong><small>语义建模与发布</small></div></div>
        <div class="product-nav-label">工作区</div>
        <nav class="product-nav-list">
          <button type="button" class="product-nav-item ${section === "modeling" ? "active" : ""}" data-action="go-modeling">${icon("model")}<span>本体建模</span></button>
          <button type="button" class="product-nav-item ${section === "published" ? "active" : ""}" data-action="go-published">${icon("published")}<span>已发布本体</span>${state.publishedVersions.length ? `<em>${state.publishedVersions.length}</em>` : ""}</button>
        </nav>
        <div class="product-nav-foot"><strong>单账号工作区</strong><span>当前账号可完成建模、发布与数据切换。</span></div>
      </aside>
      <section class="workspace">
        <header class="workspace-topbar"><div class="crumbs"><span>本体管理</span><i>/</i><strong>${escapeHtml(module)}</strong><i>/</i><span>${escapeHtml(page)}</span></div><div class="top-actions"><div class="account-block"><span>管</span><div><strong>平台管理员</strong><small>单账号工作区</small></div></div></div></header>
        <main class="main" data-screen-label="${escapeHtml(page)}">${content}</main>
      </section>
      ${renderOverlay()}
    </div>`;
  }

  function render() {
    const r = route();
    let content = "";
    if (r.path === "modeling") content = renderModelingHome();
    else if (r.path === "modeling/workbench") content = renderWorkbench(r.params);
    else if (r.path === "modeling/object") content = renderObjectDetail(r.params);
    else if (r.path === "modeling/mapping") content = renderMappingWorkspace(r.params);
    else if (r.path === "modeling/validation") content = renderValidation(r.params);
    else if (r.path === "published") content = renderPublishedHome();
    else if (r.path === "published/version") content = renderVersionDetail(r.params);
    else if (r.path === "published/resource") content = renderPublishedResource(r.params);
    else content = renderModelingHome();
    document.getElementById("app").innerHTML = shell(content);
    requestAnimationFrame(() => {
      if (r.path === "modeling/workbench") setupCanvas();
      if (r.path === "modeling/mapping") drawMappingLines();
      if (r.path === "published/version" && ui.resourceView === "graph") drawSemanticEdges(currentVersion()?.snapshot);
    });
  }

  function headline(eyebrow, title, description, actions = "") {
    return `<header class="page-head"><div><span class="eyebrow">${escapeHtml(eyebrow)}</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div><div class="page-actions">${actions}</div></header>`;
  }

  function renderModelingHome() {
    const drafts = state.drafts.filter(item => item.status !== "已发布");
    const issueCount = drafts.reduce((sum, draft) => sum + mappingIssues(draft).length, 0);
    const pendingUpdates = state.publishedVersions.reduce((sum, version) => sum + (version.update && version.update.status !== "switched" ? 1 : 0), 0);
    const draftCards = drafts.length ? drafts.map(draft => {
      const counts = resourceCounts(draft);
      const issues = mappingIssues(draft);
      return `<article class="draft-card"><div class="draft-card-head"><div class="resource-avatar object">O</div><div><h3>${escapeHtml(draft.name)}</h3><p>${escapeHtml(draft.definition)}</p><small class="mono">${escapeHtml(draft.ontologyStableId)}</small></div>${status("编辑中", "blue")}</div><div class="draft-meta"><span>${escapeHtml(draft.scene)}</span><span>更新于 ${escapeHtml(draft.updatedAt)}</span></div><div class="draft-progress"><div><span>结构与逻辑</span><b>${counts.objects + counts.properties + counts.links + counts.metrics + counts.rules + counts.actions} 项资源</b></div><div><span>数据映射</span><b class="${issues.length ? "warning-text" : "success-text"}">${issues.length ? `${issues.length} 项待处理` : "已完整"}</b></div><div><span>统一校验</span><b>${draft.validation.status === "passed" ? "已通过" : draft.validation.status === "failed" ? "有阻断" : "未运行"}</b></div></div><footer><button type="button" class="text-link" data-action="open-draft" data-value="${draft.id}">查看详情</button>${button("继续建模", "open-draft", { value: draft.id, primary: true })}</footer></article>`;
    }).join("") : emptyState("还没有编辑中的本体", "先创建本体 Draft，再建立 Object Type 业务骨架。", "open-create-draft", "创建本体");

    return `<div class="page-wrap">${headline("本体建模", "本体建模工作台", "从业务骨架开始建模，在对象内部选择已发布数据资产并完成映射；校验通过后才能发布。", button("创建本体", "open-create-draft", { primary: true, icon: "plus" }))}
      <section class="summary-grid">
        ${fact("编辑中的本体", `<span class="metric-number">${drafts.length}</span>`)}
        ${fact("已发布语义版本", `<span class="metric-number">${state.publishedVersions.length}</span>`)}
        ${fact("待处理映射问题", `<span class="metric-number ${issueCount ? "amber" : ""}">${issueCount}</span>`)}
        ${fact("待更新数据", `<span class="metric-number">${pendingUpdates}</span>`)}
      </section>
      <section class="section-block"><div class="section-head"><div><h2>编辑中的本体</h2><p>Draft 只在建模工作区可见，不进入已发布资源目录。</p></div></div><div class="draft-list">${draftCards}</div></section>
      <section class="section-block compact"><div class="section-head"><div><h2>建模顺序</h2><p>每一步都保留原位置和恢复入口。</p></div></div><div class="lifecycle-row"><span><b>1</b>创建本体 Draft</span><i></i><span><b>2</b>建立对象骨架</span><i></i><span><b>3</b>对象内选择资产成员</span><i></i><span><b>4</b>显式创建并映射属性</span><i></i><span><b>5</b>统一校验与发布</span></div></section>
    </div>`;
  }

  function renderWorkbench(params) {
    const draft = findDraft(params.get("id")) || activeDraft();
    if (!draft) return emptyState("找不到本体 Draft", "它可能已经发布或被移除。", "go-modeling", "返回本体建模");
    if (draft.status === "已发布") {
      const version = [...state.publishedVersions].reverse().find(item => item.sourceDraftId === draft.id || item.ontologyStableId === draft.ontologyStableId);
      return `<div class="page-wrap narrow">${headline("本体建模", "此 Draft 已完成发布", "已发布内容保持只读；继续修改需要从精确语义版本创建修订 Draft。")}${emptyState("当前 Draft 不可继续编辑", version ? `${version.label} 已保留发布时的结构、映射、校验和版本证据。` : "请从已发布本体选择精确版本。", version ? "open-version" : "go-published", version ? "查看已发布版本" : "前往已发布本体", version?.id || "")}</div>`;
    }
    state.activeDraftId = draft.id;
    const counts = resourceCounts(draft);
    const issues = validationIssues(draft);
    const selected = findResource(draft, ui.selectedNodeId) || draft.objects[0] || null;
    const groups = [
      ["Object Type", draft.objects, "object"], ["Link Type", draft.links, "link"], ["Metric", draft.metrics, "metric"], ["Rule", draft.rules, "rule"], ["Action Type", draft.actionTypes, "action"]
    ];
    const tree = groups.map(([label, items, type]) => `<section class="tree-group"><header><span>${escapeHtml(label)}</span><em>${items.length}</em></header>${items.map(item => `<button type="button" class="tree-item ${ui.selectedNodeId === item.id ? "active" : ""}" data-action="select-node" data-value="${item.id}"><i class="type-dot ${type}"></i><span>${escapeHtml(item.displayCode ? `${item.displayCode} ${item.name}` : item.name)}</span>${item.kind === "Object Type" ? "" : icon("chevron")}</button>`).join("") || `<div class="tree-empty">尚未创建</div>`}</section>`).join("");
    const canvas = ui.canvasView === "semantic" ? renderSemanticCanvas(draft) : renderLineageCanvas(draft);
    const selectedKind = selected?.kind || (draft.objects.some(item => item.id === selected?.id) ? "Object Type" : "语义资源");
    const compactActions = selected ? selectedKind === "Object Type"
      ? `${button("查看详情", "open-object", { value: selected.id, primary: true, small: true })}${button("配置映射", "open-object-mapping", { value: selected.id, small: true })}`
      : button("查看详情", "open-draft-resource", { value: selected.id, primary: true, small: true }) : "";
    return `<div class="workbench-page">
      <header class="workbench-toolbar"><button type="button" class="back-button" data-action="go-modeling">${icon("back")}<span>本体建模</span></button><div class="workbench-title"><h1>${escapeHtml(draft.name)}</h1><span>${status("Draft", "blue")}<em>${counts.objects} 对象 · ${counts.links} 关系 · ${counts.metrics} 指标</em></span></div><div class="view-switch"><button type="button" class="${ui.canvasView === "semantic" ? "active" : ""}" data-action="canvas-view" data-value="semantic">语义结构</button><button type="button" class="${ui.canvasView === "lineage" ? "active" : ""}" data-action="canvas-view" data-value="lineage">数据沿袭</button></div><div class="toolbar-actions">${button("添加 Object", "open-add-object", { icon: "plus" })}${button("添加语义资源", "open-resource-picker", { icon: "plus" })}${button("统一校验", "open-validation", { primary: true, icon: "check" })}</div></header>
      <div class="workbench-grid">
        <aside class="resource-tree"><div class="tree-search">${icon("search")}<input aria-label="搜索语义资源" placeholder="搜索语义资源" /></div><div class="tree-scroll">${tree}</div><footer><span class="${issues.length ? "warning-dot" : "success-dot"}"></span>${issues.length ? `${issues.length} 项需要处理` : "结构与映射完整"}</footer></aside>
        <section class="model-canvas-shell"><div class="canvas-meta"><span>${ui.canvasView === "semantic" ? "语义结构" : "只读数据沿袭"}</span><small>${ui.canvasView === "semantic" ? "拖动节点可调整布局，连接线会实时跟随" : "上游链路由数据工程提供，本工作区不可编辑"}</small></div>${canvas}${selected ? `<div class="compact-resource-actions"><div><span>${escapeHtml(selectedKind)}</span><strong>${escapeHtml(selected.name)}</strong></div><div>${compactActions}</div></div>` : ""}<div class="zoom-controls"><button type="button" data-action="zoom-out">−</button><span>${Math.round(ui.canvasZoom * 100)}%</span><button type="button" data-action="zoom-in">＋</button><button type="button" data-action="zoom-reset">适配</button></div></section>
        <aside class="model-inspector">${renderInspector(draft, selected, issues)}</aside>
      </div>
    </div>`;
  }

  function renderSemanticCanvas(draft, readOnly = false) {
    const nodeHtml = [
      ...draft.objects.map(item => semanticNode(item, "object", draft.positions[item.id] || { x: 80, y: 80 }, readOnly, draft)),
      ...draft.links.map(item => semanticNode(item, "link", draft.positions[item.id] || nextResourcePosition(draft, "link"), readOnly, draft)),
      ...draft.metrics.map(item => semanticNode(item, "metric", draft.positions[item.id] || { x: 400, y: 400 }, readOnly, draft)),
      ...draft.rules.map(item => semanticNode(item, "rule", draft.positions[item.id] || { x: 700, y: 650 }, readOnly, draft)),
      ...draft.actionTypes.map(item => semanticNode(item, "action", draft.positions[item.id] || { x: 900, y: 820 }, readOnly, draft))
    ].join("");
    return `<div class="model-canvas" data-canvas-mode="semantic"><div class="canvas-stage" style="transform:scale(${ui.canvasZoom});"><svg class="edge-layer" width="1500" height="1050" aria-hidden="true"><defs><marker id="arrow-semantic" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8z"></path></marker></defs><g data-edge-group></g></svg>${nodeHtml}</div></div>`;
  }

  function semanticNode(item, type, position, readOnly, model) {
    const label = item.displayCode ? `${item.displayCode} · ${item.name}` : item.name;
    const sub = type === "object" ? `${item.properties?.length || 0} 属性 · ${item.memberId ? "已选数据资产成员" : "未选数据资产成员"}` : type === "link" ? `${item.direction || "方向待设置"} · ${item.cardinality || "基数待设置"}` : type === "metric" ? `${item.unit} · ${item.time}` : type === "rule" ? "依赖指标判断" : "需人工确认后形成待办";
    const nodeIssue = type === "object" ? mappingIssues({ objects: [item], links: [] }).length : type === "link" ? !resolveLinkEndpoint(model, item, "source") || !resolveLinkEndpoint(model, item, "target") : false;
    return `<button type="button" class="semantic-node ${type} ${ui.selectedNodeId === item.id ? "selected" : ""}" data-node-id="${item.id}" data-action="${readOnly ? "open-published-resource" : "select-node"}" data-value="${item.id}" style="left:${position.x}px;top:${position.y}px" ${readOnly ? "data-readonly=\"true\"" : ""}><span class="node-type">${escapeHtml(item.code || type[0].toUpperCase())}</span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(sub)}</small><em class="node-state">${readOnly ? "已发布" : nodeIssue ? "配置待处理" : "已配置"}</em></button>`;
  }

  function fieldLineage(draft, object, field) {
    const properties = (object?.properties || []).filter(property => property.sourceFieldId === field.id);
    const linkNames = (draft?.links || []).filter(link => {
      const directSource = link.sourceObjectId === object?.id && link.sourceEndpointField === field.id;
      const directTarget = link.targetObjectId === object?.id && link.targetEndpointField === field.id;
      const propertySource = link.sourceObjectId === object?.id && properties.some(property => property.id === link.sourceEndpoint);
      const propertyTarget = link.targetObjectId === object?.id && properties.some(property => property.id === link.targetEndpoint);
      return directSource || directTarget || propertySource || propertyTarget;
    }).map(link => link.name);
    return {
      properties,
      linkNames,
      endpoint: (object?.linkEndpointFields || []).includes(field.id)
        || properties.some(property => property.linkEndpoint)
        || linkNames.length > 0
    };
  }

  function propertyIsLinkEndpoint(draft, object, property) {
    if (!draft || !object || !property) return false;
    if (property.linkEndpoint) return true;
    return (draft.links || []).some(link => (
      (link.sourceObjectId === object.id && link.sourceEndpoint === property.id)
      || (link.targetObjectId === object.id && link.targetEndpoint === property.id)
    ));
  }

  function propertyLinkNames(draft, object, property) {
    if (!draft || !object || !property) return [];
    return (draft.links || []).filter(link => (
      (link.sourceObjectId === object.id && link.sourceEndpoint === property.id)
      || (link.targetObjectId === object.id && link.targetEndpoint === property.id)
    )).map(link => link.name);
  }

  function renderLineageCanvas(draft) {
    const rowCenter = index => 145 + index * 210;
    const memberNodes = publishedAsset.members.map((member, index) => `<button type="button" class="data-node member" data-action="open-lineage-detail" data-value="${member.id}" style="left:830px;top:${90 + index * 210}px"><span class="data-index">${String(index + 1).padStart(2, "0")}</span>${icon("database")}<strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(member.grain)}</small><em>${member.rows.toLocaleString()} 行</em><i class="data-port input"></i><i class="data-port output"></i></button>`).join("");
    const fieldGroupNodes = publishedAsset.members.map((member, index) => {
      const object = draft.objects.find(item => item.memberId === member.id);
      const fields = publishedAsset.fields[member.id] || [];
      const mapped = fields.filter(field => fieldLineage(draft, object, field).properties.length).length;
      const endpoints = fields.filter(field => fieldLineage(draft, object, field).endpoint).length;
      return `<button type="button" class="data-node field-group" data-action="open-lineage-detail" data-value="fields:${member.id}" style="left:1105px;top:${76 + index * 210}px"><span class="data-index">字段组</span>${icon("link")}<strong>${escapeHtml(member.name)}字段</strong><small>${fields.slice(0, 3).map(field => escapeHtml(field.name)).join(" · ")}${fields.length > 3 ? "…" : ""}</small><div class="field-group-counts"><span>${mapped} Property</span><span>${endpoints} Link 端点</span></div><i class="data-port input"></i><i class="data-port output"></i></button>`;
    }).join("");
    const objectNodes = publishedAsset.members.map((member, index) => {
      const object = draft.objects.find(item => item.memberId === member.id);
      return object ? `<button type="button" class="semantic-node object lineage-object" data-action="select-node" data-value="${object.id}" style="left:1410px;top:${96 + index * 210}px"><span class="node-type">O</span><strong>${escapeHtml(object.name)}</strong><small>${object.properties.length} Property · ${draft.links.filter(link => link.sourceObjectId === object.id || link.targetObjectId === object.id).length} Link</small><em class="node-state">${mappingIssues(draft).some(issue => issue.targetId === object.id) ? "映射待处理" : "映射完整"}</em></button>` : `<div class="semantic-node object lineage-object empty-lineage-object" style="left:1410px;top:${96 + index * 210}px"><span class="node-type">O</span><strong>${escapeHtml(member.target)}</strong><small>${escapeHtml(member.name)}</small><em class="node-state">尚未建立对象绑定</em></div>`;
    }).join("");
    const sourcePaths = `<path class="upstream" d="M195 375 C230 375 240 375 280 375"/>`;
    const memberPaths = publishedAsset.members.map((member, index) => {
      const y = rowCenter(index);
      const object = draft.objects.find(item => item.memberId === member.id);
      const fields = publishedAsset.fields[member.id] || [];
      const hasProperty = !!object && fields.some(field => fieldLineage(draft, object, field).properties.length);
      const hasEndpoint = !!object && fields.some(field => fieldLineage(draft, object, field).endpoint);
      return `<path d="M725 375 C770 375 780 ${y} 830 ${y}"/><path d="M1005 ${y} C1045 ${y} 1060 ${y} 1105 ${y}"/>${hasProperty ? `<path class="property-map" d="M1350 ${y - 10} C1370 ${y - 10} 1380 ${y - 5} 1410 ${y - 5}"/>` : ""}${hasEndpoint ? `<path class="endpoint-map" d="M1350 ${y + 10} C1370 ${y + 10} 1380 ${y + 15} 1410 ${y + 15}"/>` : ""}`;
    }).join("");
    return `<div class="model-canvas" data-canvas-mode="lineage"><div class="lineage-banner">${icon("eye")}只读数据沿袭 · 选择字段组可查看 Property 与 Link 端点证据</div><div class="canvas-stage lineage-stage" style="transform:scale(${ui.canvasZoom});"><svg class="edge-layer lineage" width="1690" height="980" aria-hidden="true"><defs><marker id="arrow-lineage" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8z"></path></marker></defs>${sourcePaths}<path d="M455 375 C495 375 510 375 550 375"/>${memberPaths}</svg><button class="data-node source" type="button" data-action="open-lineage-detail" data-value="source:workbook" style="left:20px;top:320px"><span class="data-index">来源</span>${icon("database")}<strong>融资一览表</strong><small>手工上传工作簿</small><em>当前资产来源</em><i class="data-port output"></i></button><button class="data-node process" type="button" data-action="open-lineage-detail" data-value="pipeline" style="left:280px;top:320px"><span class="data-index">管道</span>${icon("refresh")}<strong>融资数据标准化管道</strong><small>汇聚、标准化与质量检查</small><em>数据工程维护</em><i class="data-port input"></i><i class="data-port output"></i></button><button class="data-node asset" type="button" data-action="open-lineage-detail" data-value="asset" style="left:550px;top:320px"><span class="data-index">资产</span>${icon("layers")}<strong>融资标准化数据资产</strong><small>${escapeHtml(publishedAsset.versionLabel)}</small><em>${escapeHtml(publishedAsset.asOf)}</em><i class="data-port input"></i><i class="data-port output"></i></button>${memberNodes}${fieldGroupNodes}${objectNodes}</div></div>`;
  }

  function renderInspector(draft, selected, issues) {
    if (!selected) return emptyState("选择一个语义资源", "查看定义、稳定身份、依赖和映射状态。");
    const kind = selected.kind || (draft.objects.some(item => item.id === selected.id) ? "Object Type" : draft.links.some(item => item.id === selected.id) ? "Link Type" : draft.metrics.some(item => item.id === selected.id) ? "Metric" : draft.rules.some(item => item.id === selected.id) ? "Rule" : "Action Type");
    const resourceIssues = issues.filter(issue => issue.targetId === selected.id || issue.propertyId === selected.id);
    const actions = kind === "Object Type" ? `${button("查看详情", "open-object", { value: selected.id, primary: true })}${button("配置映射", "open-object-mapping", { value: selected.id })}` : button("查看详情", "open-draft-resource", { value: selected.id, primary: true });
    return `<div class="inspector-head"><span class="resource-avatar ${kind === "Object Type" ? "object" : kind === "Metric" ? "metric" : kind === "Rule" ? "rule" : kind === "Action Type" ? "action" : "link"}">${escapeHtml(selected.code || "L")}</span><div><small>${escapeHtml(kind)}</small><h2>${escapeHtml(selected.name)}</h2></div></div><p class="inspector-definition">${escapeHtml(selected.definition || "尚未补充业务定义。")}</p><dl class="key-values"><dt>稳定语义身份</dt><dd class="mono">${escapeHtml(selected.id)}</dd><dt>适用场景</dt><dd>${escapeHtml(draft.scene)}</dd><dt>Owner</dt><dd>${RESOURCE_OWNER}</dd><dt>状态</dt><dd>${status("Draft", "blue")}</dd></dl>${resourceIssues.length ? `<div class="inline-alert warning">${icon("warning")}<div><strong>${resourceIssues.length} 项需要处理</strong><span>${escapeHtml(resourceIssues[0].title)}</span></div></div>` : `<div class="inline-alert success">${icon("check")}<div><strong>当前配置完整</strong><span>仍需通过统一校验后才能发布。</span></div></div>`}<div class="inspector-actions">${actions}</div>`;
  }

  function setupCanvas() {
    if (ui.canvasView !== "semantic") return;
    const canvas = document.querySelector(".model-canvas[data-canvas-mode='semantic']");
    const stage = canvas?.querySelector(".canvas-stage");
    const draft = activeDraft();
    if (!canvas || !stage || !draft) return;
    drawSemanticEdges(draft);
    stage.querySelectorAll(".semantic-node:not([data-readonly='true'])").forEach(node => {
      node.addEventListener("pointerdown", event => {
        if (event.button !== 0) return;
        event.preventDefault();
        const id = node.dataset.nodeId;
        const start = { x: event.clientX, y: event.clientY, left: parseFloat(node.style.left), top: parseFloat(node.style.top) };
        node.setPointerCapture(event.pointerId);
        node.classList.add("dragging");
        const move = moveEvent => {
          const nextX = Math.max(20, Math.min(1300, start.left + (moveEvent.clientX - start.x) / ui.canvasZoom));
          const nextY = Math.max(30, Math.min(930, start.top + (moveEvent.clientY - start.y) / ui.canvasZoom));
          node.style.left = `${nextX}px`;
          node.style.top = `${nextY}px`;
          draft.positions[id] = { x: nextX, y: nextY };
          drawSemanticEdges(draft);
        };
        const up = () => {
          node.classList.remove("dragging");
          node.removeEventListener("pointermove", move);
          node.removeEventListener("pointerup", up);
          node.removeEventListener("pointercancel", up);
          draft.updatedAt = nowText();
          saveState();
        };
        node.addEventListener("pointermove", move);
        node.addEventListener("pointerup", up);
        node.addEventListener("pointercancel", up);
      });
    });
  }

  function drawSemanticEdges(model) {
    const group = document.querySelector("[data-edge-group]");
    if (!group) return;
    const nodePos = id => {
      const node = document.querySelector(`[data-node-id="${CSS.escape(id)}"]`);
      if (!node) return null;
      return { x: parseFloat(node.style.left), y: parseFloat(node.style.top), w: node.offsetWidth || 176, h: node.offsetHeight || 96 };
    };
    const edges = [];
    const canvasResourceId = dependencyId => {
      if (nodePos(dependencyId)) return dependencyId;
      const object = objectByPropertyId(model, dependencyId);
      return object?.id || null;
    };
    (model.links || []).forEach(link => {
      edges.push({ from: link.sourceObjectId, to: link.id, label: "起点", tone: "link" });
      edges.push({ from: link.id, to: link.targetObjectId, label: link.cardinality || "关系", tone: "link" });
    });
    (model.metrics || []).forEach(metric => (metric.depends || []).forEach(dep => {
      const from = canvasResourceId(dep);
      if (from && from !== metric.id) edges.push({ from, to: metric.id, label: "计算依赖", tone: "metric" });
    }));
    (model.rules || []).forEach(rule => (rule.depends || []).forEach(dep => {
      const from = canvasResourceId(dep);
      if (from) edges.push({ from, to: rule.id, label: "判断", tone: "rule" });
    }));
    (model.actionTypes || []).forEach(action => (action.depends || []).forEach(dep => {
      const from = canvasResourceId(dep);
      if (from) edges.push({ from, to: action.id, label: "允许请求", tone: "action" });
    }));
    group.innerHTML = edges.map(edge => {
      const from = nodePos(edge.from); const to = nodePos(edge.to);
      if (!from || !to) return "";
      const x1 = from.x + from.w; const y1 = from.y + from.h / 2; const x2 = to.x; const y2 = to.y + to.h / 2;
      const vertical = Math.abs(x2 - x1) < 80;
      const d = vertical ? `M${from.x + from.w / 2} ${from.y + from.h} C${from.x + from.w / 2} ${from.y + from.h + 60} ${to.x + to.w / 2} ${to.y - 60} ${to.x + to.w / 2} ${to.y}` : `M${x1} ${y1} C${x1 + Math.max(55, Math.abs(x2 - x1) * .42)} ${y1} ${x2 - Math.max(55, Math.abs(x2 - x1) * .42)} ${y2} ${x2} ${y2}`;
      const lx = vertical ? (from.x + to.x + from.w) / 2 : (x1 + x2) / 2; const ly = vertical ? (from.y + from.h + to.y) / 2 : (y1 + y2) / 2;
      return `<path class="edge ${edge.tone}" d="${d}" marker-end="url(#arrow-semantic)"></path><g class="edge-label" transform="translate(${lx},${ly})"><rect x="-34" y="-10" width="68" height="20" rx="4"></rect><text text-anchor="middle" dominant-baseline="central">${escapeHtml(edge.label)}</text></g>`;
    }).join("");
  }

  function renderObjectDetail(params) {
    const draft = findDraft(params.get("draft")) || activeDraft();
    const object = findObject(draft, params.get("id")) || draft?.objects?.[0];
    if (!draft || !object) return emptyState("找不到 Object Type", "返回本体建模工作台选择可编辑对象。", "go-modeling", "返回本体建模");
    state.activeDraftId = draft.id;
    const tab = params.get("tab") || "overview";
    const tabs = [["overview", "概览"], ["properties", "属性"], ["relations", "关系"], ["data", "数据与映射"], ["logic", "业务逻辑与行动"], ["consumption", "下游消费"]];
    const issues = mappingIssues(draft).filter(issue => issue.targetId === object.id || issue.propertyId && object.properties.some(property => property.id === issue.propertyId));
    let body = "";
    if (tab === "overview") body = renderObjectOverview(draft, object, issues);
    else if (tab === "properties") body = renderObjectProperties(draft, object);
    else if (tab === "relations") body = renderObjectRelations(draft, object);
    else if (tab === "data") body = renderObjectData(draft, object, issues);
    else if (tab === "logic") body = renderObjectLogic(draft, object);
    else body = renderObjectConsumption(draft, object);
    return `<div class="detail-page"><header class="detail-hero"><button type="button" class="back-button" data-action="back-workbench">${icon("back")}<span>本体建模工作台</span></button><div class="detail-identity"><span class="resource-avatar object">O</span><div><small>Object Type · Draft</small><h1>${escapeHtml(object.name)}</h1><p>${escapeHtml(object.definition)}</p></div></div><div class="hero-actions">${status(issues.length ? "配置待完善" : "可校验", issues.length ? "amber" : "green")}${button("配置映射", "open-object-mapping", { value: object.id, primary: true })}</div></header>${tabBar(tabs, tab, "set-object-tab")}<section class="detail-content">${body}</section></div>`;
  }

  function renderObjectOverview(draft, object, issues) {
    const identity = object.properties.find(property => property.id === object.identityPropertyId);
    const title = object.properties.find(property => property.id === object.titlePropertyId);
    const member = memberById(object.memberId);
    return `<div class="detail-grid two-thirds"><section class="card"><div class="card-head"><div><h2>对象定义</h2><p>业务语义、稳定身份和可读标题集中维护。</p></div></div><div class="fact-grid">${fact("业务名称", escapeHtml(object.name))}${fact("稳定语义身份", `<span class="mono">${escapeHtml(object.id)}</span>`)}${fact("稳定身份", escapeHtml(identity?.name || "未设置"))}${fact("可读标题", escapeHtml(title?.name || "未设置"))}${fact("适用场景", escapeHtml(draft.scene))}${fact("Owner", RESOURCE_OWNER)}</div><div class="definition-box"><span>业务定义</span><p>${escapeHtml(object.definition)}</p></div></section><aside class="card"><div class="card-head"><div><h2>当前完整性</h2><p>发布前需要通过统一校验。</p></div></div><div class="score-ring ${issues.length ? "warning" : "success"}"><strong>${issues.length ? Math.max(40, 100 - issues.length * 18) : 100}</strong><span>配置完整度</span></div><ul class="check-summary"><li>${status(object.identityPropertyId ? "稳定身份已设置" : "缺少稳定身份", object.identityPropertyId ? "green" : "red")}</li><li>${status(object.titlePropertyId ? "可读标题已设置" : "缺少可读标题", object.titlePropertyId ? "green" : "red")}</li><li>${status(member ? "已选择数据资产成员" : "未选择数据资产成员", member ? "green" : "amber")}</li><li>${status(issues.length ? `${issues.length}项需要处理` : "没有发现配置缺口", issues.length ? "amber" : "green")}</li></ul></aside></div><section class="card"><div class="card-head"><div><h2>来源与预览</h2><p>来源选择不改变数据工程中的资产配置。</p></div>${button("查看数据与映射", "set-object-tab", { value: "data" })}</div>${member ? `<div class="asset-inline"><span class="asset-badge">DA</span><div><strong>${escapeHtml(publishedAsset.name)}</strong><p>${escapeHtml(member.name)} · ${escapeHtml(member.grain)} · ${member.rows.toLocaleString()}行</p></div>${status("已选择", "blue")}</div>${renderInstancePreview(object, true)}` : emptyState("尚未选择数据资产成员", "先在对象内选择数据工程已发布的数据资产成员，再显式创建或映射属性。", "set-object-tab", "选择数据资产成员")}</section>`;
  }

  function renderObjectProperties(draft, object) {
    const rows = object.properties.length ? object.properties.map(property => `<tr><td><div class="resource-cell"><span class="mini-type property">P</span><div><strong>${escapeHtml(property.name)}</strong><small class="mono">${escapeHtml(property.id)}</small></div></div></td><td>${escapeHtml(property.type)}</td><td>${escapeHtml(property.unit)}</td><td>${escapeHtml(property.role || "业务属性")}${property.linkEndpoint ? " · Link 端点" : ""}</td><td>${property.required ? "不允许" : "允许"}</td><td>${property.sourceFieldId ? `<span class="mapping-pair">${escapeHtml(property.sourceField)} ${icon("arrow")} ${escapeHtml(property.name)}</span>` : status("未映射", "amber")}</td><td><button type="button" class="text-link" data-action="open-property-mapping" data-object="${object.id}" data-value="${property.id}">配置映射</button></td></tr>`).join("") : `<tr><td colspan="7">${emptyState("尚未创建 Property", "从已选择的数据资产字段创建 Property，或新增业务属性后再配置映射。", "open-add-property", "创建 Property")}</td></tr>`;
    return `<section class="card"><div class="card-head"><div><h2>属性</h2><p>源字段不会自动变成 Property；每个属性都必须具有业务名称、定义和明确映射。</p></div><div class="row-actions">${button("从资产字段创建", "open-add-property", { icon: "plus" })}${button("打开映射工作区", "open-object-mapping", { value: object.id, primary: true })}</div></div><div class="table-wrap"><table><thead><tr><th>业务属性</th><th>类型</th><th>单位</th><th>用途</th><th>允许空值</th><th>来源映射</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></section><div class="inline-note">${icon("warning")}<div><strong>不会按名称自动迁移</strong><span>字段缺失或类型变化时，此处显示阻断；用户必须进入映射工作区重新选择字段并重验。</span></div></div>`;
  }

  function renderObjectRelations(draft, object) {
    const links = draft.links.filter(link => link.sourceObjectId === object.id || link.targetObjectId === object.id);
    return `<section class="card"><div class="card-head"><div><h2>关系</h2><p>关系表达业务方向与基数，端点使用稳定身份，不以显示名称临时连接。</p></div>${button("创建 Link", "open-add-link", { icon: "plus" })}</div><div class="relation-list">${links.length ? links.map(link => {
      const source = findObject(draft, link.sourceObjectId); const target = findObject(draft, link.targetObjectId);
      const sourceEndpoint = resolveLinkEndpoint(draft, link, "source");
      const targetEndpoint = resolveLinkEndpoint(draft, link, "target");
      const blocked = !sourceEndpoint || !targetEndpoint || !compatibleTypes(sourceEndpoint.type, targetEndpoint.type);
      return `<article class="relation-card"><div class="relation-visual"><span class="object-chip">${escapeHtml(source?.name)}</span><i>${icon("arrow")}<small>${escapeHtml(link.cardinality)}</small></i><span class="object-chip">${escapeHtml(target?.name)}</span></div><div class="relation-copy"><h3>${escapeHtml(link.name)}</h3><p>${escapeHtml(link.definition)}</p><div class="resource-chips"><span>${escapeHtml(link.direction)}</span><span>起点：${escapeHtml(endpointText(draft, link, "source"))}</span><span>终点：${escapeHtml(endpointText(draft, link, "target"))}</span></div></div>${blocked ? status("端点阻断", "red") : status("已配置", "green")}</article>`;
    }).join("") : emptyState("尚未创建关系", "创建 Link Type，明确起点、终点、方向、基数和稳定端点。", "open-add-link", "创建 Link")}</div></section>`;
  }

  function renderObjectData(draft, object, issues) {
    const member = memberById(object.memberId);
    const mapped = object.properties.filter(property => property.sourceFieldId).length;
    return `<div class="detail-grid two-thirds"><section class="card"><div class="card-head"><div><h2>数据资产成员</h2><p>只选择数据工程已经发布且允许用于本体映射的成员。</p></div>${button(member ? "更换成员" : "选择成员", "open-asset-picker", { primary: !member })}</div>${member ? `<div class="asset-detail"><div class="asset-title-row"><span class="asset-badge">DA</span><div><strong>${escapeHtml(publishedAsset.name)}</strong><p>${escapeHtml(publishedAsset.versionLabel)} · 数据截至 ${escapeHtml(publishedAsset.asOf)}</p></div>${status("已发布", "green")}</div><dl class="key-values compact"><dt>具体成员</dt><dd>${escapeHtml(member.name)}</dd><dt>成员粒度</dt><dd>${escapeHtml(member.grain)}</dd><dt>成员稳定标识</dt><dd class="mono">${escapeHtml(member.id)}</dd><dt>质量摘要</dt><dd>${escapeHtml(publishedAsset.quality)}</dd></dl><button type="button" class="text-link" data-action="open-lineage-detail" data-value="asset">查看完整来源链</button></div>` : emptyState("尚未选择数据资产成员", "此选择只建立引用，不上传文件，也不改变数据工程管道。", "open-asset-picker", "选择已发布成员")}</section><aside class="card"><div class="card-head"><div><h2>映射完整性</h2><p>字段语义映射在对象范围内完成。</p></div></div><div class="mapping-score"><strong>${mapped}<small> / ${object.properties.length}</small></strong><span>Property 已映射</span></div><ul class="check-summary">${issues.length ? issues.map(issue => `<li>${status(issue.title, "amber")}</li>`).join("") : `<li>${status("身份、标题与属性映射完整", "green")}</li><li>${status("关系端点可匹配", "green")}</li>`}</ul>${button("打开字段映射", "open-object-mapping", { value: object.id, primary: true })}</aside></div><section class="card"><div class="card-head"><div><h2>真实实例预览</h2><p>预览来自当前选择的资产成员，不代表正式消费已采用。</p></div>${status(member ? "可预览" : "无数据", member ? "blue" : "neutral")}</div>${member ? renderInstancePreview(object, false) : emptyState("暂无实例预览", "选择数据资产成员后才能查看代表性对象和关系。")}</section>`;
  }

  function renderObjectLogic(draft, object) {
    const metrics = draft.metrics.filter(item => item.objectId === object.id);
    const rules = draft.rules.filter(item => item.objectId === object.id);
    const actions = draft.actionTypes.filter(item => item.objectId === object.id);
    const group = (title, kind, items, action) => `<section class="logic-section"><header><div><span class="mini-type ${kind}">${kind === "metric" ? "M" : kind === "rule" ? "R" : "A"}</span><h3>${title}</h3></div><div class="logic-head-actions"><em>${items.length}</em><button type="button" class="icon-button compact" data-action="${action}" data-value="${object.id}" aria-label="创建 ${title}">${icon("plus")}</button></div></header>${items.length ? items.map(item => `<button type="button" class="logic-row" data-action="open-draft-resource" data-value="${item.id}"><div><strong>${escapeHtml(item.displayCode ? `${item.displayCode} ${item.name}` : item.name)}</strong><p>${escapeHtml(item.definition)}</p></div><span class="mono">${escapeHtml(item.id)}</span>${icon("chevron")}</button>`).join("") : `<div class="logic-empty"><span>尚未配置</span><button type="button" class="text-link" data-action="${action}" data-value="${object.id}">创建 ${title}</button></div>`}</section>`;
    return `<div class="logic-layout">${group("Metric", "metric", metrics, "open-add-metric")}${group("Rule", "rule", rules, "open-add-rule")}${group("Action Type", "action", actions, "open-add-action")}</div><div class="inline-note">${icon("link")}<div><strong>定义链路</strong><span>Metric 计算业务事实；Rule 判断问题；Action Type 只定义可请求的行动。规则命中不会直接创建提醒或待办。</span></div></div>`;
  }

  function renderObjectConsumption(draft, object) {
    const counts = { properties: object.properties.length, links: draft.links.filter(link => link.sourceObjectId === object.id || link.targetObjectId === object.id).length, metrics: draft.metrics.filter(item => item.objectId === object.id).length, rules: draft.rules.filter(item => item.objectId === object.id).length, actions: draft.actionTypes.filter(item => item.objectId === object.id).length };
    return `<section class="card"><div class="card-head"><div><h2>下游消费内容</h2><p>这是 Draft 的发布前预览；正式消费者只会读取精确的已发布版本。</p></div>${status("等待发布", "amber")}</div><div class="consumer-package"><div class="package-summary"><span class="resource-avatar object">O</span><div><strong>${escapeHtml(object.name)}</strong><small class="mono">${escapeHtml(object.id)}</small></div><dl><div><dt>Property</dt><dd>${counts.properties}</dd></div><div><dt>Link</dt><dd>${counts.links}</dd></div><div><dt>Metric</dt><dd>${counts.metrics}</dd></div><div><dt>Rule</dt><dd>${counts.rules}</dd></div><div><dt>Action Type</dt><dd>${counts.actions}</dd></div></dl></div><div class="consumer-grid">${consumerCard("智能问数", "对象、属性、关系、指标、规则和行动类型", "等待语义发布")}${consumerCard("决策中心", "Rule 证据和可请求的 Action Type", "等待语义发布")}${consumerCard("Agent 应用", "获准语义资源及只读证据", "等待语义发布")}${consumerCard("报告中心", "稳定资源身份、定义和历史版本", "等待语义发布")}</div></section><div class="inline-alert warning">${icon("warning")}<div><strong>Draft 不进入正式消费目录</strong><span>发布后还需完成数据与本体匹配、业务消费验证和正式数据切换，才可形成完整消费上下文。</span></div></div>`;
  }

  function consumerCard(name, scope, stateText, tone = "neutral") {
    return `<article class="consumer-card"><div><span>${escapeHtml(name)}</span>${status(stateText, tone)}</div><p>${escapeHtml(scope)}</p><button type="button" class="text-link" data-action="open-consumer-info" data-value="${escapeHtml(name)}">查看详情</button></article>`;
  }

  function renderInstancePreview(object, compact) {
    if (object.id === "OBJ-FINANCING-ENTITY") return `<div class="table-wrap instance-preview ${compact ? "compact" : ""}"><table><thead><tr><th>稳定身份</th><th>可读标题</th><th>产业板块</th><th>负责人</th><th>融资余额</th><th>融资成本</th><th>规则结果</th><th>优先协商机构</th></tr></thead><tbody>${subjectInstances.map(item => `<tr><td class="mono">${item.id}</td><td>${item.name}</td><td>${item.sector}</td><td>${item.owner}</td><td>${item.balance}</td><td>${item.cost}</td><td><span class="rule-hit">${item.rule}</span> ${item.issue}</td><td>${item.banks}</td></tr>`).join("")}</tbody></table></div>`;
    if (object.id === "OBJ-FINANCING-DETAIL") return `<div class="table-wrap instance-preview"><table><thead><tr><th>借据编号</th><th>融资主体</th><th>金融机构</th><th>余额</th><th>利率</th><th>利率形式</th><th>期限</th></tr></thead><tbody>${detailInstances.map(item => `<tr><td class="mono">${item.id}</td><td>${item.subject}</td><td>${item.institution}</td><td>${item.balance}</td><td>${item.rate}</td><td>${item.rateType}</td><td>${item.term}</td></tr>`).join("")}</tbody></table></div>`;
    if (object.id === "OBJ-FINANCIAL-INSTITUTION") return `<div class="table-wrap instance-preview"><table><thead><tr><th>机构编码</th><th>机构名称</th><th>机构类别</th><th>关联借据</th><th>服务主体</th></tr></thead><tbody>${institutionInstances.map(item => `<tr><td class="mono">${item.id}</td><td>${item.name}</td><td>${item.category}</td><td>${item.loans}</td><td>${item.subjects}</td></tr>`).join("")}</tbody></table></div>`;
    if (object.id === "OBJ-FINANCING-OWNER") return `<div class="table-wrap instance-preview"><table><thead><tr><th>负责人标识</th><th>负责人名称</th><th>负责主体</th><th>代表主体</th></tr></thead><tbody>${ownerInstances.map(item => `<tr><td class="mono">${item.id}</td><td>${item.name}</td><td>${item.subjects}</td><td>${item.key}</td></tr>`).join("")}</tbody></table></div>`;
    return `<div class="preview-row"><span class="mono">暂无实例</span><span>完成字段映射后生成预览</span></div>`;
  }

  function renderMappingWorkspace(params) {
    const draft = findDraft(params.get("draft")) || activeDraft();
    const object = findObject(draft, params.get("object")) || draft?.objects?.[0];
    if (!draft || !object) return emptyState("找不到映射上下文", "请从 Object Type 详情进入字段映射。", "go-modeling", "返回本体建模");
    const requestedPropertyId = params.get("property");
    if (requestedPropertyId && ui.selectedMappingPropertyId !== requestedPropertyId) ui.selectedMappingPropertyId = requestedPropertyId;
    if (!ui.selectedMappingPropertyId || !object.properties.some(item => item.id === ui.selectedMappingPropertyId)) ui.selectedMappingPropertyId = object.properties[0]?.id || null;
    const fields = fieldsFor(object);
    const selectedField = fields.find(item => item.id === ui.selectedMappingFieldId);
    const selectedProperty = object.properties.find(item => item.id === ui.selectedMappingPropertyId);
    const member = memberById(object.memberId);
    const issue = selectedProperty && !selectedProperty.sourceFieldId;
    const sourceItems = fields.length ? fields.map(field => {
      const isEndpoint = fieldLineage(draft, object, field).endpoint;
      return `<button type="button" class="mapping-item source ${ui.selectedMappingFieldId === field.id ? "selected" : ""} ${isEndpoint ? "endpoint" : ""}" data-action="select-mapping-field" data-value="${field.id}" data-map-left="${field.id}"><span class="field-type">${escapeHtml(field.type.slice(0, 1))}</span><div><strong>${escapeHtml(field.name)}</strong><small>${escapeHtml(field.type)} · 示例 ${escapeHtml(field.sample)}</small>${isEndpoint ? `<em>Link 端点</em>` : ""}</div><i class="mapping-port"></i></button>`;
    }).join("") : emptyState("没有可用字段", "请先在对象详情选择已发布数据资产成员。", "open-asset-picker", "选择数据资产成员");
    const targetItems = object.properties.length ? object.properties.map(property => {
      const isEndpoint = propertyIsLinkEndpoint(draft, object, property);
      return `<button type="button" class="mapping-item target ${ui.selectedMappingPropertyId === property.id ? "selected focused" : ""} ${!property.sourceFieldId ? "unmapped" : ""}" data-action="select-mapping-property" data-value="${property.id}" data-map-right="${property.id}"><i class="mapping-port"></i><span class="field-type property">P</span><div><strong>${escapeHtml(property.name)}</strong><small>${escapeHtml(property.type)} · ${escapeHtml(property.role || "业务属性")}${isEndpoint ? " · Link 端点" : ""}</small></div>${property.sourceFieldId ? status("已映射", "green") : status("未映射", "amber")}</button>`;
    }).join("") : emptyState("尚未创建 Property", "从左侧数据资产字段逐项创建具有业务价值的 Property。", "open-add-property", "创建 Property");
    const selectedFieldLineage = selectedField ? fieldLineage(draft, object, selectedField) : { linkNames: [], endpoint: false };
    const fieldEndpoint = selectedFieldLineage.endpoint;
    const propertyLinks = propertyLinkNames(draft, object, selectedProperty);
    const propertyEndpoint = propertyIsLinkEndpoint(draft, object, selectedProperty);
    const fieldEndpointAction = selectedFieldLineage.linkNames.length
      ? button("查看关系", "open-object-relations", { value: object.id })
      : button(fieldEndpoint ? "取消 Link 端点" : "设为 Link 端点", "toggle-field-endpoint", { value: selectedField?.id || "", disabled: !selectedField });
    const propertyEndpointAction = propertyLinks.length
      ? `<button type="button" data-action="open-object-relations" data-value="${escapeHtml(object.id)}">查看关系</button>`
      : `<button type="button" data-action="set-property-role" data-value="endpoint" class="${propertyEndpoint ? "active" : ""}">${propertyEndpoint ? "取消 Link 端点" : "设为 Link 端点"}</button>`;
    return `<div class="mapping-page">
      <header class="mapping-toolbar"><button type="button" class="back-button" data-action="back-object" data-value="${object.id}">${icon("back")}<span>${escapeHtml(object.name)}</span></button><div><h1>字段映射</h1><p>${escapeHtml(publishedAsset.name)} / ${escapeHtml(member?.name || "未选择成员")} → ${escapeHtml(object.name)}</p></div><div class="toolbar-actions">${button("查看实例预览", "scroll-preview", { icon: "eye" })}${button("返回对象详情", "back-object", { value: object.id, primary: true })}</div></header>
      ${issue ? `<div class="mapping-blocker">${icon("warning")}<div><strong>${escapeHtml(selectedProperty.name)}缺少字段映射</strong><span>请选择兼容来源字段，再建立明确连接；系统不会按同名字段自动迁移。</span></div></div>` : ""}
      <div class="mapping-board">
        <section class="mapping-column source-fields"><header><div><span class="column-kicker">数据资产字段</span><h2>${escapeHtml(member?.name || "尚未选择成员")}</h2></div><em>${fields.length} 个字段</em></header><div class="mapping-list">${sourceItems}</div></section>
        <section class="mapping-lines"><svg aria-hidden="true" data-mapping-svg></svg><div class="mapping-action-card"><span>${selectedField ? escapeHtml(selectedField.name) : "选择来源字段"}</span>${icon("arrow")}<span>${selectedProperty ? escapeHtml(selectedProperty.name) : "选择 Property"}</span>${button(selectedProperty?.sourceFieldId ? "更新映射" : "建立映射", "connect-mapping", { primary: true, disabled: !selectedField || !selectedProperty })}</div></section>
        <section class="mapping-column target-properties"><header><div><span class="column-kicker">本体属性</span><h2>${escapeHtml(object.name)}</h2></div><em>${object.properties.length} 个 Property</em></header><div class="mapping-list">${targetItems}</div></section>
      </div>
      <section class="mapping-config">
        <div class="config-card"><h3>当前数据字段</h3><dl class="key-values compact"><dt>字段名称</dt><dd>${display(selectedField?.name)}</dd><dt>字段类型</dt><dd>${display(selectedField?.type)}</dd><dt>示例值</dt><dd>${display(selectedField?.sample)}</dd><dt>端点用途</dt><dd>${fieldEndpoint ? escapeHtml(selectedFieldLineage.linkNames.join("、") || "Link 端点") : "未设置"}</dd></dl>${fieldEndpointAction}</div>
        <div class="config-card"><h3>当前 Property</h3><dl class="key-values compact"><dt>业务名称</dt><dd>${display(selectedProperty?.name)}</dd><dt>稳定语义身份</dt><dd class="mono">${display(selectedProperty?.id)}</dd><dt>数据类型</dt><dd>${display(selectedProperty?.type)}</dd><dt>来源字段</dt><dd>${display(selectedProperty?.sourceField)}</dd><dt>端点用途</dt><dd>${propertyEndpoint ? escapeHtml(propertyLinks.join("、") || "Link 端点") : "未设置"}</dd></dl><div class="segmented-actions"><button type="button" data-action="set-property-role" data-value="identity" class="${selectedProperty && object.identityPropertyId === selectedProperty.id ? "active" : ""}">设为身份</button><button type="button" data-action="set-property-role" data-value="title" class="${selectedProperty && object.titlePropertyId === selectedProperty.id ? "active" : ""}">设为标题</button>${propertyEndpointAction}</div></div>
        <div class="config-card preview-card" id="mapping-preview"><div class="card-head"><div><h3>实例预览</h3><p>映射保存后同步显示当前对象实例。</p></div>${status(member ? "可预览" : "无数据", member ? "blue" : "neutral")}</div>${member ? renderInstancePreview(object, true) : emptyState("暂无实例", "选择数据资产成员后可查看。")}</div>
      </section>
    </div>`;
  }

  function drawMappingLines() {
    const svg = document.querySelector("[data-mapping-svg]");
    const board = document.querySelector(".mapping-board");
    const draft = activeDraft();
    const r = route();
    const object = findObject(draft, r.params.get("object"));
    if (!svg || !board || !object) return;
    const boardRect = board.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${boardRect.width} ${boardRect.height}`);
    svg.setAttribute("width", boardRect.width);
    svg.setAttribute("height", boardRect.height);
    const hostRect = svg.parentElement.getBoundingClientRect();
    svg.style.left = `${boardRect.left - hostRect.left}px`;
    svg.style.top = `${boardRect.top - hostRect.top}px`;
    svg.innerHTML = object.properties.map(property => {
      if (!property.sourceFieldId) return "";
      const left = document.querySelector(`[data-map-left="${CSS.escape(property.sourceFieldId)}"]`);
      const right = document.querySelector(`[data-map-right="${CSS.escape(property.id)}"]`);
      if (!left || !right) return "";
      const a = left.getBoundingClientRect(); const b = right.getBoundingClientRect();
      const x1 = a.right - boardRect.left; const y1 = a.top + a.height / 2 - boardRect.top; const x2 = b.left - boardRect.left; const y2 = b.top + b.height / 2 - boardRect.top;
      return `<path class="mapping-line ${ui.selectedMappingPropertyId === property.id ? "active" : ""}" d="M${x1} ${y1} C${x1 + 90} ${y1} ${x2 - 90} ${y2} ${x2} ${y2}"></path>`;
    }).join("");
  }

  function renderValidation(params) {
    const draft = findDraft(params.get("draft")) || activeDraft();
    if (!draft) return emptyState("找不到本体 Draft", "返回建模工作区重新选择。", "go-modeling", "返回本体建模");
    const result = draft.validation;
    const isBusy = ui.busy === "validation";
    const showIssues = result.status === "failed" ? result.issues : [];
    const groupState = predicate => isBusy ? "processing" : result.status === "not-run" ? "idle" : result.status === "passed" ? "passed" : result.issues.some(predicate) ? "failed" : "passed";
    return `<div class="page-wrap narrow">${headline("本体建模 / 统一校验", "发布前统一校验", "一次检查对象、属性、关系、映射、指标、规则和行动类型；失败项可返回原位置修正。", `${button("返回本体建模工作台", "back-workbench", { icon: "back" })}${button(result.status === "passed" ? "重新校验" : "运行校验", "run-validation", { primary: true, icon: "check", disabled: isBusy })}`)}
      <section class="validation-hero ${result.status}"><div class="validation-icon">${isBusy ? '<span class="spinner"></span>' : result.status === "passed" ? icon("check") : result.status === "failed" ? icon("warning") : icon("layers")}</div><div><span>当前结果</span><h2>${isBusy ? "正在检查完整性" : result.status === "passed" ? "校验通过，可以发布" : result.status === "failed" ? `发现 ${result.issues.length} 项阻断` : "尚未运行校验"}</h2><p>${isBusy ? "正在检查稳定身份、字段类型、关系端点及业务逻辑依赖。" : result.status === "passed" ? `完成于 ${escapeHtml(result.ranAt)}；后续修改会使结果失效。` : result.status === "failed" ? "先修正所有阻断项，再从本页重新校验。" : "校验结果不会预先写入，运行完成后才会产生记录。"}</p></div>${result.status === "passed" && !isBusy ? button("发布语义版本", "open-publish", { primary: true }) : ""}</section>
      <div class="validation-layout"><section class="card"><div class="card-head"><div><h2>检查范围</h2><p>关键项失败会阻断发布。</p></div></div><div class="validation-groups">${validationGroup("对象结构", "名称、定义、稳定身份、可读标题", groupState(item => item.type === "对象"))}${validationGroup("属性与映射", "来源字段、类型、单位和空值", groupState(item => item.type === "属性" || item.type === "属性映射"))}${validationGroup("关系端点", "方向、基数、端点兼容和覆盖", groupState(item => item.type === "关系"))}${validationGroup("业务逻辑", "Metric、Rule 和 Action Type 依赖", groupState(item => item.type === "业务逻辑"))}</div></section><section class="card"><div class="card-head"><div><h2>问题定位</h2><p>${showIssues.length ? "点击查看详情将返回具体配置位置。" : result.status === "not-run" ? "运行后显示需要修正的具体位置。" : "当前没有待处理的配置问题。"}</p></div><span>${showIssues.length} 项</span></div>${showIssues.length ? `<div class="issue-list">${showIssues.map((issue, index) => `<article class="issue-row"><span class="issue-index">${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHtml(issue.title)}</strong><p>${escapeHtml(issue.type)} · 发布阻断</p></div>${status("失败", "red")}<button type="button" class="text-link" data-action="locate-issue" data-object="${escapeHtml(issue.targetId)}" data-property="${escapeHtml(issue.propertyId || "")}" data-location="${escapeHtml(issue.location)}">查看详情</button></article>`).join("")}</div>` : emptyState(result.status === "passed" ? "校验没有发现阻断" : isBusy ? "正在检查" : "尚未产生校验结果", result.status === "passed" ? "可以发布当前 Draft。" : isBusy ? "检查完成后会显示结果。" : "运行校验后会在这里显示结果。")}</section></div>
      ${result.status === "passed" ? `<section class="card evidence-summary"><div><span class="evidence-mark">${icon("check")}</span><div><h3>校验证据已生成</h3><p>包含校验范围、运行时间、资源快照和零阻断结论；发布后归属于精确语义版本。</p></div></div><button type="button" class="text-link" data-action="open-validation-evidence">查看详情</button></section>` : ""}
    </div>`;
  }

  function validationGroup(title, text, stateName) {
    const labels = { idle: ["未开始", "neutral"], processing: ["处理中", "blue"], passed: ["通过", "green"], failed: ["失败", "red"] };
    const [label, tone] = labels[stateName] || labels.idle;
    const mark = stateName === "processing" ? '<span class="spinner compact"></span>' : stateName === "passed" ? icon("check") : stateName === "failed" ? icon("warning") : icon("layers");
    return `<article class="validation-group ${stateName}"><span>${mark}</span><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></div>${status(label, tone, stateName === "processing")}</article>`;
  }

  function renderPublishedHome() {
    const versions = [...state.publishedVersions].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    const versionCards = versions.length ? versions.map(version => {
      const counts = resourceCounts(version.snapshot);
      const binding = version.formalBinding;
      const current = isCurrentFormalVersion(version);
      const updateStatus = version.update && version.update.status !== "switched" ? version.update.status : null;
      return `<article class="published-card"><header><div class="published-title"><span class="resource-avatar published">V</span><div><small>${escapeHtml(version.ontologyName)}</small><h3>${escapeHtml(version.label)}</h3></div></div><div class="hero-statuses">${status("语义已发布", "green")}${formalRoleStatus(version)}</div></header><p>${escapeHtml(version.definition)}</p><div class="version-facts"><div><span>发布时间</span><strong>${escapeHtml(version.publishedAt)}</strong></div><div><span>资源构成</span><strong>${counts.objects} 对象 · ${counts.properties} 属性 · ${counts.links} 关系</strong></div><div><span>${current ? "当前正式数据" : binding ? "历史正式数据" : "正式数据"}</span><strong class="mono">${binding ? escapeHtml(binding.dataVersionId) : "等待数据绑定"}</strong></div><div><span>消费状态</span><strong>${current ? "当前正式使用" : binding ? "历史引用" : "不可消费"}</strong></div></div>${updateStatus ? `<div class="inline-alert warning compact">${icon("refresh")}<div><strong>有待更新数据</strong><span>进入版本详情继续匹配检查或恢复。</span></div></div>` : ""}<footer><span class="mono">${escapeHtml(version.id)}</span>${button("查看详情", "open-version", { value: version.id, primary: true })}</footer></article>`;
    }).join("") : emptyState("还没有已发布本体", "Draft 通过统一校验并实际发布后，语义版本及其资源才会出现在这里。", "go-modeling", "前往本体建模");
    return `<div class="page-wrap">${headline("已发布本体", "已发布本体", "先选择本体和精确语义版本，再查看资源、正式数据、更新记录和历史证据。", "")}<section class="filter-bar"><div class="search-box">${icon("search")}<input placeholder="搜索已发布本体或版本" aria-label="搜索已发布本体或版本" /></div><div class="filter-copy"><span>${versions.length} 个精确版本</span></div></section><div class="published-list">${versionCards}</div><section class="section-block compact"><div class="section-head"><div><h2>其他业务本体</h2><p>仅显示已经进入本体生命周期的业务范围。</p></div></div><div class="boundary-row"><div><strong>债务风险监测</strong><span>尚无可用于建模的已发布数据资产</span></div>${status("尚未创建", "neutral")}</div></section></div>`;
  }

  function renderVersionDetail(params) {
    const version = findVersion(params.get("id")) || currentVersion();
    if (!version) return `<div class="page-wrap">${headline("已发布本体", "版本详情", "选择一个精确语义版本后查看。")}${emptyState("暂无已发布版本", "先完成 Draft 校验和发布。", "go-modeling", "前往本体建模")}</div>`;
    state.selectedPublishedVersionId = version.id;
    const tab = params.get("tab") || "overview";
    const tabs = [["overview", "版本概览"], ["resources", "资源与模型"], ["consumption", "数据与消费"], ["updates", "更新与回退"], ["records", "记录与证据"]];
    let body = "";
    if (tab === "overview") body = renderVersionOverview(version);
    else if (tab === "resources") body = renderVersionResources(version);
    else if (tab === "consumption") body = renderVersionConsumption(version);
    else if (tab === "updates") body = renderVersionUpdates(version);
    else body = renderVersionRecords(version);
    const formalStatus = version.update?.eligible && !version.formalBinding ? status("候选验证中", "amber") : formalRoleStatus(version);
    return `<div class="detail-page published-version"><header class="version-hero"><button type="button" class="back-button" data-action="go-published">${icon("back")}<span>已发布本体</span></button><div class="detail-identity"><span class="resource-avatar published">V</span><div><small>${escapeHtml(version.ontologyName)}</small><h1>${escapeHtml(version.label)}</h1><p>${escapeHtml(version.definition)}</p></div></div><div class="hero-actions"><div class="hero-statuses">${status("语义已发布", "green")}${formalStatus}</div>${button("创建修订 Draft", "create-revision", { icon: "history" })}</div></header>${tabBar(tabs, tab, "set-version-tab")}<section class="detail-content">${body}</section></div>`;
  }

  function renderVersionOverview(version) {
    const counts = resourceCounts(version.snapshot);
    const update = version.update;
    const contract = versionDataContract(version);
    const current = isCurrentFormalVersion(version);
    return `<div class="detail-grid two-thirds"><section class="card"><div class="card-head"><div><h2>版本定义</h2><p>该版本是不可变语义快照；后续修改必须创建新的 Draft。</p></div>${status("不可变", "neutral")}</div><div class="fact-grid">${fact("本体名称", escapeHtml(version.ontologyName))}${fact("本体稳定身份", `<span class="mono">${escapeHtml(version.ontologyStableId)}</span>`)}${fact("精确语义版本", `<span class="mono">${escapeHtml(version.id)}</span>`)}${fact("发布时间", escapeHtml(version.publishedAt))}${fact("适用场景", escapeHtml(version.scene))}${fact("Owner", RESOURCE_OWNER)}${fact("发布状态", status("语义已发布", "green"))}</div><div class="definition-box"><span>版本变更摘要</span><p>${escapeHtml(version.changeSummary)}</p></div></section><aside class="card"><div class="card-head"><div><h2>资源构成</h2><p>全部资源共同归属于此精确版本。</p></div></div><div class="resource-count-grid"><div><strong>${counts.objects}</strong><span>Object</span></div><div><strong>${counts.properties}</strong><span>Property</span></div><div><strong>${counts.links}</strong><span>Link</span></div><div><strong>${counts.metrics}</strong><span>Metric</span></div><div><strong>${counts.rules}</strong><span>Rule</span></div><div><strong>${counts.actions}</strong><span>Action Type</span></div></div><button type="button" class="text-link" data-action="set-version-tab" data-value="resources">查看全部资源</button></aside></div>
      <section class="card"><div class="card-head"><div><h2>数据映射合同</h2><p>发布保留当时的数据资产成员、字段映射和来源链引用，不随 Draft 后续变化。</p></div>${button("查看资源与模型", "set-version-tab", { value: "resources" })}</div><div class="mapping-contract-grid"><div><span>数据资产</span><strong>${escapeHtml(contract.name)}</strong><small class="mono">${escapeHtml(contract.versionLabel)}</small></div><div><span>资产成员</span><strong>${contract.members.length} 个</strong><small>融资主体、明细、机构、负责人</small></div><div><span>成员关系</span><strong>三关系</strong><small>方向、基数和端点已保存</small></div><div><span>数据截至</span><strong>${escapeHtml(contract.asOf)}</strong><small>来源链可追溯</small></div></div></section>
      <div class="detail-grid half"><section class="card"><div class="card-head"><div><h2>发布校验证据</h2><p>只显示实际发布前生成的校验结果。</p></div>${status("通过", "green")}</div><dl class="key-values"><dt>校验时间</dt><dd>${escapeHtml(version.validation.ranAt)}</dd><dt>阻断项</dt><dd>0</dd><dt>检查范围</dt><dd>结构、映射、关系端点、业务逻辑</dd><dt>证据状态</dt><dd>已归档至本版本</dd></dl><button type="button" class="text-link" data-action="open-version-evidence" data-value="validation">查看证据</button></section><section class="card"><div class="card-head"><div><h2>数据与消费状态</h2><p>语义发布不等于正式数据已经可用。</p></div></div><dl class="key-values"><dt>语义状态</dt><dd>${status("语义已发布", "green")}</dd><dt>${current ? "当前正式数据版本" : version.formalBinding ? "历史正式数据版本" : "正式数据版本"}</dt><dd class="mono">${version.formalBinding ? escapeHtml(version.formalBinding.dataVersionId) : "等待数据绑定"}</dd><dt>待更新数据版本</dt><dd class="mono">${update && update.status !== "switched" ? escapeHtml(update.dataVersionId) : "暂无"}</dd><dt>消费状态</dt><dd>${current ? status("当前正式使用", "blue") : version.formalBinding ? status("历史引用", "neutral") : status("不可消费", "amber")}</dd></dl>${button("查看数据与消费", "set-version-tab", { value: "consumption", primary: true })}</section></div>`;
  }

  function renderVersionResources(version) {
    const resources = allResources(version.snapshot).filter(item => ui.resourceFilter === "全部" || item.kind === ui.resourceFilter);
    const filters = ["全部", "Object Type", "Property", "Link Type", "Metric", "Rule", "Action Type"];
    const controls = `<div class="resource-controls"><div class="filter-pills">${filters.map(item => `<button type="button" class="${ui.resourceFilter === item ? "active" : ""}" data-action="resource-filter" data-value="${item}">${item === "Object Type" ? "Object" : item === "Link Type" ? "Link" : item}</button>`).join("")}</div><div class="view-buttons"><button type="button" class="${ui.resourceView === "list" ? "active" : ""}" data-action="resource-view" data-value="list">列表</button><button type="button" class="${ui.resourceView === "cards" ? "active" : ""}" data-action="resource-view" data-value="cards">卡片</button><button type="button" class="${ui.resourceView === "graph" ? "active" : ""}" data-action="resource-view" data-value="graph">模型全景</button></div></div>`;
    let content = "";
    if (ui.resourceView === "graph") content = `<div class="published-graph"><div class="readonly-banner">${icon("eye")}精确版本只读模型</div>${renderSemanticCanvas(version.snapshot, true)}</div>`;
    else if (ui.resourceView === "cards") content = `<div class="resource-card-grid">${resources.map(item => publishedResourceCard(version, item)).join("")}</div>`;
    else content = `<div class="table-wrap"><table><thead><tr><th>业务资源</th><th>资源类型</th><th>稳定语义身份</th><th>适用场景</th><th>Owner</th><th>状态</th><th></th></tr></thead><tbody>${resources.map(item => `<tr><td><div class="resource-cell"><span class="mini-type ${resourceTone(item.kind)}">${escapeHtml(item.code || "P")}</span><div><strong>${escapeHtml(item.displayCode ? `${item.displayCode} ${item.name}` : item.name)}</strong><small>${escapeHtml(item.definition || "")}</small></div></div></td><td>${escapeHtml(item.kind)}</td><td class="mono">${escapeHtml(item.id)}</td><td>${escapeHtml(version.scene)}</td><td>${RESOURCE_OWNER}</td><td>${status("已发布", "green")}</td><td><button type="button" class="text-link" data-action="open-published-resource" data-value="${item.id}">查看详情</button></td></tr>`).join("")}</tbody></table></div>`;
    return `<section class="card resource-catalog"><div class="card-head"><div><h2>版本资源目录</h2><p>仅包含用户实际发布到此精确版本的资源；显示名称不作为绑定身份。</p></div><span>${resources.length} 项</span></div>${controls}${content}</section>`;
  }

  function resourceTone(kind) { return kind === "Object Type" ? "object" : kind === "Property" ? "property" : kind === "Link Type" ? "link" : kind === "Metric" ? "metric" : kind === "Rule" ? "rule" : "action"; }
  function publishedResourceCard(version, item) {
    return `<button type="button" class="published-resource-card" data-action="open-published-resource" data-value="${item.id}"><div><span class="mini-type ${resourceTone(item.kind)}">${escapeHtml(item.code || "P")}</span>${status("已发布", "green")}</div><small>${escapeHtml(item.kind)}</small><h3>${escapeHtml(item.displayCode ? `${item.displayCode} ${item.name}` : item.name)}</h3><p>${escapeHtml(item.definition || "")}</p><footer><span class="mono">${escapeHtml(item.id)}</span>${icon("chevron")}</footer></button>`;
  }

  function renderVersionConsumption(version) {
    const binding = version.formalBinding;
    const update = version.update;
    const counts = resourceCounts(version.snapshot);
    const current = isCurrentFormalVersion(version);
    const historical = !!binding && !current;
    const consumerState = current ? "可读取" : historical ? "历史引用" : "不可消费";
    const consumerTone = current ? "green" : historical ? "neutral" : "amber";
    return `<div class="binding-hero ${binding ? "ready" : "waiting"}"><div><span>${current ? "当前正式使用版本" : historical ? "历史正式记录" : "正式数据状态"}</span><h2>${binding ? `${escapeHtml(version.label)} + ${escapeHtml(binding.dataVersionId)}` : "尚未形成正式数据绑定"}</h2><p>${current ? `数据截至 ${escapeHtml(binding.dataAsOf)} · 切换于 ${escapeHtml(binding.switchedAt)}` : historical ? `该组合已停止当前服务；旧报告与历史证据仍可按此版本追溯。原切换时间 ${escapeHtml(binding.switchedAt)}` : "语义已发布；完成匹配检查、业务消费验证并由用户确认切换后才可正式消费。"}</p></div>${formalRoleStatus(version)}</div>
      <div class="detail-grid half"><section class="card"><div class="card-head"><div><h2>获准消费范围</h2><p>下游按稳定身份和精确语义版本只读发现。</p></div></div><div class="resource-count-grid"><div><strong>${counts.objects}</strong><span>Object</span></div><div><strong>${counts.properties}</strong><span>Property</span></div><div><strong>${counts.links}</strong><span>Link</span></div><div><strong>${counts.metrics}</strong><span>Metric</span></div><div><strong>${counts.rules}</strong><span>Rule</span></div><div><strong>${counts.actions}</strong><span>Action Type</span></div></div><dl class="key-values compact"><dt>精确语义版本</dt><dd class="mono">${escapeHtml(version.id)}</dd><dt>正式数据版本</dt><dd class="mono">${binding ? escapeHtml(binding.dataVersionId) : "未绑定"}</dd><dt>数据截至时间</dt><dd>${binding ? escapeHtml(binding.dataAsOf) : "未形成"}</dd><dt>上一可信数据</dt><dd class="mono">${version.previousBinding ? escapeHtml(version.previousBinding.dataVersionId) : "暂无"}</dd></dl></section><section class="card"><div class="card-head"><div><h2>消费上下文完整性</h2><p>关键项缺失时不会标记为可消费。</p></div>${status(binding ? "完整" : "不完整", binding ? "green" : "amber")}</div><ul class="context-checks"><li><span>${icon("check")}</span><div><strong>稳定资源身份与精确版本</strong><small>全部资源可定位</small></div></li><li><span>${icon("check")}</span><div><strong>已发布 Link 导航</strong><small>三条关系方向与端点已发布</small></div></li><li class="${binding ? "" : "blocked"}"><span>${binding ? icon("check") : icon("warning")}</span><div><strong>语义与数据版本一致</strong><small>${binding ? "已锁定同一正式组合" : "等待正式数据切换"}</small></div></li><li class="${binding ? "" : "blocked"}"><span>${binding ? icon("check") : icon("warning")}</span><div><strong>证据定位与数据时点</strong><small>${binding ? "可按本版本追溯" : "尚未形成正式数据证据"}</small></div></li></ul></section></div>
      <section class="card"><div class="card-head"><div><h2>下游消费状态</h2><p>本体只展示各模块只读消费状态，不在这里编辑其配置或运行流程。</p></div></div><div class="consumer-grid">${consumerCard("智能问数", "对象、属性、已发布关系、Metric、Rule、Action Type", consumerState, consumerTone)}${consumerCard("决策中心", "Rule 证据和同版本 Action Type", consumerState, consumerTone)}${consumerCard("Agent 应用", "获准语义资源和只读证据定位", current ? "待首次消费" : consumerState, current ? "neutral" : consumerTone)}${consumerCard("报告中心", "稳定资源身份、定义、版本和历史追溯", consumerState, consumerTone)}</div></section>
      ${update && update.status !== "switched" ? `<div class="inline-alert warning">${icon("refresh")}<div><strong>待更新数据与当前正式数据相互隔离</strong><span>检查或验证完成前，正式消费者继续读取平台当前正式版本。</span></div>${button("处理待更新数据", "set-version-tab", { value: "updates", primary: true })}</div>` : ""}`;
  }

  function updateStepIndex(update) {
    if (!update) return 0;
    if (update.status === "received") return 1;
    if (update.status === "match-running" || update.status === "match-failed") return 2;
    if (update.status === "eligible") return 3;
    if (update.status === "validation-running" || update.status === "validation-failed") return 4;
    if (update.status === "validated") return 4;
    if (update.status === "switching" || update.status === "switched") return 5;
    return 0;
  }

  function renderVersionUpdates(version) {
    const update = version.update;
    const current = version.formalBinding;
    const previous = version.previousBinding;
    const currentVersionRole = isCurrentFormalVersion(version);
    const serviceVersion = formalServiceVersion();
    const serviceBinding = serviceVersion?.formalBinding || null;
    const step = updateStepIndex(update);
    const failure = update?.status === "match-failed" || update?.status === "validation-failed";
    let actionPanel = "";
    if (!update || update.status === "switched") {
      actionPanel = `<div class="update-empty"><span class="update-mark">${icon("refresh")}</span><div><h3>${current ? "检查是否有待更新数据" : "接收首个可绑定数据"}</h3><p>${current ? "获取数据工程已发布的新数据资产版本；不会中断当前正式数据。" : "语义版本已发布，但还没有正式数据。先接收数据工程提供的待更新数据。"}</p></div>${button(current ? "获取待更新数据" : "接收待更新数据", "receive-update", { primary: true, icon: "refresh" })}</div>`;
    } else if (update.status === "received") {
      actionPanel = `<div class="update-action"><div><span>下一步</span><h3>检查数据与本体是否匹配</h3><p>检查成员范围、稳定标识、字段类型和三条关系端点。刷新到达不代表数据已正式采用。</p></div>${button("运行匹配检查", "run-match", { primary: true })}</div>`;
    } else if (update.status === "match-running") {
      actionPanel = `<div class="update-action processing"><span class="spinner"></span><div><span>处理中</span><h3>正在检查数据与本体</h3><p>当前正式版本继续服务；离开页面不会产生部分切换。</p></div></div>`;
    } else if (update.status === "match-failed") {
      actionPanel = `<div class="update-failure"><span>${icon("warning")}</span><div><small>匹配检查失败</small><h3>${escapeHtml(update.failureReason)}</h3><p>${escapeHtml(update.failureDetail)}</p><div class="type-compatibility"><div><span>已发布 Property</span><strong>机构编码 · 文本</strong></div>${icon("arrow")}<div><span>待更新数据字段</span><strong>机构编码 · 整数</strong></div><em>没有兼容端点</em></div><div class="failure-actions"><a class="btn primary" href="../../data-engineering-prototype-review/review-v3/方案B2.html#/resources/asset/finance-asset-target?tab=lineage">前往数据中心</a>${button("重新获取修正数据", "refetch-update")}${button("查看证据", "open-update-evidence", { value: "match" })}</div></div></div>`;
    } else if (update.status === "eligible") {
      actionPanel = `<div class="update-action success"><div><span>已具备消费验证条件</span><h3>数据与本体匹配检查通过</h3><p>现在可以在隔离上下文运行集团成本、三家规则、银行归因和行动类型发现验证。</p></div>${button("运行业务消费验证", "run-business-validation", { primary: true })}</div>`;
    } else if (update.status === "validation-running") {
      actionPanel = `<div class="update-action processing"><span class="spinner"></span><div><span>处理中</span><h3>正在运行业务消费验证</h3><p>验证结果只用于候选判断，不会直接创建行动请求或切换正式数据。</p></div></div>`;
    } else if (update.status === "validation-failed") {
      actionPanel = `<div class="update-failure"><span>${icon("warning")}</span><div><small>业务消费验证失败</small><h3>${escapeHtml(update.failureReason)}</h3><p>${escapeHtml(update.failureDetail)} 当前正式数据继续服务，修正后需要从匹配检查重新开始。</p><div class="failure-actions">${button("重新获取修正数据", "refetch-update", { primary: true })}${button("查看证据", "open-update-evidence", { value: "validation" })}</div></div></div>`;
    } else if (update.status === "validated") {
      actionPanel = `<div class="update-action success"><div><span>等待用户确认</span><h3>业务消费验证全部通过</h3><p>切换后该数据才成为当前正式数据；提交失败时继续使用当前版本。</p></div>${button("切换为正式数据", "open-switch-data", { primary: true })}</div>`;
    } else {
      actionPanel = `<div class="update-action processing"><span class="spinner"></span><div><span>处理中</span><h3>正在切换正式数据</h3><p>完成前当前正式版本保持不变。</p></div></div>`;
    }
    return `<section class="card"><div class="card-head"><div><h2>当前正式服务与待更新数据</h2><p>待更新数据归属于 ${escapeHtml(version.label)}；正式切换前继续使用平台当前正式版本。</p></div>${button("查看证据记录", "set-version-tab", { value: "records" })}</div><div class="data-comparison"><div class="data-version current"><span>当前正式服务</span><strong class="mono">${serviceBinding ? `${escapeHtml(serviceVersion.label)} + ${escapeHtml(serviceBinding.dataVersionId)}` : "尚未形成"}</strong><small>${serviceBinding ? `${escapeHtml(serviceBinding.dataLabel)} · 截至 ${escapeHtml(serviceBinding.dataAsOf)}` : "完成用户确认切换后产生"}</small>${serviceBinding ? status("持续服务", "green") : status("不可消费", "amber")}</div><span class="compare-arrow">${icon("arrow")}</span><div class="data-version candidate"><span>${escapeHtml(version.label)} 待更新数据</span><strong class="mono">${update && update.status !== "switched" ? escapeHtml(update.dataVersionId) : "暂无"}</strong><small>${update && update.status !== "switched" ? `${escapeHtml(update.dataLabel)} · 截至 ${escapeHtml(update.dataAsOf)}` : "等待数据中心提供"}</small>${update && update.status !== "switched" ? status(updateStatusLabel(update.status), failure ? "red" : "blue", update.status.endsWith("running")) : status("未开始", "neutral")}</div></div></section>
      <section class="card update-flow-card"><div class="update-steps">${["收到待更新数据", "数据与本体匹配检查", "具备消费验证条件", "业务消费验证", "切换为正式数据"].map((label, index) => `<div class="update-step ${step > index ? "done" : step === index + 1 ? "active" : ""} ${failure && step === index + 1 ? "failed" : ""}"><span>${step > index ? icon("check") : index + 1}</span><strong>${label}</strong></div>`).join("")}</div>${actionPanel}</section>
      <div class="detail-grid half"><section class="card"><div class="card-head"><div><h2>失败保护</h2><p>更新流程不会覆盖当前正式数据。</p></div></div><ul class="protection-list"><li>${icon("check")}检查失败时继续使用当前正式版本</li><li>${icon("check")}字段类型变化不按同名字段自动迁移</li><li>${icon("check")}语义变更通过修订 Draft 和新语义版本完成</li><li>${icon("check")}失败、重试和切换证据均保留</li></ul></section><section class="card"><div class="card-head"><div><h2>上一可信数据</h2><p>数据回退只在当前正式语义版本内执行。</p></div></div>${previous ? `<div class="previous-version"><strong class="mono">${escapeHtml(previous.dataVersionId)}</strong><span>${escapeHtml(previous.dataLabel)} · 截至 ${escapeHtml(previous.dataAsOf)}</span><small>原切换时间 ${escapeHtml(previous.switchedAt)}</small></div>${currentVersionRole ? button("回退到上一可信数据", "open-rollback", { danger: true }) : status("历史记录，仅供追溯", "neutral")}` : emptyState("暂无上一可信数据", "同一语义版本完成下一次正式数据切换后，这里会保留被替换的数据版本。")}</section></div>`;
  }

  function updateStatusLabel(value) {
    return ({ received: "已收到", "match-running": "检查中", "match-failed": "匹配失败", eligible: "可验证", "validation-running": "验证中", "validation-failed": "验证失败", validated: "等待确认", switching: "切换中", switched: "已切换" })[value] || "未开始";
  }

  function renderVersionRecords(version) {
    const records = version.records || [];
    return `<section class="card"><div class="card-head"><div><h2>记录与证据</h2><p>仅显示 ${escapeHtml(version.label)} 的发布、更新、验证、切换、失败、重试和回退记录。</p></div><div class="hero-statuses">${formalRoleStatus(version)}<span>${records.length} 条</span></div></div>${records.length ? `<div class="record-list">${records.map(record => `<article class="record-row"><span class="record-icon ${record.tone || "neutral"}">${record.type === "发布" ? icon("published") : record.type === "失败" ? icon("warning") : record.type === "回退" ? icon("history") : icon("check")}</span><div><strong>${escapeHtml(record.title)}</strong><p>${escapeHtml(record.detail)}</p><small>${escapeHtml(record.time)} · ${escapeHtml(record.type)}</small></div>${status(recordDisplayStatus(record), record.tone || "neutral")}<button type="button" class="text-link" data-action="open-record-evidence" data-value="${record.id}">查看证据</button></article>`).join("")}</div>` : emptyState("还没有版本记录", "发布和后续数据操作完成后才会生成记录。")}</section>`;
  }

  function renderPublishedResource(params) {
    const version = findVersion(params.get("version"));
    const resource = findResource(version?.snapshot, params.get("id"));
    if (!version || !resource) return emptyState("找不到已发布资源", "请从精确语义版本的资源目录重新进入。", "go-published", "返回已发布本体");
    const tab = params.get("tab") || "overview";
    const tabs = [["overview", "概览"], ["definition", "定义与结构"], ["mapping", "映射与依赖"], ["consumption", "沿袭与消费"], ["versions", "版本记录"]];
    let body = "";
    if (tab === "overview") body = renderResourceOverview(version, resource);
    else if (tab === "definition") body = renderResourceDefinition(version, resource);
    else if (tab === "mapping") body = renderResourceMapping(version, resource);
    else if (tab === "consumption") body = renderResourceConsumption(version, resource);
    else body = renderResourceVersions(version, resource);
    return `<div class="detail-page resource-detail"><header class="detail-hero"><button type="button" class="back-button" data-action="back-version-resources">${icon("back")}<span>${escapeHtml(version.label)} / 资源与模型</span></button><div class="detail-identity"><span class="resource-avatar ${resourceTone(resource.kind)}">${escapeHtml(resource.code || "P")}</span><div><small>${escapeHtml(resource.kind)} · ${escapeHtml(version.label)}</small><h1>${escapeHtml(resource.displayCode ? `${resource.displayCode} ${resource.name}` : resource.name)}</h1><p>${escapeHtml(resource.definition || "")}</p></div></div><div class="hero-statuses">${status("已发布", "green")}${formalRoleStatus(version)}</div></header><div class="resource-common-strip"><div><span>稳定语义身份</span><strong class="mono">${escapeHtml(resource.id)}</strong></div><div><span>精确语义版本</span><strong class="mono">${escapeHtml(version.id)}</strong></div><div><span>适用场景</span><strong>${escapeHtml(version.scene)}</strong></div><div><span>Owner</span><strong>${RESOURCE_OWNER}</strong></div></div>${tabBar(tabs, tab, "set-resource-tab")}<section class="detail-content">${body}</section></div>`;
  }

  function renderResourceOverview(version, resource) {
    const typeFacts = specializedFacts(version, resource);
    const current = isCurrentFormalVersion(version);
    const historical = !!version.formalBinding && !current;
    return `<div class="detail-grid two-thirds"><section class="card"><div class="card-head"><div><h2>资源概览</h2><p>显示名称可修改，但下游绑定只使用稳定语义身份和精确版本。</p></div>${status("已发布", "green")}</div><div class="fact-grid">${fact("业务名称", escapeHtml(resource.name))}${fact("资源类型", escapeHtml(resource.kind))}${fact("稳定语义身份", `<span class="mono">${escapeHtml(resource.id)}</span>`)}${fact("精确语义版本", `<span class="mono">${escapeHtml(version.id)}</span>`)}${fact("适用场景", escapeHtml(version.scene))}${fact("Owner", RESOURCE_OWNER)}</div><div class="definition-box"><span>业务定义</span><p>${escapeHtml(resource.definition || "暂无定义")}</p></div></section><aside class="card"><div class="card-head"><div><h2>类型摘要</h2><p>当前资源的关键业务合同。</p></div></div><dl class="key-values">${typeFacts}</dl></aside></div><section class="card"><div class="card-head"><div><h2>版本与消费状态</h2><p>资源不会脱离精确版本单独存在。</p></div></div><div class="status-axis"><div><span>语义状态</span>${status("语义已发布", "green")}</div><div><span>数据状态</span>${formalRoleStatus(version)}</div><div><span>消费者状态</span>${status(current ? "可读取" : historical ? "历史引用" : "不可消费", current ? "green" : historical ? "neutral" : "amber")}</div><div><span>证据状态</span>${status("可追溯", "neutral")}</div></div></section>`;
  }

  function specializedFacts(version, resource) {
    if (resource.kind === "Object Type") return `<dt>稳定身份</dt><dd>${escapeHtml(findResource(version.snapshot, resource.identityPropertyId)?.name || "未设置")}</dd><dt>可读标题</dt><dd>${escapeHtml(findResource(version.snapshot, resource.titlePropertyId)?.name || "未设置")}</dd><dt>Property</dt><dd>${resource.properties?.length || 0} 项</dd><dt>实例范围</dt><dd>${resource.count?.toLocaleString?.() || "按正式数据确定"}</dd>`;
    if (resource.kind === "Property") return `<dt>所属对象</dt><dd>${escapeHtml(resource.parentName)}</dd><dt>数据类型</dt><dd>${escapeHtml(resource.type)}</dd><dt>单位</dt><dd>${escapeHtml(resource.unit)}</dd><dt>业务角色</dt><dd>${escapeHtml(resource.role || "业务属性")}</dd>`;
    if (resource.kind === "Link Type") return `<dt>方向</dt><dd>${escapeHtml(resource.direction)}</dd><dt>基数</dt><dd>${escapeHtml(resource.cardinality)}</dd><dt>起点</dt><dd>${escapeHtml(findObject(version.snapshot, resource.sourceObjectId)?.name)}</dd><dt>终点</dt><dd>${escapeHtml(findObject(version.snapshot, resource.targetObjectId)?.name)}</dd>`;
    if (resource.kind === "Metric") return `<dt>单位</dt><dd>${escapeHtml(resource.unit)}</dd><dt>适用粒度</dt><dd>${escapeHtml(resource.scope)}</dd><dt>时间语义</dt><dd>${escapeHtml(resource.time)}</dd><dt>适用对象</dt><dd>${escapeHtml(findObject(version.snapshot, resource.objectId)?.name)}</dd>`;
    if (resource.kind === "Rule") return `<dt>适用对象</dt><dd>${escapeHtml(findObject(version.snapshot, resource.objectId)?.name)}</dd><dt>判断条件</dt><dd>${escapeHtml(resource.condition)}</dd><dt>结果状态</dt><dd>命中 / 未命中 / 无法判断</dd><dt>证据要求</dt><dd>${escapeHtml(resource.evidence)}</dd>`;
    return `<dt>目标对象</dt><dd>${escapeHtml(findObject(version.snapshot, resource.objectId)?.name)}</dd><dt>必要参数</dt><dd>${escapeHtml(resource.parameters)}</dd><dt>前置证据</dt><dd>${escapeHtml(resource.prerequisite)}</dd><dt>运行边界</dt><dd>只定义行动；运行由决策中心承接</dd>`;
  }

  function renderResourceDefinition(version, resource) {
    let content = "";
    if (resource.kind === "Object Type") content = `<div class="table-wrap"><table><thead><tr><th>Property</th><th>稳定身份</th><th>类型</th><th>单位</th><th>角色</th><th>来源字段</th></tr></thead><tbody>${resource.properties.map(property => `<tr><td>${escapeHtml(property.name)}</td><td class="mono">${escapeHtml(property.id)}</td><td>${escapeHtml(property.type)}</td><td>${escapeHtml(property.unit)}</td><td>${escapeHtml(property.role)}</td><td>${escapeHtml(property.sourceField)}</td></tr>`).join("")}</tbody></table></div>`;
    else if (resource.kind === "Property") content = `<div class="definition-matrix">${fact("所属 Object Type", escapeHtml(resource.parentName))}${fact("数据类型", escapeHtml(resource.type))}${fact("单位", escapeHtml(resource.unit))}${fact("是否允许为空", resource.required ? "不允许" : "允许")}${fact("业务角色", escapeHtml(resource.role || "业务属性"))}${fact("来源字段", escapeHtml(resource.sourceField || "未映射"))}</div>`;
    else if (resource.kind === "Link Type") content = `<div class="relation-diagram"><span class="object-chip">${escapeHtml(findObject(version.snapshot, resource.sourceObjectId)?.name)}</span><div><strong>${escapeHtml(resource.name)}</strong><span>${escapeHtml(resource.cardinality)}</span>${icon("arrow")}</div><span class="object-chip">${escapeHtml(findObject(version.snapshot, resource.targetObjectId)?.name)}</span></div><div class="definition-matrix">${fact("关系方向", escapeHtml(resource.direction))}${fact("起点端点", publishedEndpointHtml(version, resource, "source"))}${fact("终点端点", publishedEndpointHtml(version, resource, "target"))}${fact("关系证据", "端点匹配数量与代表性关系")}</div>`;
    else if (resource.kind === "Metric") content = `<div class="definition-matrix">${fact("业务口径", escapeHtml(resource.definition))}${fact("单位", escapeHtml(resource.unit))}${fact("适用范围", escapeHtml(resource.scope))}${fact("时间语义", escapeHtml(resource.time))}${fact("零分母处理", "显示“无法计算”")}${fact("正式结果", "由锁定版本下的运行模块求值")}</div>`;
    else if (resource.kind === "Rule") content = `<div class="definition-matrix">${fact("判断条件", escapeHtml(resource.condition))}${fact("适用对象", escapeHtml(findObject(version.snapshot, resource.objectId)?.name))}${fact("结果状态", "命中 / 未命中 / 无法判断")}${fact("证据要求", escapeHtml(resource.evidence))}${fact("有效期", "随当前精确语义版本")}${fact("行动边界", "命中只允许请求行动，不自动创建待办")}</div>`;
    else content = `<div class="definition-matrix">${fact("目标对象", escapeHtml(findObject(version.snapshot, resource.objectId)?.name))}${fact("必要参数", escapeHtml(resource.parameters))}${fact("前置证据", escapeHtml(resource.prerequisite))}${fact("预期结果", escapeHtml(resource.result))}${fact("确认要求", "必须由人确认")}${fact("失败表现", "请求失败并保留证据，不生成待办")}</div>`;
    return `<section class="card"><div class="card-head"><div><h2>定义与结构</h2><p>该内容来自发布时的不可变资源快照。</p></div></div>${content}</section>`;
  }

  function renderResourceMapping(version, resource) {
    const deps = (resource.depends || []).map(id => findResource(version.snapshot, id)).filter(Boolean);
    const contract = versionDataContract(version);
    let mapping = "";
    if (resource.kind === "Object Type") {
      const member = versionMemberById(version, resource.memberId);
      mapping = `<div class="asset-detail"><div class="asset-title-row"><span class="asset-badge">DA</span><div><strong>${escapeHtml(contract.name)}</strong><p>${escapeHtml(member?.name)} · ${escapeHtml(member?.grain)}</p></div>${status("发布时映射", "green")}</div><dl class="key-values compact"><dt>资产版本</dt><dd class="mono">${escapeHtml(contract.versionLabel)}</dd><dt>成员稳定标识</dt><dd class="mono">${escapeHtml(member?.id)}</dd><dt>数据截至时间</dt><dd>${escapeHtml(contract.asOf)}</dd><dt>映射数量</dt><dd>${resource.properties.length} 项</dd></dl></div>`;
    } else if (resource.kind === "Property") {
      mapping = `<div class="mapping-pair-large"><div><span>数据资产字段</span><strong>${escapeHtml(resource.sourceField || "—")}</strong><small class="mono">${escapeHtml(contract.versionLabel)}</small></div>${icon("arrow")}<div><span>已发布 Property</span><strong>${escapeHtml(resource.name)}</strong><small class="mono">${escapeHtml(resource.id)}</small></div></div>`;
    } else if (resource.kind === "Link Type") {
      const sourceEndpoint = publishedEndpointDescriptor(version, resource, "source");
      const targetEndpoint = publishedEndpointDescriptor(version, resource, "target");
      mapping = `<div class="mapping-pair-large"><div><span>起点</span><strong>${escapeHtml(findObject(version.snapshot, resource.sourceObjectId)?.name)} · ${escapeHtml(sourceEndpoint.label)}</strong><small class="mono">${escapeHtml(sourceEndpoint.stableId || "稳定身份缺失")}</small></div>${icon("arrow")}<div><span>终点</span><strong>${escapeHtml(findObject(version.snapshot, resource.targetObjectId)?.name)} · ${escapeHtml(targetEndpoint.label)}</strong><small class="mono">${escapeHtml(targetEndpoint.stableId || "稳定身份缺失")}</small></div></div>`;
    } else {
      mapping = deps.length ? `<div class="dependency-list">${deps.map(dep => `<button type="button" data-action="open-published-resource" data-value="${dep.id}"><span class="mini-type ${resourceTone(dep.kind)}">${escapeHtml(dep.code || "P")}</span><div><strong>${escapeHtml(dep.name)}</strong><small class="mono">${escapeHtml(dep.id)}</small></div>${icon("chevron")}</button>`).join("")}</div>` : emptyState("没有直接依赖", "该资源不引用其他语义资源。")
    }
    return `<div class="detail-grid half"><section class="card"><div class="card-head"><div><h2>${resource.kind === "Object Type" || resource.kind === "Property" || resource.kind === "Link Type" ? "发布时映射" : "语义依赖"}</h2><p>全部引用锁定在当前精确版本内。</p></div></div>${mapping}</section><section class="card"><div class="card-head"><div><h2>依赖完整性</h2><p>找不到精确资源时不会按同名资源替代。</p></div>${status("完整", "green")}</div><ul class="protection-list"><li>${icon("check")}稳定资源身份可定位</li><li>${icon("check")}精确语义版本一致</li><li>${icon("check")}来源资产和映射证据可追溯</li><li>${icon("check")}未使用显示名称自动绑定</li></ul></section></div>`;
  }

  function renderResourceConsumption(version, resource) {
    const binding = version.formalBinding;
    const contract = versionDataContract(version);
    const current = isCurrentFormalVersion(version);
    const historical = !!binding && !current;
    return `<div class="detail-grid half"><section class="card"><div class="card-head"><div><h2>数据沿袭</h2><p>从正式数据回溯到来源系统和发布资产；链路只读。</p></div>${status("可追溯", "green")}</div><div class="lineage-chain-small"><span>业务系统</span>${icon("arrow")}<span>标准化管道</span>${icon("arrow")}<span>数据资产</span>${icon("arrow")}<span>${escapeHtml(resource.kind)}</span></div><dl class="key-values compact"><dt>数据资产</dt><dd>${escapeHtml(contract.name)}</dd><dt>发布时资产版本</dt><dd class="mono">${escapeHtml(contract.versionLabel)}</dd><dt>${current ? "当前正式数据版本" : historical ? "历史正式数据版本" : "正式数据版本"}</dt><dd class="mono">${binding ? escapeHtml(binding.dataVersionId) : "等待绑定"}</dd><dt>数据截至</dt><dd>${binding ? escapeHtml(binding.dataAsOf) : "未形成"}</dd></dl><button type="button" class="text-link" data-action="open-lineage-detail" data-value="asset">查看完整来源链</button></section><section class="card"><div class="card-head"><div><h2>消费影响</h2><p>下游只能读取与引用，不得修改或重新解释此资源。</p></div>${status(current ? "可读取" : historical ? "历史引用" : "不可消费", current ? "green" : historical ? "neutral" : "amber")}</div><div class="impact-list"><div><strong>智能问数</strong><span>${current ? "精确版本可发现" : historical ? "仅供历史追溯" : "等待正式数据"}</span></div><div><strong>决策中心</strong><span>${current && (resource.kind === "Rule" || resource.kind === "Action Type") ? "可作为行动证据引用" : historical ? "仅供历史追溯" : "只读语义引用"}</span></div><div><strong>Agent 应用</strong><span>${historical ? "历史引用，不保存定义副本" : "只读引用，不保存定义副本"}</span></div><div><strong>报告中心</strong><span>可按稳定身份回查历史定义</span></div></div></section></div>`;
  }

  function renderResourceVersions(version, resource) {
    const sameIdentity = state.publishedVersions.filter(item => findResource(item.snapshot, resource.id));
    return `<section class="card"><div class="card-head"><div><h2>版本记录</h2><p>同一稳定语义身份在各精确 Published 版本中的定义可独立追溯。</p></div><span>${sameIdentity.length} 个版本</span></div><div class="version-timeline">${sameIdentity.map(item => {
      const historical = findResource(item.snapshot, resource.id);
      return `<article class="timeline-row ${item.id === version.id ? "active" : ""}"><span class="timeline-dot"></span><div><strong>${escapeHtml(item.label)} · ${escapeHtml(historical.name)}</strong><p>${escapeHtml(historical.definition || "")}</p><small>${escapeHtml(item.publishedAt)} · ${item.id === version.id ? "当前查看版本" : "历史定义"}</small></div>${status("已发布", "green")}<button type="button" class="text-link" data-action="open-resource-version" data-version="${item.id}" data-value="${resource.id}">查看详情</button></article>`;
    }).join("")}</div></section><div class="inline-note">${icon("history")}<div><strong>旧版本保持原定义</strong><span>语义升级、废弃或替代不会改写旧报告和旧消费证据中的资源引用。</span></div></div>`;
  }

  function renderOverlay() {
    if (ui.modal) return `<div class="modal-layer" data-action="backdrop-close">${renderModal()}</div>`;
    if (ui.drawer) return `<div class="drawer-layer" data-action="backdrop-close">${renderDrawer()}</div>`;
    return "";
  }

  function modalFrame(title, subtitle, body, footer, size = "") {
    return `<section class="modal ${size}" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-overlay-panel><header><div><h2 id="modal-title">${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div><button type="button" class="icon-button" data-action="close-overlay" aria-label="关闭">${icon("close")}</button></header><div class="modal-body">${body}</div><footer>${footer}</footer></section>`;
  }

  function objectOptions(draft, selectedId = "") {
    return (draft?.objects || []).map(object => `<option value="${escapeHtml(object.id)}" ${object.id === selectedId ? "selected" : ""}>${escapeHtml(object.name)}</option>`).join("");
  }

  function dependencyChoices(items, inputName, tone) {
    return items.length ? `<div class="dependency-choices">${items.map(item => `<label class="dependency-choice"><input type="checkbox" name="${escapeHtml(inputName)}" value="${escapeHtml(item.id)}" /><span class="mini-type ${tone || resourceTone(item.kind || "")}">${escapeHtml(item.code || "P")}</span><div><strong>${escapeHtml(item.displayCode ? `${item.displayCode} ${item.name}` : item.name)}</strong><small class="mono">${escapeHtml(item.id)}</small></div></label>`).join("")}</div>` : `<div class="dependency-empty">当前还没有可选择的依赖资源</div>`;
  }

  function renderModal() {
    const draft = activeDraft();
    if (ui.modal === "create-draft") return modalFrame("创建本体 Draft", "先定义本体的业务范围，再进入空白本体建模工作台建立 Object Type。", `<div class="form-grid"><label class="form-field full"><span>本体名称</span><input id="draft-name" value="" placeholder="例如：集团融资业务本体" autocomplete="off" /></label><label class="form-field full"><span>英文业务编码</span><div class="prefixed-input"><b>ONT-</b><input id="draft-code" placeholder="GROUP-FINANCING-OPTIMIZATION" autocomplete="off" /></div></label><label class="form-field full"><span>业务定义</span><textarea id="draft-definition" rows="3" placeholder="说明这一本体统一表达哪些业务事实和行动。"></textarea></label><label class="form-field full"><span>适用场景</span><select id="draft-scene"><option>集团融资成本与债务结构优化</option><option>暂不指定</option></select></label></div><div class="inline-note">${icon("layers")}<div><strong>创建后是空白 Draft</strong><span>系统不会自动复制源表字段，也不会预置正式资源或消费结果。</span></div></div>`, `${button("取消", "close-overlay")}${button("创建并进入建模工作台", "confirm-create-draft", { primary: true })}`);
    if (ui.modal === "add-object") return modalFrame("创建 Object Type", "先建立真实业务实体或事件骨架，数据资产与 Property 在对象详情中配置。", `<div class="form-grid"><label class="form-field"><span>业务名称</span><input id="object-name" placeholder="例如：融资主体" /></label><label class="form-field"><span>类型</span><select id="object-kind"><option>业务实体</option><option>业务事件</option></select></label><label class="form-field full"><span>英文业务编码</span><div class="prefixed-input"><b>OBJ-</b><input id="object-code" placeholder="FINANCING-ENTITY" autocomplete="off" /></div></label><label class="form-field full"><span>业务定义</span><textarea id="object-definition" rows="3" placeholder="说明该对象在业务中代表什么，而不是对应哪张表。"></textarea></label></div><div class="inline-alert neutral">${icon("check")}<div><strong>下一步</strong><span>创建后进入对象详情，选择已发布数据资产成员，再显式创建或映射 Property。</span></div></div>`, `${button("取消", "close-overlay")}${button("创建 Object Type", "confirm-add-object", { primary: true })}`);
    if (ui.modal === "asset-picker") {
      const object = findObject(draft, ui.assetObjectId);
      return modalFrame("选择数据资产成员", `为 ${object?.name || "当前对象"} 选择一个已发布成员；本体管理不会编辑数据工程配置。`, `<div class="asset-picker-head"><div><span class="asset-badge">DA</span><div><strong>${escapeHtml(publishedAsset.name)}</strong><p>${escapeHtml(publishedAsset.versionLabel)} · 截至 ${escapeHtml(publishedAsset.asOf)}</p></div></div>${status("已发布", "green")}</div><div class="member-picker">${publishedAsset.members.map(member => `<button type="button" class="member-option ${ui.assetChoice === member.id ? "selected" : ""}" data-action="choose-asset-member" data-value="${member.id}"><span class="radio-dot"></span><div><strong>${escapeHtml(member.name)}</strong><p>${escapeHtml(member.grain)} · ${member.rows.toLocaleString()} 行</p><small class="mono">${escapeHtml(member.id)}</small></div>${member.target === object?.name ? status("推荐", "blue") : ""}</button>`).join("")}</div><div class="inline-note">${icon("eye")}<div><strong>选择范围</strong><span>场景字段不是数据源身份或目录归属依据；本体范围由获准资产、当前映射和场景清单共同确定。</span></div></div>`, `${button("取消", "close-overlay")}${button("选择成员", "confirm-asset-member", { primary: true })}`, "wide");
    }
    if (ui.modal === "add-property") {
      const object = findObject(draft, ui.propertyObjectId);
      const fields = fieldsFor(object);
      const selectedField = fields.find(field => field.id === ui.propertyFieldChoice);
      const suggestedPropertyCode = selectedField ? `${String(object?.id || "").replace(/^OBJ-/, "")}-${normalizeBusinessCode(selectedField.id)}` : "";
      return modalFrame("从数据资产字段创建 Property", `只创建具有明确业务价值的属性；不会批量照搬 ${memberById(object?.memberId)?.name || "源成员"} 全部字段。`, `${fields.length ? `<div class="field-choice-list">${fields.map(field => {
        const used = object.properties.some(property => property.sourceFieldId === field.id);
        return `<button type="button" class="field-choice ${ui.propertyFieldChoice === field.id ? "selected" : ""}" data-action="choose-property-field" data-value="${field.id}" ${used ? "disabled" : ""}><span class="field-type">${escapeHtml(field.type.slice(0, 1))}</span><div><strong>${escapeHtml(field.name)}</strong><p>${escapeHtml(field.type)} · 示例 ${escapeHtml(field.sample)}</p></div>${used ? status("已使用", "neutral") : ""}</button>`;
      }).join("")}</div><div class="form-grid top-gap"><label class="form-field"><span>Property 业务名称</span><input id="property-name" placeholder="可与源字段不同" /></label><label class="form-field"><span>业务类型</span><select id="property-type"><option>文本</option><option>数值</option><option>日期</option><option>枚举</option></select></label><label class="form-field full"><span>英文业务编码</span><div class="prefixed-input"><b>PROP-</b><input id="property-code" value="${escapeHtml(suggestedPropertyCode)}" placeholder="FINANCING-ENTITY-UNIT-CODE" autocomplete="off" /></div></label><label class="form-field"><span>单位</span><input id="property-unit" value="—" placeholder="数值属性需填写业务单位" /></label><label class="form-field full"><span>业务定义</span><textarea id="property-definition" rows="2" placeholder="说明该属性对业务判断的意义。"></textarea></label></div>` : emptyState("尚未选择数据资产成员", "先返回对象详情选择已发布成员。")}`, `${button("取消", "close-overlay")}${button("创建并映射", "confirm-add-property", { primary: true, disabled: !fields.length })}`, "wide");
    }
    if (ui.modal === "resource-picker") {
      return modalFrame("添加语义资源", "选择一种资源，完成后返回本体建模工作台。", `<div class="resource-picker-grid"><button type="button" class="resource-picker-card metric" data-action="open-add-metric" data-value="${escapeHtml(ui.resourceObjectId || "")}"><span class="resource-avatar metric">M</span><div><strong>Metric</strong><p>定义可复用的业务事实、单位、范围、时间语义和依赖。</p></div>${icon("chevron")}</button><button type="button" class="resource-picker-card rule" data-action="open-add-rule" data-value="${escapeHtml(ui.resourceObjectId || "")}"><span class="resource-avatar rule">R</span><div><strong>Rule</strong><p>基于当前已配置 Metric 判断问题，并声明结果与证据要求。</p></div>${icon("chevron")}</button><button type="button" class="resource-picker-card action" data-action="open-add-action" data-value="${escapeHtml(ui.resourceObjectId || "")}"><span class="resource-avatar action">A</span><div><strong>Action Type</strong><p>定义问题命中后允许请求的行动及人工确认要求。</p></div>${icon("chevron")}</button></div>`, button("取消", "close-overlay"));
    }
    if (ui.modal === "add-metric") {
      const dependencyItems = [...allResources(draft).filter(item => ["Property", "Link Type", "Metric"].includes(item.kind))];
      return modalFrame("创建 Metric", "配置业务事实的完整口径与语义依赖。", `<div class="form-grid"><label class="form-field"><span>业务名称</span><input id="metric-name" placeholder="例如：余额加权平均融资成本" /></label><label class="form-field"><span>适用 Object</span><select id="metric-object">${objectOptions(draft, ui.resourceObjectId)}</select></label><label class="form-field full"><span>英文业务编码</span><div class="prefixed-input"><b>MET-</b><input id="metric-code" placeholder="WAVG-COST" autocomplete="off" /></div></label><label class="form-field"><span>单位</span><input id="metric-unit" placeholder="例如：% 或 人民币元" /></label><label class="form-field"><span>时间语义</span><input id="metric-time" value="数据截至时点" /></label><label class="form-field full"><span>适用粒度与范围</span><input id="metric-scope" placeholder="例如：集团、板块、单一主体、任意主体集合" /></label><label class="form-field full"><span>业务定义与计算口径</span><textarea id="metric-definition" rows="3" placeholder="说明如何基于获准属性和关系计算该业务事实。"></textarea></label><label class="form-field full"><span>零分母或无数据处理</span><input id="metric-zero" value="分母为零或没有有效数据时返回无法计算" /></label><fieldset class="form-field full dependency-fieldset"><legend>依赖资源</legend>${dependencyChoices(dependencyItems, "metric-dep")}</fieldset></div>`, `${button("取消", "close-overlay")}${button("创建 Metric", "confirm-add-metric", { primary: true })}`, "wide");
    }
    if (ui.modal === "add-rule") {
      return modalFrame("创建 Rule", "基于已配置 Metric 定义问题判断和证据要求。", `<div class="form-grid"><label class="form-field"><span>规则名称</span><input id="rule-name" placeholder="例如：融资成本偏高" /></label><label class="form-field"><span>规则编号</span><input id="rule-code" value="R${String((draft?.rules?.length || 0) + 1).padStart(2, "0")}" /></label><label class="form-field full"><span>英文业务编码</span><div class="prefixed-input"><b>RULE-</b><input id="rule-business-code" placeholder="HIGH-COST" autocomplete="off" /></div></label><label class="form-field full"><span>适用 Object</span><select id="rule-object">${objectOptions(draft, ui.resourceObjectId)}</select></label><label class="form-field full"><span>判断条件</span><textarea id="rule-condition" rows="2" placeholder="例如：主体成本高于集团基准0.25个百分点。"></textarea></label><label class="form-field full"><span>证据要求</span><input id="rule-evidence" placeholder="例如：指标快照、贡献机构和关联借据" /></label><label class="form-field full"><span>业务定义</span><textarea id="rule-definition" rows="2" placeholder="说明该规则识别什么业务问题。"></textarea></label><fieldset class="form-field full dependency-fieldset"><legend>依赖 Metric</legend>${dependencyChoices(draft?.metrics || [], "rule-dep", "metric")}</fieldset></div>`, `${button("取消", "close-overlay")}${button("创建 Rule", "confirm-add-rule", { primary: true })}`, "wide");
    }
    if (ui.modal === "add-action") {
      const dependencies = allResources(draft).filter(item => ["Rule", "Link Type"].includes(item.kind));
      return modalFrame("创建 Action Type", "定义可请求行动；提醒、确认和待办运行记录不在此处维护。", `<div class="form-grid"><label class="form-field"><span>行动名称</span><input id="action-name" placeholder="例如：发起融资优化建议" /></label><label class="form-field"><span>目标 Object</span><select id="action-object">${objectOptions(draft, ui.resourceObjectId)}</select></label><label class="form-field full"><span>英文业务编码</span><div class="prefixed-input"><b>ACTION-</b><input id="action-code" placeholder="FINANCING-OPTIMIZATION" autocomplete="off" /></div></label><label class="form-field full"><span>必要参数</span><textarea id="action-parameters" rows="2" placeholder="例如：融资主体、规则命中、指标快照、优先协商机构。"></textarea></label><label class="form-field full"><span>前置证据</span><input id="action-prerequisite" placeholder="说明请求行动前必须具备的对象、规则和证据。" /></label><label class="form-field full"><span>预期结果</span><input id="action-result" placeholder="例如：形成行动请求，人工确认后形成负责人待办。" /></label><label class="form-field"><span>确认要求</span><select id="action-confirmation"><option>必须人工确认</option></select></label><label class="form-field full"><span>业务定义</span><textarea id="action-definition" rows="2" placeholder="说明该行动允许业务用户请求什么。"></textarea></label><fieldset class="form-field full dependency-fieldset"><legend>依赖 Rule 或 Link</legend>${dependencyChoices(dependencies, "action-dep")}</fieldset></div>`, `${button("取消", "close-overlay")}${button("创建 Action Type", "confirm-add-action", { primary: true })}`, "wide");
    }
    if (ui.modal === "add-link") {
      const objects = draft?.objects || [];
      const sourceId = ui.linkSourceObjectId || ui.linkObjectId || objects[0]?.id || "";
      const targetId = ui.linkTargetObjectId && ui.linkTargetObjectId !== sourceId ? ui.linkTargetObjectId : objects.find(item => item.id !== sourceId)?.id || "";
      ui.linkSourceObjectId = sourceId;
      ui.linkTargetObjectId = targetId;
      const source = findObject(draft, sourceId);
      const target = findObject(draft, targetId);
      return modalFrame("创建 Link Type", "明确选择关系两端、方向、基数和类型兼容的稳定端点。", `<div class="form-grid"><label class="form-field full"><span>业务名称</span><input id="link-name" placeholder="例如：主体拥有融资" /></label><label class="form-field full"><span>英文业务编码</span><div class="prefixed-input"><b>LINK-</b><input id="link-code" placeholder="ENTITY-FINANCING" autocomplete="off" /></div></label><label class="form-field"><span>起点 Object</span><select id="link-source">${objectOptions(draft, sourceId)}</select></label><label class="form-field"><span>终点 Object</span><select id="link-target">${objectOptions(draft, targetId)}</select></label><label class="form-field"><span>起点端点</span><select id="link-source-endpoint">${endpointOptionsForObject(draft, sourceId)}</select></label><label class="form-field"><span>终点端点</span><select id="link-target-endpoint">${endpointOptionsForObject(draft, targetId)}</select></label><label class="form-field"><span>基数</span><select id="link-cardinality"><option>一对多</option><option>多对一</option><option>一对一</option><option>多对多</option></select></label><label class="form-field"><span>方向</span><input id="link-direction" value="${escapeHtml(source?.name || "起点")} → ${escapeHtml(target?.name || "终点")}" readonly /></label><label class="form-field full"><span>业务定义</span><textarea id="link-definition" rows="2" placeholder="说明该关系在业务中表达什么。"></textarea></label></div><div class="endpoint-readiness"><div><span>起点可选端点</span><strong data-endpoint-count="source">${endpointCandidates(draft, source).length}</strong></div><div><span>终点可选端点</span><strong data-endpoint-count="target">${endpointCandidates(draft, target).length}</strong></div><p>端点来自已映射的身份或已标记的 Link 端点；系统不会按同名字段自动连接。</p></div><div class="endpoint-compatibility" id="link-endpoint-compatibility">选择两端端点后检查类型兼容性</div>`, `${button("取消", "close-overlay")}${button("创建 Link Type", "confirm-add-link", { primary: true, disabled: objects.length < 2 })}`, "wide");
    }
    if (ui.modal === "publish") {
      const counts = resourceCounts(draft);
      return modalFrame("发布语义版本", "发布成功后生成不可变精确版本；不会自动变成消费就绪。", `<dl class="key-values modal-facts"><dt>本体</dt><dd>${escapeHtml(draft?.name)}</dd><dt>本体稳定身份</dt><dd class="mono">${escapeHtml(draft?.ontologyStableId)}</dd><dt>发布范围</dt><dd>${counts.objects} Object · ${counts.properties} Property · ${counts.links} Link · ${counts.metrics} Metric · ${counts.rules} Rule · ${counts.actions} Action Type</dd><dt>统一校验</dt><dd>${status("通过", "green")}</dd><dt>数据映射</dt><dd>${escapeHtml(publishedAsset.versionLabel)} · 四成员三关系</dd><dt>发布后数据状态</dt><dd>${status("等待数据绑定", "amber")}</dd></dl><div class="inline-alert warning">${icon("warning")}<div><strong>原子发布</strong><span>任一关键资源发布失败时保持 Draft，不生成部分 Published 版本。</span></div></div>`, `${button("取消", "close-overlay")}${button(ui.busy === "publishing" ? "发布中" : "确认发布", "confirm-publish", { primary: true, disabled: ui.busy === "publishing" })}`);
    }
    if (ui.modal === "switch-data") {
      const version = currentVersion(); const update = version?.update;
      const serviceVersion = formalServiceVersion(); const serviceBinding = serviceVersion?.formalBinding;
      return modalFrame("切换为正式数据", "确认后将精确语义版本与本次已验证数据作为当前正式使用版本。", `<div class="switch-summary"><div><span>精确语义版本</span><strong>${escapeHtml(version?.label)}</strong><small class="mono">${escapeHtml(version?.id)}</small></div><div><span>待更新数据</span><strong class="mono">${escapeHtml(update?.dataVersionId)}</strong><small>${escapeHtml(update?.dataLabel)} · 截至 ${escapeHtml(update?.dataAsOf)}</small></div></div><dl class="key-values modal-facts"><dt>数据与本体匹配</dt><dd>${status("通过", "green")}</dd><dt>业务消费验证</dt><dd>${status("全部通过", "green")}</dd><dt>平台当前正式版本</dt><dd class="mono">${serviceBinding ? `${escapeHtml(serviceVersion.label)} + ${escapeHtml(serviceBinding.dataVersionId)}` : "尚未形成"}</dd><dt>失败保护</dt><dd>提交失败时保持当前正式版本不变</dd></dl>`, `${button("取消", "close-overlay")}${button("确认切换", "confirm-switch-data", { primary: true })}`);
    }
    if (ui.modal === "rollback") {
      const version = currentVersion();
      return modalFrame("回退到上一可信数据", "回退会产生新的正式切换记录，不删除或改写任何历史证据。", `<div class="switch-summary"><div><span>当前正式数据</span><strong class="mono">${escapeHtml(version?.formalBinding?.dataVersionId)}</strong><small>${escapeHtml(version?.formalBinding?.dataAsOf)}</small></div><div><span>回退目标</span><strong class="mono">${escapeHtml(version?.previousBinding?.dataVersionId)}</strong><small>${escapeHtml(version?.previousBinding?.dataAsOf)}</small></div></div><div class="inline-alert warning">${icon("history")}<div><strong>完成前继续使用当前数据</strong><span>回退失败不会产生部分切换，原正式数据保持服务。</span></div></div>`, `${button("取消", "close-overlay")}${button("确认回退", "confirm-rollback", { danger: true, primary: true })}`);
    }
    if (ui.modal === "reset") return modalFrame("重置操作状态", "恢复本体管理的初始工作区。", `<div class="inline-alert error">${icon("warning")}<div><strong>将清除本浏览器中的建模和发布操作</strong><span>已执行的校验、发布、数据更新、失败、切换和回退状态都会被清除。</span></div></div>`, `${button("取消", "close-overlay")}${button("确认重置", "confirm-reset", { danger: true, primary: true })}`);
    if (ui.modal === "help") return modalFrame("操作指南", "本体建模与已发布本体按生命周期分为两个工作区。", `<div class="help-steps"><div><b>1</b><span><strong>创建业务骨架</strong>先创建本体 Draft 和 Object Type。</span></div><div><b>2</b><span><strong>对象内完成映射</strong>选择已发布数据资产成员，显式创建 Property 和 Link 端点。</span></div><div><b>3</b><span><strong>统一校验并发布</strong>阻断项返回原位置修正；通过后生成不可变语义版本。</span></div><div><b>4</b><span><strong>处理数据更新</strong>匹配检查、业务验证、用户确认切换相互分开。</span></div><div><b>5</b><span><strong>追溯和恢复</strong>记录与证据归属于精确版本，可回退到上一可信数据。</span></div></div>`, button("知道了", "close-overlay", { primary: true }));
    return "";
  }

  function drawerFrame(title, subtitle, body, footer = "") {
    return `<aside class="drawer" role="dialog" aria-modal="true" data-overlay-panel><header><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div><button type="button" class="icon-button" data-action="close-overlay" aria-label="关闭">${icon("close")}</button></header><div class="drawer-body">${body}</div><footer>${footer || button("关闭", "close-overlay")}</footer></aside>`;
  }

  function renderDrawer() {
    const draft = activeDraft();
    if (ui.drawer.type === "draft-resource") {
      const resource = findResource(draft, ui.drawer.id);
      if (!resource) return drawerFrame("资源详情", "当前 Draft", emptyState("资源不存在", "返回工作台重新选择。"));
      return drawerFrame(resource.displayCode ? `${resource.displayCode} ${resource.name}` : resource.name, `${resource.kind || "语义资源"} · Draft`, `<div class="drawer-resource-head"><span class="resource-avatar ${resourceTone(resource.kind || "")}">${escapeHtml(resource.code || "R")}</span><div><span>稳定语义身份</span><strong class="mono">${escapeHtml(resource.id)}</strong></div></div><label class="form-field full"><span>业务定义</span><textarea id="resource-definition-input" rows="5">${escapeHtml(resource.definition || "")}</textarea></label><dl class="key-values"><dt>Owner</dt><dd>${RESOURCE_OWNER}</dd><dt>适用场景</dt><dd>${escapeHtml(draft.scene)}</dd><dt>状态</dt><dd>${status("Draft", "blue")}</dd><dt>依赖</dt><dd>${escapeHtml((resource.depends || []).join("、") || "无")}</dd></dl><div class="inline-note">${icon("link")}<div><strong>资源边界</strong><span>${resource.kind === "Metric" ? "Metric计算业务事实。" : resource.kind === "Rule" ? "Rule判断是否存在问题。" : resource.kind === "Action Type" ? "Action Type只定义可请求行动，不是运行记录。" : "资源随本体统一发布。"}</span></div></div>`, `${button("取消", "close-overlay")}${button("保存定义", "save-resource-definition", { primary: true, value: resource.id })}`);
    }
    if (ui.drawer.type === "lineage") {
      const publishedContext = route().path.startsWith("published") ? currentVersion() : null;
      const lineageAsset = versionDataContract(publishedContext);
      const lineageModel = publishedContext?.snapshot || draft;
      const value = ui.drawer.id;
      const isFieldGroup = String(value).startsWith("fields:");
      const memberId = isFieldGroup ? String(value).slice(7) : value;
      const member = lineageAsset.members.find(item => item.id === memberId) || null;
      const object = member ? lineageModel?.objects?.find(item => item.memberId === member.id) : null;
      const sourceNames = { "source:workbook": "融资一览表" };
      const title = isFieldGroup ? `${member?.name || "资产成员"}字段` : member ? member.name : value === "asset" ? lineageAsset.name : value === "pipeline" ? "融资数据标准化管道" : sourceNames[value] || "数据资产来源";
      const fieldRows = isFieldGroup ? `<div class="lineage-field-list"><header><span>数据资产字段</span><span>Property 映射</span><span>Link 端点</span></header>${(lineageAsset.fields[member.id] || []).map(field => {
        const mapping = fieldLineage(lineageModel, object, field);
        return `<div><section><strong>${escapeHtml(field.name)}</strong><small>${escapeHtml(field.type)} · ${escapeHtml(field.sample)}</small></section><span>${mapping.properties.length ? mapping.properties.map(property => escapeHtml(property.name)).join("、") : "—"}</span><span>${mapping.endpoint ? mapping.linkNames.length ? mapping.linkNames.map(name => escapeHtml(name)).join("、") : "已标记，尚未被 Link 使用" : "—"}</span></div>`;
      }).join("")}</div>` : "";
      return drawerFrame(title, "只读数据沿袭", `<div class="lineage-vertical"><div><span>01</span><strong>融资一览表</strong><small>手工上传工作簿 · 当前资产来源</small></div><i></i><div><span>02</span><strong>融资数据标准化管道</strong><small>处理、质量和调度由数据工程维护</small></div><i></i><div><span>03</span><strong>${escapeHtml(lineageAsset.name)}</strong><small>${escapeHtml(lineageAsset.versionLabel)} · ${escapeHtml(lineageAsset.asOf)}</small></div>${member ? `<i></i><div class="active"><span>04</span><strong>${escapeHtml(member.name)}</strong><small class="mono">${escapeHtml(member.id)}</small></div>` : ""}${isFieldGroup && object ? `<i></i><div class="active"><span>05</span><strong>${escapeHtml(object.name)}</strong><small>字段映射与 Link 端点</small></div>` : ""}</div>${fieldRows}<div class="inline-alert neutral">${icon("eye")}<div><strong>来源链只读</strong><span>数据源、管道、字段、质量和资产发布由数据中心维护。</span></div></div>`, `${button("关闭", "close-overlay")}<a class="btn primary" href="../../data-engineering-prototype-review/review-v3/方案B2.html#/resources/asset/finance-asset-target?tab=lineage">前往数据中心</a>`);
    }
    if (ui.drawer.type === "consumer") return drawerFrame(ui.drawer.id, "下游消费边界", `<dl class="key-values"><dt>允许</dt><dd>按稳定资源身份和精确已发布版本只读发现与引用</dd><dt>禁止</dt><dd>创建、修改或重新解释 Object、Property、Metric、Rule 和 Action Type</dd><dt>正式上下文</dt><dd>必须能够证明使用同一语义版本和正式数据版本</dd><dt>失败状态</dt><dd>资源缺失、Link不完整、单位变化或证据缺失时不可消费</dd></dl>`);
    if (ui.drawer.type === "validation-evidence") {
      const version = ui.drawer.versionId ? findVersion(ui.drawer.versionId) : null;
      const validation = version?.validation || draft?.validation;
      return drawerFrame("校验证据", version ? `${version.label} · 发布证据` : "当前 Draft", `<dl class="key-values"><dt>运行时间</dt><dd>${escapeHtml(validation?.ranAt || "尚未运行")}</dd><dt>检查范围</dt><dd>对象结构、属性映射、关系端点、业务逻辑</dd><dt>结果</dt><dd>${validation?.status === "passed" ? status("通过", "green") : status("未通过", "red")}</dd><dt>阻断项</dt><dd>${validation?.issues?.length || 0}</dd>${validation?.evidenceId ? `<dt>证据标识</dt><dd class="mono">${escapeHtml(validation.evidenceId)}</dd>` : ""}</dl>`);
    }
    if (ui.drawer.type === "record") {
      const version = currentVersion(); const record = version?.records?.find(item => item.id === ui.drawer.id);
      return drawerFrame(record?.title || "记录证据", `${version?.label || "精确版本"} · ${record?.type || "记录"}`, `<dl class="key-values"><dt>发生时间</dt><dd>${escapeHtml(record?.time)}</dd><dt>业务状态</dt><dd>${escapeHtml(recordDisplayStatus(record))}</dd><dt>版本当前角色</dt><dd>${isCurrentFormalVersion(version) ? "当前正式使用" : version?.formalBinding ? "历史正式记录" : "等待数据绑定"}</dd><dt>说明</dt><dd>${escapeHtml(record?.detail)}</dd><dt>精确语义版本</dt><dd class="mono">${escapeHtml(version?.id)}</dd><dt>追溯标识</dt><dd class="mono">${escapeHtml(record?.evidenceRef || record?.id)}</dd>${record?.technicalRefs ? `<dt>合同追溯</dt><dd>${escapeHtml(record.technicalRefs)}</dd>` : ""}</dl><div class="inline-note">${icon("history")}<div><strong>证据只读</strong><span>编号仅用于详细追溯，不作为主流程按钮或状态名称。</span></div></div>`);
    }
    if (ui.drawer.type === "update-evidence") {
      const version = currentVersion(); const update = version?.update;
      return drawerFrame("数据更新证据", `${version?.label || "精确版本"} · ${update?.dataVersionId || "待更新数据"}`, `<dl class="key-values"><dt>待更新数据版本</dt><dd class="mono">${escapeHtml(update?.dataVersionId || "—")}</dd><dt>数据与本体匹配检查</dt><dd>${status(update?.matchEvidenceId ? update.status === "match-failed" ? "失败" : "已记录" : "未运行", update?.status === "match-failed" ? "red" : "neutral")}</dd><dt>消费验证资格</dt><dd>${update?.eligible ? "T018 · 具备资格" : "T018 · 未形成"}</dd><dt>业务消费验证</dt><dd>${update?.validationEvidenceId ? update.status === "validation-failed" ? status("失败", "red") : "已记录" : "未运行"}</dd><dt>正式采用</dt><dd>${update?.status === "switched" ? "T019 · 已提交" : "T019 · 未提交"}</dd><dt>匹配证据</dt><dd class="mono">${escapeHtml(update?.matchEvidenceId || "—")}</dd><dt>验证证据</dt><dd class="mono">${escapeHtml(update?.validationEvidenceId || "—")}</dd><dt>失败原因</dt><dd>${escapeHtml(update?.failureReason || "无")}</dd><dt>合同追溯</dt><dd>C029 · T018 · T019</dd></dl>`);
    }
    return drawerFrame("查看详情", "只读信息", emptyState("暂无内容", "关闭后返回原页面。"));
  }

  function appendRecord(version, type, title, detail, tone = "neutral", statusText = "已记录", technicalRefs = "") {
    const record = { id: uid("REC"), type, title, detail, tone, status: statusText, time: nowText(), evidenceRef: uid("EVD"), technicalRefs };
    version.records = [record, ...(version.records || [])];
    return record;
  }

  function recordDisplayStatus(record) {
    return record?.type === "切换" && record?.status === "当前正式使用" ? "切换成功" : record?.status || "已记录";
  }

  function adoptedDataVersionIds(version) {
    const adopted = new Set();
    [version?.formalBinding, version?.previousBinding].forEach(binding => {
      if (binding?.dataVersionId) adopted.add(binding.dataVersionId);
    });
    (version?.records || []).forEach(record => {
      if (!String(record.technicalRefs || "").includes("T019")) return;
      const match = String(record.detail || "").match(/FIN-ASSET-\d{8}-v\d+/);
      if (match) adopted.add(match[0]);
    });
    return adopted;
  }

  function openOverlay(kind, value = null) {
    if (kind === "modal") ui.drawer = null;
    else ui.modal = null;
    if (kind === "modal") ui.modal = value;
    else ui.drawer = value;
    render();
  }

  function closeOverlay() { ui.modal = null; ui.drawer = null; render(); }

  function refreshLinkEndpointCompatibility() {
    const draft = activeDraft();
    const source = resolveEndpointSelection(draft, document.getElementById("link-source-endpoint")?.value);
    const target = resolveEndpointSelection(draft, document.getElementById("link-target-endpoint")?.value);
    const message = document.getElementById("link-endpoint-compatibility");
    if (!message) return;
    message.className = "endpoint-compatibility";
    if (!source || !target) { message.textContent = "选择两端端点后检查类型兼容性"; return; }
    if (compatibleTypes(source.type, target.type)) { message.classList.add("compatible"); message.textContent = `类型兼容：${source.type} ↔ ${target.type}`; }
    else { message.classList.add("blocked"); message.textContent = `类型不兼容：${source.type} ↔ ${target.type}`; }
  }

  function refreshLinkEndpointInputs() {
    const draft = activeDraft();
    const sourceId = document.getElementById("link-source")?.value;
    const targetId = document.getElementById("link-target")?.value;
    const source = findObject(draft, sourceId); const target = findObject(draft, targetId);
    ui.linkSourceObjectId = sourceId; ui.linkTargetObjectId = targetId;
    const sourceEndpoint = document.getElementById("link-source-endpoint"); const targetEndpoint = document.getElementById("link-target-endpoint");
    if (sourceEndpoint) sourceEndpoint.innerHTML = endpointOptionsForObject(draft, sourceId);
    if (targetEndpoint) targetEndpoint.innerHTML = endpointOptionsForObject(draft, targetId);
    const direction = document.getElementById("link-direction"); if (direction) direction.value = `${source?.name || "起点"} → ${target?.name || "终点"}`;
    const sourceCount = document.querySelector('[data-endpoint-count="source"]'); const targetCount = document.querySelector('[data-endpoint-count="target"]');
    if (sourceCount) sourceCount.textContent = endpointCandidates(draft, source).length;
    if (targetCount) targetCount.textContent = endpointCandidates(draft, target).length;
    refreshLinkEndpointCompatibility();
  }

  function handleAction(action, element) {
    const value = element.dataset.value;
    const r = route();
    if (action === "go-modeling") return navigate("modeling");
    if (action === "go-published") return navigate("published");
    if (action === "open-module") {
      const paths = { data: "../../data-engineering-prototype-review/review-v3/方案B2.html", query: "../../intelligent-query-prototype/智能问数工作台.html", decision: "../../decision-center-prototype/index.html" };
      if (paths[value]) location.href = paths[value];
      return;
    }
    if (action === "open-create-draft") return openOverlay("modal", "create-draft");
    if (action === "open-help") return openOverlay("modal", "help");
    if (action === "open-reset") return openOverlay("modal", "reset");
    if (action === "close-overlay") return closeOverlay();
    if (action === "backdrop-close") { closeOverlay(); return; }
    if (action === "confirm-reset") {
      localStorage.removeItem(STORAGE_KEY); LEGACY_KEYS.forEach(key => localStorage.removeItem(key)); state = createInitialState(); Object.assign(ui, { modal: null, drawer: null, selectedNodeId: null, canvasView: "semantic", canvasZoom: window.innerWidth <= 1320 ? .5 : .55, selectedMappingFieldId: null, selectedMappingPropertyId: null, resourceObjectId: null, linkSourceObjectId: null, linkTargetObjectId: null }); navigate("modeling"); render(); toast("操作状态已重置"); return;
    }
    if (action === "confirm-create-draft") return confirmCreateDraft();
    if (action === "open-draft") { state.activeDraftId = value; saveState(); ui.selectedNodeId = findDraft(value)?.objects?.[0]?.id || null; return navigate(`modeling/workbench?id=${encodeURIComponent(value)}`); }
    if (action === "open-add-object") return openOverlay("modal", "add-object");
    if (action === "confirm-add-object") return confirmAddObject();
    if (action === "select-node") { ui.selectedNodeId = value; return render(); }
    if (action === "canvas-view") { ui.canvasView = value; return render(); }
    if (action === "zoom-in") { ui.canvasZoom = Math.min(1.2, ui.canvasZoom + .1); return render(); }
    if (action === "zoom-out") { ui.canvasZoom = Math.max(.5, ui.canvasZoom - .1); return render(); }
    if (action === "zoom-reset") { ui.canvasZoom = window.innerWidth <= 1320 ? .5 : .55; return render(); }
    if (action === "open-object") return navigate(`modeling/object?draft=${encodeURIComponent(activeDraft()?.id)}&id=${encodeURIComponent(value)}&tab=overview`);
    if (action === "back-workbench") return navigate(`modeling/workbench?id=${encodeURIComponent(activeDraft()?.id || "")}`);
    if (action === "set-object-tab") {
      const objectId = r.params.get("id") || ui.assetObjectId || activeDraft()?.objects?.[0]?.id;
      return navigate(`modeling/object?draft=${encodeURIComponent(activeDraft()?.id)}&id=${encodeURIComponent(objectId)}&tab=${encodeURIComponent(value)}`);
    }
    if (action === "back-object") return navigate(`modeling/object?draft=${encodeURIComponent(activeDraft()?.id)}&id=${encodeURIComponent(value || r.params.get("object"))}&tab=data`);
    if (action === "open-object-relations") return navigate(`modeling/object?draft=${encodeURIComponent(activeDraft()?.id)}&id=${encodeURIComponent(value || r.params.get("object"))}&tab=relations`);
    if (action === "open-object-mapping") { ui.selectedMappingPropertyId = null; ui.selectedMappingFieldId = null; return navigate(`modeling/mapping?draft=${encodeURIComponent(activeDraft()?.id)}&object=${encodeURIComponent(value || r.params.get("id"))}`); }
    if (action === "open-property-mapping") { ui.selectedMappingPropertyId = value; ui.selectedMappingFieldId = null; return navigate(`modeling/mapping?draft=${encodeURIComponent(activeDraft()?.id)}&object=${encodeURIComponent(element.dataset.object)}&property=${encodeURIComponent(value)}`); }
    if (action === "select-mapping-field") { ui.selectedMappingFieldId = value; return render(); }
    if (action === "select-mapping-property") { ui.selectedMappingPropertyId = value; return render(); }
    if (action === "connect-mapping") return connectMapping();
    if (action === "set-property-role") return setPropertyRole(value);
    if (action === "toggle-field-endpoint") return toggleFieldEndpoint(value);
    if (action === "scroll-preview") { document.getElementById("mapping-preview")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    if (action === "open-asset-picker") {
      ui.assetObjectId = r.path === "modeling/object" ? r.params.get("id") : r.params.get("object") || value;
      const object = findObject(activeDraft(), ui.assetObjectId); ui.assetChoice = object?.memberId || publishedAsset.members[0].id; return openOverlay("modal", "asset-picker");
    }
    if (action === "choose-asset-member") { ui.assetChoice = value; return render(); }
    if (action === "confirm-asset-member") return confirmAssetMember();
    if (action === "open-add-property") { ui.propertyObjectId = r.params.get("id") || r.params.get("object"); ui.propertyFieldChoice = null; return openOverlay("modal", "add-property"); }
    if (action === "choose-property-field") { ui.propertyFieldChoice = value; return render(); }
    if (action === "confirm-add-property") return confirmAddProperty();
    if (action === "open-add-link") { ui.linkObjectId = r.params.get("id") || value || null; ui.linkSourceObjectId = ui.linkObjectId; ui.linkTargetObjectId = null; return openOverlay("modal", "add-link"); }
    if (action === "confirm-add-link") return confirmAddLink();
    if (action === "open-resource-picker") { ui.resourceObjectId = value || r.params.get("id") || null; return openOverlay("modal", "resource-picker"); }
    if (action === "open-add-metric") { ui.resourceObjectId = value || ui.resourceObjectId || null; return openOverlay("modal", "add-metric"); }
    if (action === "open-add-rule") { ui.resourceObjectId = value || ui.resourceObjectId || null; return openOverlay("modal", "add-rule"); }
    if (action === "open-add-action") { ui.resourceObjectId = value || ui.resourceObjectId || null; return openOverlay("modal", "add-action"); }
    if (action === "confirm-add-metric") return confirmAddMetric();
    if (action === "confirm-add-rule") return confirmAddRule();
    if (action === "confirm-add-action") return confirmAddAction();
    if (action === "open-draft-resource") { ui.drawer = { type: "draft-resource", id: value }; return render(); }
    if (action === "save-resource-definition") return saveResourceDefinition(value);
    if (action === "open-lineage-detail") { ui.drawer = { type: "lineage", id: value }; return render(); }
    if (action === "open-consumer-info") { ui.drawer = { type: "consumer", id: value }; return render(); }
    if (action === "open-validation") return navigate(`modeling/validation?draft=${encodeURIComponent(activeDraft()?.id || "")}`);
    if (action === "run-validation") return runValidation();
    if (action === "locate-issue") return locateIssue(element);
    if (action === "open-validation-evidence") { ui.drawer = { type: "validation-evidence" }; return render(); }
    if (action === "open-publish") return openOverlay("modal", "publish");
    if (action === "confirm-publish") return confirmPublish();
    if (action === "open-version") { state.selectedPublishedVersionId = value; saveState(); return navigate(`published/version?id=${encodeURIComponent(value)}&tab=overview`); }
    if (action === "create-revision") return createRevisionDraft(currentVersion());
    if (action === "set-version-tab") return navigate(`published/version?id=${encodeURIComponent(currentVersion()?.id || "")}&tab=${encodeURIComponent(value)}`);
    if (action === "resource-view") { ui.resourceView = value; return render(); }
    if (action === "resource-filter") { ui.resourceFilter = value; return render(); }
    if (action === "open-published-resource") {
      const versionId = publishedRouteVersionId(r) || currentVersion()?.id || "";
      return navigate(`published/resource?version=${encodeURIComponent(versionId)}&id=${encodeURIComponent(value)}&tab=overview`);
    }
    if (action === "back-version-resources") {
      const versionId = r.params.get("version") || currentVersion()?.id || "";
      return navigate(`published/version?id=${encodeURIComponent(versionId)}&tab=resources`);
    }
    if (action === "set-resource-tab") {
      const versionId = r.params.get("version") || "";
      return navigate(`published/resource?version=${encodeURIComponent(versionId)}&id=${encodeURIComponent(r.params.get("id"))}&tab=${encodeURIComponent(value)}`);
    }
    if (action === "open-resource-version") return navigate(`published/resource?version=${encodeURIComponent(element.dataset.version)}&id=${encodeURIComponent(value)}&tab=overview`);
    if (action === "open-version-evidence") { ui.drawer = { type: "validation-evidence", versionId: currentVersion()?.id }; return render(); }
    if (action === "receive-update") return receiveUpdate();
    if (action === "run-match") return runMatch();
    if (action === "run-business-validation") return runBusinessValidation();
    if (action === "open-switch-data") return openOverlay("modal", "switch-data");
    if (action === "confirm-switch-data") return confirmSwitchData();
    if (action === "refetch-update") return refetchUpdate();
    if (action === "open-update-evidence") { ui.drawer = { type: "update-evidence", stage: value }; return render(); }
    if (action === "open-record-evidence") { ui.drawer = { type: "record", id: value }; return render(); }
    if (action === "open-rollback") return openOverlay("modal", "rollback");
    if (action === "confirm-rollback") return confirmRollback();
  }

  function confirmCreateDraft() {
    const name = document.getElementById("draft-name")?.value.trim();
    const ontologyStableId = stableSemanticId("ONT", document.getElementById("draft-code")?.value);
    const definition = document.getElementById("draft-definition")?.value.trim();
    const scene = document.getElementById("draft-scene")?.value || "暂不指定";
    if (!name || !ontologyStableId || !definition) return toast("请填写本体名称、英文业务编码和业务定义", "error");
    if (state.drafts.some(item => item.ontologyStableId === ontologyStableId) || state.publishedVersions.some(item => item.ontologyStableId === ontologyStableId)) return toast("本体英文业务编码已被使用", "error");
    const draft = { id: uid("draft"), ontologyStableId, name, definition, scene, owner: RESOURCE_OWNER, status: "编辑中", createdAt: nowText(), updatedAt: nowText(), objects: [], links: [], metrics: [], rules: [], actionTypes: [], positions: {}, validation: { status: "not-run", issues: [], ranAt: null, evidenceId: null }, changeSummary: "创建本体业务骨架。" };
    state.drafts.push(draft); state.activeDraftId = draft.id; saveState(); ui.modal = null; ui.selectedNodeId = null; navigate(`modeling/workbench?id=${encodeURIComponent(draft.id)}`); render(); toast("本体 Draft 已创建");
  }

  function confirmAddObject() {
    const draft = activeDraft(); const name = document.getElementById("object-name")?.value.trim(); const definition = document.getElementById("object-definition")?.value.trim();
    const id = stableSemanticId("OBJ", document.getElementById("object-code")?.value);
    if (!draft || !name || !id || !definition) return toast("请填写业务名称、英文业务编码和定义", "error");
    if (draft.objects.some(item => item.name === name)) return toast("当前 Draft 已有同名 Object Type", "error");
    if (stableIdExists(draft, id)) return toast("稳定语义身份已被使用", "error");
    draft.objects.push({ id, name, code: "O", definition, identityPropertyId: null, titlePropertyId: null, memberId: null, linkEndpointFields: [], count: null, properties: [] });
    draft.positions[id] = { x: 80 + (draft.objects.length - 1) * 240, y: 100 }; resetDraftValidation(draft);
    ui.modal = null; ui.selectedNodeId = id; saveState(); render(); toast("Object Type 已创建，请继续选择数据资产成员");
  }

  function confirmAssetMember() {
    const draft = activeDraft(); const object = findObject(draft, ui.assetObjectId); const member = memberById(ui.assetChoice);
    if (!object || !member) return toast("请选择数据资产成员", "error");
    object.memberId = member.id; object.count = member.rows; object.linkEndpointFields = (object.linkEndpointFields || []).filter(id => fieldsFor(object).some(field => field.id === id)); resetDraftValidation(draft);
    ui.modal = null; saveState(); render(); toast(`已选择 ${member.name}，尚未自动创建任何 Property`);
  }

  function confirmAddProperty() {
    const draft = activeDraft(); const object = findObject(draft, ui.propertyObjectId); const field = fieldsFor(object).find(item => item.id === ui.propertyFieldChoice);
    const name = document.getElementById("property-name")?.value.trim() || field?.name; const type = document.getElementById("property-type")?.value || field?.type; const unit = document.getElementById("property-unit")?.value.trim() || "—"; const definition = document.getElementById("property-definition")?.value.trim();
    const id = stableSemanticId("PROP", document.getElementById("property-code")?.value);
    if (!object || !field || !name || !id || !definition) return toast("请选择字段并填写英文业务编码和业务定义", "error");
    if (type === "数值" && (!unit || unit === "—")) return toast("数值 Property 必须填写业务单位", "error");
    if (object.properties.some(item => item.sourceFieldId === field.id)) return toast("该字段已经用于一个 Property", "error");
    if (stableIdExists(draft, id)) return toast("稳定语义身份已被使用", "error");
    const property = { id, name, type, unit, required: false, role: "业务属性", linkEndpoint: false, sourceFieldId: field.id, sourceField: field.name, definition };
    object.properties.push(property); resetDraftValidation(draft);
    ui.modal = null; ui.selectedMappingPropertyId = property.id; ui.selectedMappingFieldId = field.id; saveState(); navigate(`modeling/mapping?draft=${encodeURIComponent(draft.id)}&object=${encodeURIComponent(object.id)}&property=${encodeURIComponent(property.id)}`); render(); toast("Property 已创建并建立明确映射");
  }

  function confirmAddLink() {
    const draft = activeDraft(); const name = document.getElementById("link-name")?.value.trim(); const sourceObjectId = document.getElementById("link-source")?.value; const targetObjectId = document.getElementById("link-target")?.value; const sourceToken = document.getElementById("link-source-endpoint")?.value; const targetToken = document.getElementById("link-target-endpoint")?.value; const cardinality = document.getElementById("link-cardinality")?.value; const definition = document.getElementById("link-definition")?.value.trim();
    const id = stableSemanticId("LINK", document.getElementById("link-code")?.value);
    if (!name || !id || !definition || !sourceObjectId || !targetObjectId || sourceObjectId === targetObjectId) return toast("请填写关系名称、英文业务编码和定义，并选择不同的起点和终点", "error");
    const source = findObject(draft, sourceObjectId); const target = findObject(draft, targetObjectId);
    const sourceEndpoint = resolveEndpointSelection(draft, sourceToken); const targetEndpoint = resolveEndpointSelection(draft, targetToken);
    if (!sourceEndpoint || !targetEndpoint || sourceEndpoint.objectId !== sourceObjectId || targetEndpoint.objectId !== targetObjectId) return toast("请为关系两端选择有效端点", "error");
    if (!compatibleTypes(sourceEndpoint.type, targetEndpoint.type)) return toast(`端点类型不兼容：${sourceEndpoint.type} 与 ${targetEndpoint.type}`, "error");
    if (draft.links.some(item => item.name === name)) return toast("当前 Draft 已有同名 Link Type", "error");
    if (stableIdExists(draft, id)) return toast("稳定语义身份已被使用", "error");
    const link = { id, name, code: "L", sourceObjectId, targetObjectId, direction: `${source.name} → ${target.name}`, cardinality, definition };
    if (sourceEndpoint.kind === "property") link.sourceEndpoint = sourceEndpoint.propertyId;
    else { link.sourceEndpointField = sourceEndpoint.fieldId; link.sourceEndpointFieldStableId = sourceEndpoint.stableId || null; }
    if (targetEndpoint.kind === "property") link.targetEndpoint = targetEndpoint.propertyId;
    else { link.targetEndpointField = targetEndpoint.fieldId; link.targetEndpointFieldStableId = targetEndpoint.stableId || null; }
    draft.positions[id] = nextResourcePosition(draft, "link"); draft.links.push(link); resetDraftValidation(draft); ui.modal = null; ui.selectedNodeId = id; saveState(); render(); toast("Link Type 已创建，端点类型已确认兼容");
  }

  function checkedValues(name) {
    return [...document.querySelectorAll(`input[name="${CSS.escape(name)}"]:checked`)].map(input => input.value);
  }

  function confirmAddMetric() {
    const draft = activeDraft();
    const name = document.getElementById("metric-name")?.value.trim();
    const id = stableSemanticId("MET", document.getElementById("metric-code")?.value);
    const objectId = document.getElementById("metric-object")?.value;
    const unit = document.getElementById("metric-unit")?.value.trim();
    const scope = document.getElementById("metric-scope")?.value.trim();
    const time = document.getElementById("metric-time")?.value.trim();
    const definition = document.getElementById("metric-definition")?.value.trim();
    const zeroHandling = document.getElementById("metric-zero")?.value.trim();
    const depends = checkedValues("metric-dep");
    if (!draft || !name || !id || !objectId || !unit || !scope || !time || !definition || !zeroHandling || !depends.length) return toast("请完整填写 Metric 英文业务编码、口径并选择依赖资源", "error");
    if (draft.metrics.some(item => item.name === name)) return toast("当前 Draft 已有同名 Metric", "error");
    if (stableIdExists(draft, id)) return toast("稳定语义身份已被使用", "error");
    draft.metrics.push({ id, name, code: "M", unit, scope, time, zeroHandling, objectId, depends, definition });
    draft.positions[id] = nextResourcePosition(draft, "metric"); resetDraftValidation(draft); ui.modal = null; ui.selectedNodeId = id; saveState(); render(); toast("Metric 已创建");
  }

  function confirmAddRule() {
    const draft = activeDraft();
    const name = document.getElementById("rule-name")?.value.trim();
    const displayCode = document.getElementById("rule-code")?.value.trim();
    const id = stableSemanticId("RULE", document.getElementById("rule-business-code")?.value);
    const objectId = document.getElementById("rule-object")?.value;
    const condition = document.getElementById("rule-condition")?.value.trim();
    const evidence = document.getElementById("rule-evidence")?.value.trim();
    const definition = document.getElementById("rule-definition")?.value.trim();
    const depends = checkedValues("rule-dep");
    if (!draft || !name || !displayCode || !id || !objectId || !condition || !evidence || !definition || !depends.length) return toast("请完整填写 Rule 英文业务编码并选择依赖 Metric", "error");
    if (draft.rules.some(item => item.name === name || item.displayCode === displayCode)) return toast("规则名称或编号已存在", "error");
    if (stableIdExists(draft, id)) return toast("稳定语义身份已被使用", "error");
    draft.rules.push({ id, name, displayCode, code: "R", objectId, depends, condition, evidence, definition });
    draft.positions[id] = nextResourcePosition(draft, "rule"); resetDraftValidation(draft); ui.modal = null; ui.selectedNodeId = id; saveState(); render(); toast("Rule 已创建");
  }

  function confirmAddAction() {
    const draft = activeDraft();
    const name = document.getElementById("action-name")?.value.trim();
    const id = stableSemanticId("ACTION", document.getElementById("action-code")?.value);
    const objectId = document.getElementById("action-object")?.value;
    const parameters = document.getElementById("action-parameters")?.value.trim();
    const prerequisite = document.getElementById("action-prerequisite")?.value.trim();
    const result = document.getElementById("action-result")?.value.trim();
    const confirmation = document.getElementById("action-confirmation")?.value;
    const definition = document.getElementById("action-definition")?.value.trim();
    const depends = checkedValues("action-dep");
    if (!draft || !name || !id || !objectId || !parameters || !prerequisite || !result || !definition || !depends.length) return toast("请完整填写 Action Type 英文业务编码并选择依赖资源", "error");
    if (draft.actionTypes.some(item => item.name === name)) return toast("当前 Draft 已有同名 Action Type", "error");
    if (stableIdExists(draft, id)) return toast("稳定语义身份已被使用", "error");
    draft.actionTypes.push({ id, name, code: "A", objectId, depends, parameters, prerequisite, result, confirmation, definition });
    draft.positions[id] = nextResourcePosition(draft, "action"); resetDraftValidation(draft); ui.modal = null; ui.selectedNodeId = id; saveState(); render(); toast("Action Type 已创建");
  }

  function connectMapping() {
    const draft = activeDraft(); const r = route(); const object = findObject(draft, r.params.get("object")); const field = fieldsFor(object).find(item => item.id === ui.selectedMappingFieldId); const property = object?.properties.find(item => item.id === ui.selectedMappingPropertyId);
    if (!field || !property) return toast("请先选择来源字段和 Property", "error");
    if (!compatibleTypes(field.type, property.type)) return toast(`类型不兼容：${field.type} 不能直接映射到 ${property.type}`, "error");
    const duplicate = object.properties.find(item => item.id !== property.id && item.sourceFieldId === field.id);
    if (duplicate) return toast(`${field.name}已映射到${duplicate.name}，请先选择其他字段`, "error");
    property.sourceFieldId = field.id; property.sourceField = field.name; draft.updatedAt = nowText(); draft.validation = { status: "not-run", issues: [], ranAt: null, evidenceId: null }; saveState(); render(); toast("映射已保存；请重新运行统一校验");
  }

  function setPropertyRole(role) {
    const draft = activeDraft(); const object = findObject(draft, route().params.get("object")); const property = object?.properties.find(item => item.id === ui.selectedMappingPropertyId);
    if (!property) return toast("请先选择 Property", "error");
    if (role === "identity") { object.identityPropertyId = property.id; property.role = property.role?.includes("标题") ? "身份、标题" : "身份"; }
    else if (role === "title") { object.titlePropertyId = property.id; property.role = property.role?.includes("身份") ? "身份、标题" : "标题"; }
    else { property.linkEndpoint = !property.linkEndpoint; }
    resetDraftValidation(draft); saveState(); render(); toast(role === "identity" ? "已设为稳定身份" : role === "title" ? "已设为可读标题" : property.linkEndpoint ? "已标记为 Link 端点" : "已取消 Link 端点");
  }

  function toggleFieldEndpoint(fieldId) {
    const draft = activeDraft(); const object = findObject(draft, route().params.get("object"));
    const field = fieldsFor(object).find(item => item.id === fieldId);
    if (!draft || !object || !field) return toast("请先选择数据资产字段", "error");
    object.linkEndpointFields = object.linkEndpointFields || [];
    const index = object.linkEndpointFields.indexOf(field.id);
    if (index >= 0) object.linkEndpointFields.splice(index, 1); else object.linkEndpointFields.push(field.id);
    resetDraftValidation(draft); saveState(); render(); toast(index >= 0 ? "已取消字段的 Link 端点用途" : "字段已可用于 Link 端点");
  }

  function saveResourceDefinition(id) {
    const resource = findResource(activeDraft(), id); const value = document.getElementById("resource-definition-input")?.value.trim();
    if (!resource || !value) return toast("业务定义不能为空", "error");
    resource.definition = value; activeDraft().updatedAt = nowText(); activeDraft().validation.status = "not-run"; ui.drawer = null; saveState(); render(); toast("资源定义已保存");
  }

  function runValidation() {
    const draft = activeDraft(); if (!draft || ui.busy) return;
    ui.busy = "validation"; render();
    setTimeout(() => {
      const issues = validationIssues(draft);
      draft.validation = { status: issues.length ? "failed" : "passed", issues: deepClone(issues), ranAt: nowText(), evidenceId: uid("VAL") };
      draft.updatedAt = nowText(); ui.busy = null; saveState(); render(); toast(issues.length ? `校验完成：发现 ${issues.length} 项阻断` : "校验通过，可以发布", issues.length ? "error" : "");
    }, 1000);
  }

  function locateIssue(element) {
    const objectId = element.dataset.object; const propertyId = element.dataset.property; const locationName = element.dataset.location;
    if (locationName === "object-create") { ui.modal = "add-object"; return navigate(`modeling/workbench?id=${encodeURIComponent(activeDraft()?.id || "")}`); }
    if (locationName === "mapping") { ui.selectedMappingPropertyId = propertyId; ui.selectedMappingFieldId = null; return navigate(`modeling/mapping?draft=${encodeURIComponent(activeDraft()?.id)}&object=${encodeURIComponent(objectId)}&property=${encodeURIComponent(propertyId)}`); }
    if (objectId && findObject(activeDraft(), objectId)) {
      const tab = locationName === "properties" ? "properties" : locationName === "relations" ? "relations" : locationName === "overview" ? "overview" : "data";
      return navigate(`modeling/object?draft=${encodeURIComponent(activeDraft()?.id)}&id=${encodeURIComponent(objectId)}&tab=${tab}`);
    }
    if (objectId && findResource(activeDraft(), objectId)) {
      ui.selectedNodeId = objectId;
      ui.drawer = { type: "draft-resource", id: objectId };
      return navigate(`modeling/workbench?id=${encodeURIComponent(activeDraft()?.id || "")}`);
    }
    if (locationName === "logic") {
      ui.modal = "resource-picker";
      return navigate(`modeling/workbench?id=${encodeURIComponent(activeDraft()?.id || "")}`);
    }
    navigate(`modeling/workbench?id=${encodeURIComponent(activeDraft()?.id || "")}`);
  }

  function createRevisionDraft(version) {
    if (!version) return toast("请先选择已发布语义版本", "error");
    const existing = state.drafts.find(draft => draft.status !== "已发布" && draft.baseVersionId === version.id);
    if (existing) {
      state.activeDraftId = existing.id;
      ui.selectedNodeId = existing.objects[0]?.id || null;
      saveState();
      navigate(`modeling/workbench?id=${encodeURIComponent(existing.id)}`);
      render();
      return toast("已打开该版本的修订 Draft");
    }
    const draft = deepClone(version.snapshot);
    draft.id = uid("draft");
    draft.baseVersionId = version.id;
    draft.baseVersionLabel = version.label;
    draft.status = "编辑中";
    draft.createdAt = nowText();
    draft.updatedAt = draft.createdAt;
    draft.validation = { status: "not-run", issues: [], ranAt: null, evidenceId: null };
    draft.changeSummary = `基于 ${version.label} 创建修订。`;
    state.drafts.push(draft);
    state.activeDraftId = draft.id;
    ui.selectedNodeId = draft.objects[0]?.id || null;
    saveState();
    navigate(`modeling/workbench?id=${encodeURIComponent(draft.id)}`);
    render();
    toast("修订 Draft 已创建，原版本保持不变");
  }

  function confirmPublish() {
    const draft = activeDraft(); if (!draft || draft.validation.status !== "passed" || ui.busy) return toast("请先通过统一校验", "error");
    ui.busy = "publishing"; render();
    setTimeout(() => {
      const ordinal = state.publishedVersions.filter(item => item.ontologyStableId === draft.ontologyStableId).length + 1;
      const versionCode = String(draft.ontologyStableId || "ONT-ONTOLOGY").replace(/^ONT-/, "");
      const version = {
        id: `SEM-${versionCode}-V${ordinal}-${compactStamp()}`,
        label: `V${ordinal}.0`,
        ontologyStableId: draft.ontologyStableId,
        ontologyName: draft.name,
        definition: draft.definition,
        scene: draft.scene,
        owner: RESOURCE_OWNER,
        sourceDraftId: draft.id,
        baseVersionId: draft.baseVersionId || null,
        publishedAt: nowText(),
        changeSummary: draft.changeSummary || "发布当前 Draft 的结构、映射和业务逻辑。",
        validation: deepClone(draft.validation),
        snapshot: freezePublishedSnapshot(draft, publishedAsset),
        dataContract: deepClone(publishedAsset),
        formalBinding: null,
        previousBinding: null,
        update: null,
        updateSequence: 0,
        records: []
      };
      appendRecord(version, "发布", "语义版本发布成功", `${draft.name} 已形成不可变 Published 语义快照；数据仍等待正式绑定。`, "green", "语义已发布", "Published");
      state.publishedVersions.push(version); state.selectedPublishedVersionId = version.id; draft.status = "已发布"; ui.busy = null; ui.modal = null; saveState(); navigate(`published/version?id=${encodeURIComponent(version.id)}&tab=overview`); render(); toast("语义版本已发布，当前等待数据绑定");
    }, 1100);
  }

  function receiveUpdate() {
    const version = currentVersion(); if (!version || ui.busy) return;
    const candidates = [
      { dataVersionId: publishedAsset.versionLabel, dataAsOf: publishedAsset.asOf, shouldMatchFail: false, shouldValidationFail: false },
      { dataVersionId: "FIN-ASSET-20251231-v01", dataAsOf: "2025-12-31", shouldMatchFail: true, shouldValidationFail: false },
      { dataVersionId: "FIN-ASSET-20260131-v01", dataAsOf: "2026-01-31", shouldMatchFail: false, shouldValidationFail: false }
    ];
    const adoptedVersions = adoptedDataVersionIds(version);
    let candidateIndex = Math.max(0, version.updateSequence || 0);
    while (candidateIndex < candidates.length && adoptedVersions.has(candidates[candidateIndex].dataVersionId)) candidateIndex += 1;
    const candidate = candidates[candidateIndex];
    if (!candidate) return toast("暂无新的待更新数据；已正式使用过的数据版本不会重复进入更新流程");
    version.updateSequence = candidateIndex + 1;
    version.update = { id: uid("UPD"), dataLabel: publishedAsset.name, ...candidate, receivedAt: nowText(), status: "received", correctionAttempt: 0, eligible: false, matchEvidenceId: null, validationEvidenceId: null, failureReason: null, failureDetail: null, retryOf: null };
    appendRecord(version, "更新", "收到待更新数据", `${version.update.dataVersionId} 已进入独立检查，不影响当前正式数据。`, "blue", "已收到", "C028");
    saveState(); render(); toast("已收到待更新数据");
  }

  function runMatch() {
    const version = currentVersion(); const update = version?.update; if (!update || update.status !== "received" || ui.busy) return;
    update.status = "match-running"; ui.busy = "match"; saveState(); render();
    setTimeout(() => {
      update.matchEvidenceId = uid("MATCH");
      if (update.shouldMatchFail) {
        update.status = "match-failed"; update.eligible = false; update.failureReason = "融资机构身份字段类型发生变化"; update.failureDetail = "金融机构参考成员中的机构编码由文本变为整数，无法证明与 Published Property 兼容；当前正式数据继续服务。";
        appendRecord(version, "失败", "数据与本体匹配检查失败", `${update.dataVersionId}：${update.failureDetail}`, "red", "匹配失败", "C029 · T018未形成");
      } else {
        update.status = "eligible"; update.eligible = true; update.failureReason = null; update.failureDetail = null;
        appendRecord(version, "检查", "数据与本体匹配检查通过", `${update.dataVersionId} 的成员范围、稳定标识、字段类型和三条关系端点匹配，可进入业务消费验证。`, "green", "具备验证条件", "C029 · T018");
      }
      ui.busy = null; saveState(); render(); toast(update.status === "eligible" ? "匹配检查通过，可以运行业务消费验证" : "匹配检查失败，当前正式数据继续服务", update.status === "eligible" ? "" : "error");
    }, 1100);
  }

  function runBusinessValidation() {
    const version = currentVersion(); const update = version?.update; if (!update || update.status !== "eligible" || ui.busy) return;
    update.status = "validation-running"; ui.busy = "validation-candidate"; saveState(); render();
    setTimeout(() => {
      update.validationEvidenceId = uid("BIZVAL");
      if (update.shouldValidationFail) {
        update.status = "validation-failed";
        update.failureReason = "优先协商机构无法回溯到同一批次借据";
        update.failureDetail = "单位553的机构排序引用了待更新数据之外的两笔借据，银行归因证据不完整。";
        appendRecord(version, "失败", "业务消费验证失败", `${update.dataVersionId}：${update.failureDetail}`, "red", "验证失败", "候选验证");
      } else {
        update.status = "validated";
        update.failureReason = null;
        update.failureDetail = null;
        appendRecord(version, "验证", "业务消费验证通过", `${update.dataVersionId} 的集团融资成本、任意两家与三家综合成本、R01—R03、银行归因和 Action Type 发现验证全部通过。`, "green", "全部通过", "候选验证");
      }
      ui.busy = null; saveState(); render(); toast(update.status === "validated" ? "业务消费验证通过，等待确认切换" : "业务消费验证失败，当前正式数据继续服务", update.status === "validated" ? "" : "error");
    }, 1250);
  }

  function confirmSwitchData() {
    const version = currentVersion(); const update = version?.update; if (!update || update.status !== "validated" || ui.busy) return;
    ui.modal = null; update.status = "switching"; ui.busy = "switch"; saveState(); render();
    setTimeout(() => {
      if (version.formalBinding) version.previousBinding = deepClone(version.formalBinding);
      version.formalBinding = { id: uid("FORMAL"), semanticVersionId: version.id, dataVersionId: update.dataVersionId, dataLabel: update.dataLabel, dataAsOf: update.dataAsOf, switchedAt: nowText(), evidenceRef: uid("T019") };
      state.currentFormalVersionId = version.id;
      update.status = "switched"; update.switchedAt = version.formalBinding.switchedAt;
      appendRecord(version, "切换", "正式数据切换成功", `${update.dataVersionId} 已成为 ${version.label} 的当前正式数据。`, "green", "切换成功", "T019");
      ui.busy = null; saveState(); render(); toast("正式数据已切换，下游可读取当前版本");
    }, 1100);
  }

  function refetchUpdate() {
    const version = currentVersion(); const previousUpdate = version?.update; if (!version || !previousUpdate) return;
    const correctionAttempt = (previousUpdate.correctionAttempt || 0) + 1;
    const dateCode = String(previousUpdate.dataAsOf).slice(0, 10).replaceAll("-", "");
    const dataVersionId = `FIN-ASSET-${dateCode}-v${String(correctionAttempt + 1).padStart(2, "0")}`;
    const shouldValidationFail = previousUpdate.status === "match-failed" && correctionAttempt === 1;
    version.update = { ...deepClone(previousUpdate), id: uid("UPD"), dataVersionId, receivedAt: nowText(), status: "received", shouldMatchFail: false, shouldValidationFail, correctionAttempt, eligible: false, matchEvidenceId: null, validationEvidenceId: null, failureReason: null, failureDetail: null, retryOf: previousUpdate.id };
    appendRecord(version, "重试", "重新获取修正数据", `${dataVersionId} 已由数据中心提供；旧失败记录保留，本次从匹配检查重新开始。`, "blue", "等待检查", "关联重试");
    saveState(); render(); toast("已获取新的修正数据，请重新运行匹配检查");
  }

  function confirmRollback() {
    const version = currentVersion();
    if (!isCurrentFormalVersion(version)) return toast("只能在当前正式语义版本内回退数据", "error");
    if (!version.previousBinding || ui.busy) return;
    const oldCurrent = deepClone(version.formalBinding); const target = deepClone(version.previousBinding); ui.modal = null; ui.busy = "rollback"; render();
    setTimeout(() => {
      version.formalBinding = { ...target, id: uid("FORMAL"), switchedAt: nowText(), evidenceRef: uid("T019") }; version.previousBinding = oldCurrent;
      state.currentFormalVersionId = version.id;
      appendRecord(version, "回退", "已回退到上一可信数据", `${target.dataVersionId} 已重新成为当前正式数据；被替换版本仍保留在历史记录中。`, "amber", "回退成功", "T019 · 回退");
      ui.busy = null; saveState(); render(); toast("已回退到上一可信数据");
    }, 1100);
  }

  document.addEventListener("click", event => {
    const element = event.target.closest("[data-action]");
    if (!element || element.disabled) return;
    if (element.dataset.action === "backdrop-close" && event.target !== element) return;
    handleAction(element.dataset.action, element);
  });

  document.addEventListener("input", event => {
    if (event.target.matches(".tree-search input")) {
      const query = event.target.value.trim().toLowerCase();
      document.querySelectorAll(".tree-item").forEach(item => { item.hidden = query && !item.textContent.toLowerCase().includes(query); });
    }
    if (event.target.matches(".filter-bar input")) {
      const query = event.target.value.trim().toLowerCase();
      document.querySelectorAll(".published-card").forEach(item => { item.hidden = query && !item.textContent.toLowerCase().includes(query); });
    }
  });

  document.addEventListener("change", event => {
    if (event.target.matches("#link-source,#link-target")) refreshLinkEndpointInputs();
    if (event.target.matches("#link-source-endpoint,#link-target-endpoint")) refreshLinkEndpointCompatibility();
  });

  window.addEventListener("hashchange", render);
  window.addEventListener("resize", () => {
    if (route().path === "modeling/workbench") requestAnimationFrame(() => drawSemanticEdges(activeDraft()));
    if (route().path === "modeling/mapping") requestAnimationFrame(drawMappingLines);
  });
  window.addEventListener("keydown", event => { if (event.key === "Escape" && (ui.modal || ui.drawer)) closeOverlay(); });

  LEGACY_KEYS.forEach(key => { if (localStorage.getItem(key) && !localStorage.getItem(STORAGE_KEY)) localStorage.removeItem(key); });
  if (!location.hash) history.replaceState(null, "", "#modeling");
  render();
})();
