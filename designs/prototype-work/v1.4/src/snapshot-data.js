const field = (key, label, type = "string", unit = "", reference = "") => ({
  key,
  label,
  type,
  unit,
  reference,
});
export function snapshotData(data) {
  const entityName = (id) =>
      data.enterprises.find((row) => row.id === id)?.name || id,
    bankName = (id) => data.banks.find((row) => row.id === id)?.name || id;
  const dataset = (key, name, fields, rows, description) => ({
    id: `asset-v14-${key}`,
    key,
    name,
    sheetName: name,
    fields,
    rows,
    rowCount: rows.length,
    description,
  });
  const assets = [
    dataset(
      "enterprises",
      "企业主数据",
      [
        field("id", "企业ID"),
        field("name", "企业名称"),
        field("aliases", "来源别名"),
        field("industry", "产业"),
        field("province", "省份"),
        field("city", "城市"),
        field("cash", "可用现金", "number", "百万元"),
        field("benchmarkRate", "产业基准利率", "percent", "%"),
        field("owner", "负责人"),
        field("financeBasis", "融资构造依据"),
      ],
      data.enterprises.map((row) => ({
        ...row,
        aliases: row.aliasNames.join(" / "),
        financeBasis: row.sourceFinance
          ? "原型样本总量校准；借款明细模拟构造"
          : "完整模拟构造",
      })),
      "统一企业身份、现金与产业基准；样本身份沿用原型，非工商核验数据。",
    ),
    dataset(
      "banks",
      "金融机构",
      [
        field("id", "银行ID"),
        field("name", "银行名称"),
        field("city", "城市"),
        field("sourceId", "原型来源ID"),
      ],
      data.banks,
      "模拟融资关联银行目录。",
    ),
    dataset(
      "loans",
      "融资合同台账",
      [
        field("id", "借款ID"),
        field("enterpriseId", "企业ID", "string", "", "enterprises.id"),
        field("enterpriseName", "企业名称"),
        field("bankId", "银行ID", "string", "", "banks.id"),
        field("bankName", "银行名称"),
        field("projectId", "项目ID", "string", "", "projects.id"),
        field("principal", "存续本金", "number", "百万元"),
        field("rate", "执行年利率", "percent", "%"),
        field("rateType", "利率类型"),
        field("startDate", "起息日", "date"),
        field("maturityDate", "到期日", "date"),
        field("currency", "币种"),
      ],
      data.loans.map((row) => ({
        ...row,
        enterpriseName: entityName(row.enterpriseId),
        bankName: bankName(row.bankId),
      })),
      "84笔完整模拟借款；不是原始借据，不包含任何已执行融资交易。",
    ),
    dataset(
      "facilities",
      "授信台账",
      [
        field("id", "授信ID"),
        field("enterpriseId", "企业ID", "string", "", "enterprises.id"),
        field("enterpriseName", "企业名称"),
        field("bankId", "银行ID", "string", "", "banks.id"),
        field("bankName", "银行名称"),
        field("undrawn", "未用额度", "number", "百万元"),
        field("validUntil", "有效期至", "date"),
        field("currency", "币种"),
      ],
      data.facilities.map((row) => ({
        ...row,
        enterpriseName: entityName(row.enterpriseId),
        bankName: bankName(row.bankId),
      })),
      "完整模拟未用授信，额度不代表已到账现金。",
    ),
    dataset(
      "guarantees",
      "担保台账",
      [
        field("id", "担保ID"),
        field("guarantorId", "担保方ID", "string", "", "enterprises.id"),
        field("guarantorName", "担保方"),
        field("beneficiaryId", "被担保方ID", "string", "", "enterprises.id"),
        field("beneficiaryName", "被担保方"),
        field("amount", "担保金额", "number", "百万元"),
        field("validUntil", "有效期至", "date"),
      ],
      data.guarantees.map((row) => ({
        ...row,
        guarantorName: entityName(row.guarantorId),
        beneficiaryName: entityName(row.beneficiaryId),
      })),
      "显式模拟担保关系；担保金额不重复计入借款余额。",
    ),
    dataset(
      "risk",
      "债务风险评估结果",
      [
        field("id", "结果ID"),
        field("enterpriseId", "企业ID", "string", "", "enterprises.id"),
        field("enterpriseName", "企业名称"),
        field("asOf", "观察日", "date"),
        field("score", "风险评分", "number", "分"),
        field("tier", "风险分档"),
        field("modelVersion", "原型模型版本"),
        field("basis", "构造依据"),
      ],
      data.enterprises.map((row) => ({
        id: `RISK-${row.id}`,
        enterpriseId: row.id,
        enterpriseName: row.name,
        asOf: data.asOf,
        score: row.riskScore,
        tier: row.riskTier,
        modelVersion: "1.0.2",
        basis: "模拟快照；数值沿用原型样本，不代表真实企业评级",
      })),
      "完整覆盖21家企业；样本评分保持原型值，利率与授信方案不改写该评分。",
    ),
    dataset(
      "projects",
      "项目台账",
      [
        field("id", "项目ID"),
        field("name", "项目名称"),
        field("enterpriseId", "企业ID", "string", "", "enterprises.id"),
        field("enterpriseName", "企业名称"),
        field("stage", "项目阶段"),
      ],
      data.projects.map((row) => ({
        ...row,
        enterpriseName: entityName(row.enterpriseId),
      })),
      "完整模拟项目与企业归属，供融资项目下探使用。",
    ),
    dataset(
      "events",
      "风险与融资事件",
      [
        field("id", "事件ID"),
        field("enterpriseId", "企业ID", "string", "", "enterprises.id"),
        field("enterpriseName", "企业名称"),
        field("name", "事件名称"),
        field("date", "发生日期", "date"),
        field("status", "快照状态"),
      ],
      data.events.map((row) => ({
        ...row,
        enterpriseName: entityName(row.enterpriseId),
      })),
      "完整模拟风险关注与到期复核事件；快照状态不随本地事项处理改写。",
    ),
    dataset(
      "locations",
      "主体地理位置",
      [
        field("id", "位置ID"),
        field("objectId", "主体ID"),
        field("objectType", "主体类型"),
        field("name", "主体名称"),
        field("longitude", "经度", "number", "度"),
        field("latitude", "纬度", "number", "度"),
        field("crs", "坐标系"),
        field("accuracy", "精度标识"),
      ],
      [...data.enterprises, ...data.banks, ...data.projects].map((row) => ({
        id: `GEO-${row.id}`,
        objectId: row.id,
        objectType: row.kind,
        name: row.name,
        longitude: row.coordinates[0],
        latitude: row.coordinates[1],
        crs: "WGS84 / EPSG:4326",
        accuracy: "城市级模拟布点，非真实地址",
      })),
      "完整模拟企业、银行和项目坐标；地理邻近不构成风险传染证据。",
    ),
  ];
  for (const asset of assets) {
    asset.rows = asset.rows.map((row) =>
      Object.fromEntries(asset.fields.map((f) => [f.key, row[f.key]])),
    );
    asset.snapshotId = `SNAP-${asset.key.toUpperCase()}-20251231-V14-1`;
    asset.version = "1.0.0";
    asset.asOf = data.asOf;
    asset.dataVersion = data.dataVersion;
    asset.dataDigest = data.digest;
    asset.classification = "SIMULATED_SNAPSHOT";
  }
  return {
    schemaVersion: "ofw.asset-snapshots.v1",
    snapshotId: "SNAP-FINANCE-RISK-20251231-V14-1",
    dataVersion: data.dataVersion,
    dataDigest: data.digest,
    ontologyVersion: data.ontologyVersion,
    asOf: data.asOf,
    classification: "SIMULATED_SNAPSHOT",
    source: { id: "source-v14-finance-risk", name: "融资与债务风险模拟工作簿" },
    assets,
  };
}
export function validateSnapshot(catalog) {
  const problems = [],
    byKey = new Map(catalog.assets.map((asset) => [asset.key, asset]));
  for (const asset of catalog.assets) {
    const ids = new Set();
    for (const row of asset.rows) {
      if (!row.id || ids.has(row.id))
        problems.push(`${asset.key}: invalid identity ${row.id}`);
      ids.add(row.id);
      for (const field of asset.fields) {
        const value = row[field.key];
        if (value === undefined || value === null || value === "")
          problems.push(`${asset.key}.${field.key}: missing`);
        if (
          ["number", "percent"].includes(field.type) &&
          !Number.isFinite(value)
        )
          problems.push(`${asset.key}.${field.key}: invalid number`);
        if (
          field.type === "date" &&
          (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
            !Number.isFinite(Date.parse(value)))
        )
          problems.push(`${asset.key}.${field.key}: invalid date`);
        if (field.reference) {
          const [key, target] = field.reference.split(".");
          if (!byKey.get(key)?.rows.some((other) => other[target] === value))
            problems.push(
              `${asset.key}.${field.key}: dangling reference ${value}`,
            );
        }
      }
    }
  }
  return {
    status: problems.length ? "FAILED" : "PASSED",
    rowCount: catalog.assets.reduce((sum, asset) => sum + asset.rows.length, 0),
    assetCount: catalog.assets.length,
    problems,
  };
}
