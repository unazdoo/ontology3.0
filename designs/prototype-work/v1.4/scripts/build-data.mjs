import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import { feature } from "topojson-client";

const readParent = (file) =>
  JSON.parse(
    readFileSync(
      new URL(`../composite/${file}`, import.meta.url),
      "utf8",
    ),
  );
const master = readParent("resources/enterprise-master.json");
const portfolio = readParent("modules/m07/resources/portfolio.json");
const asOf = "2025-12-31";
const dataVersion = "DATA-V14-20251231-DEMO-1";
const sourceRefs = [dataVersion];
const day = (offset) =>
  new Date(Date.parse(`${asOf}T00:00:00Z`) + offset * 86400000)
    .toISOString()
    .slice(0, 10);
const round = (number, digits = 6) =>
  new Decimal(number).toDecimalPlaces(digits).toNumber();
const banks = portfolio.objects
  .filter(
    (item) => item.objectTypeId === "m01.object-type.financial-institution",
  )
  .map((bank, index) => ({
    id: `BANK-${String(index + 1).padStart(2, "0")}`,
    name: bank.title,
    sourceId: bank.canonicalObjectRef.id,
    coordinates: bank.location.geometry.coordinates,
    city: bank.location.city,
    kind: "bank",
    evidenceRefs: sourceRefs,
  }));
const loans = [],
  facilities = [],
  guarantees = [],
  projects = [],
  events = [];
const enterprises = master.enterprises.map((entity, index) => {
  const original = portfolio.objects.find((item) => item.id === entity.id);
  const p = original.properties;
  const hasSourceFinance = Boolean(original.sourceFacets.S001);
  const total = hasSourceFinance
    ? new Decimal(p.balance.value).times(100).toNumber()
    : 420 + index * 71 + (index % 4) * 130;
  const cost = hasSourceFinance
    ? p.averageFinancingCost.value
    : round(2.04 + (index % 7) * 0.17 + (index >= 16 ? 0.32 : 0));
  const industry =
    index >= 16 && index < 20 ? "环保" : index === 20 ? "核电" : "风电";
  const projectId = `PRJ-${entity.id.slice(-3)}`;
  projects.push({
    id: projectId,
    name: `${entity.location.city}${industry}项目`,
    enterpriseId: entity.id,
    kind: "project",
    stage: index >= 9 && index <= 11 ? "建设中" : "运营中",
    coordinates: entity.location.geometry.coordinates,
    evidenceRefs: sourceRefs,
  });
  const bankIds = [index % 9, (index + 2) % 9, (index + 5) % 9];
  const weights = [0.4, 0.3, 0.2, 0.1],
    offsets = [0.3, -0.2, 0.1, -0.8];
  const maturities = [
    25 + index,
    60 + index * 2,
    140 + index * 8,
    420 + index * 6,
  ];
  weights.forEach((weight, part) => {
    loans.push({
      id: `LOAN-${entity.id.slice(-3)}-${part + 1}`,
      kind: "loan",
      name: `${entity.name} · ${part + 1}号融资`,
      enterpriseId: entity.id,
      bankId: banks[bankIds[part % 3]].id,
      projectId,
      principal: round(new Decimal(total).times(weight)),
      rate: round(new Decimal(cost).plus(offsets[part])),
      rateType: part === 3 ? "FIXED" : "FLOATING",
      startDate: "2025-01-01",
      maturityDate: day(maturities[part]),
      currency: "CNY",
      unit: "百万元",
      classification: "SYNTHETIC_FINANCING_DETAIL",
      evidenceRefs: sourceRefs,
    });
  });
  bankIds.forEach((bankIndex, part) =>
    facilities.push({
      id: `FAC-${entity.id.slice(-3)}-${part + 1}`,
      kind: "facility",
      name: `${banks[bankIndex].name}授信`,
      enterpriseId: entity.id,
      bankId: banks[bankIndex].id,
      undrawn: round(new Decimal(total).times([0.1, 0.06, 0.04][part])),
      validUntil: "2027-12-31",
      currency: "CNY",
      evidenceRefs: sourceRefs,
    }),
  );
  const cash = round(new Decimal(total).times(0.08 + (index % 5) * 0.055));
  events.push({
    id: `EVT-${entity.id.slice(-3)}`,
    kind: "event",
    enterpriseId: entity.id,
    name: p.riskTier.value === "绿灯" ? "到期融资复核" : "债务风险关注",
    date: "2025-12-31",
    status: "待复核",
    evidenceRefs: [original.sourceFacets.S003.sourceRefs[0], dataVersion],
  });
  return {
    id: entity.id,
    kind: "enterprise",
    name: entity.name,
    aliases: entity.aliases,
    aliasNames: entity.aliasNames,
    industry,
    city: entity.location.city,
    province: entity.location.province,
    coordinates: entity.location.geometry.coordinates,
    locationClassification: "DEMO_CITY_PLACEMENT",
    riskScore: p.riskScore.value,
    riskTier: p.riskTier.value,
    cash,
    owner: `${industry}业务负责人${String((index % 4) + 1).padStart(2, "0")}`,
    sourceFinance: hasSourceFinance
      ? {
          balanceMillions: total,
          cost,
          sourceRef: original.sourceFacets.S001.canonicalObjectRef,
        }
      : null,
    riskSource: original.sourceFacets.S003.canonicalObjectRef,
    evidenceRefs: [
      ...new Set([dataVersion, ...original.sourceFacets.S003.sourceRefs]),
    ],
    benchmarkRate: { 风电: 2.45, 环保: 2.65, 核电: 2.1 }[industry],
  };
});
for (let index = 0; index < 9; index++) {
  const beneficiary = enterprises[(index * 2 + 2) % 21];
  const guarantor = enterprises[(index * 2 + 16) % 21];
  if (beneficiary.id !== guarantor.id)
    guarantees.push({
      id: `GUA-${String(index + 1).padStart(2, "0")}`,
      kind: "guarantee",
      name: `${guarantor.name} → ${beneficiary.name}`,
      guarantorId: guarantor.id,
      beneficiaryId: beneficiary.id,
      amount: round(
        new Decimal(
          loans.find((loan) => loan.enterpriseId === beneficiary.id).principal,
        ).times(0.4),
      ),
      validUntil: "2027-12-31",
      classification: "SYNTHETIC_RELATION",
      evidenceRefs: sourceRefs,
    });
}
const definitions = [
  {
    id: "balance",
    name: "存续融资余额",
    unit: "百万元",
    expression: "Σ 当期存续借款本金 (Loan ID 唯一去重)",
    inputs: ["loan.principal", "loan.startDate", "loan.maturityDate"],
    consumers: ["地图", "问数", "方案", "报告"],
    scope:
      "起息日不晚于观察日、到期日晚于观察日的人民币借款；未用授信和担保不重复计入",
  },
  {
    id: "weightedCost",
    name: "余额加权融资成本",
    unit: "%",
    expression: "Σ(存续本金 × 执行年利率) / Σ存续本金",
    inputs: ["loan.principal", "loan.rate"],
    consumers: ["地图", "问数", "方案", "报告"],
    scope: "当期存续、同币种借款；按本金加权，不取企业利率简单平均",
  },
  {
    id: "maturity",
    name: "窗口内到期本金",
    unit: "百万元",
    expression: "Σ 到期日 > 观察日 且 ≤ 观察日 + 展望天数 的存续本金",
    inputs: ["loan.principal", "loan.maturityDate"],
    consumers: ["地图", "问数", "方案", "报告"],
    scope: "不含已逾期借款；窗口末日包含；本金不重复计入担保额",
  },
  {
    id: "gap",
    name: "偿债资金缺口",
    unit: "百万元",
    expression: "max(0, 窗口到期本金 − 可用现金 − 窗口有效未用授信)",
    inputs: [
      "maturity",
      "enterprise.cash",
      "facility.undrawn",
      "facility.validUntil",
    ],
    consumers: ["地图", "问数", "方案", "报告"],
    scope: "演示确定性测算；未用授信不等于已到账资金；不包含经营现金流预测",
  },
  {
    id: "exposure",
    name: "银行借款敞口",
    unit: "百万元",
    expression: "Σ 当前对象集在所选银行的存续借款本金",
    inputs: ["loan.bankId", "loan.principal"],
    consumers: ["地图", "问数", "方案"],
    scope: "按唯一 Loan ID 去重；贷款和授信不相加，不叠加担保金额",
  },
  {
    id: "riskScore",
    name: "历史债务风险评分",
    unit: "分",
    expression: "直接引用现行 1.0.2 模型历史评分",
    inputs: ["riskSource"],
    consumers: ["地图", "问数", "报告"],
    scope: "分数越低越需关注；不在方案中重算，不与成本拼成综合分",
  },
  {
    id: "costPremium",
    name: "融资成本偏离",
    unit: "bp",
    expression: "(企业加权成本 − 同产业演示基准利率) × 100",
    inputs: ["weightedCost", "enterprise.benchmarkRate"],
    consumers: ["地图", "问数", "方案"],
    scope: "产业基准为明示演示参数，非市场报价；未做期限与信用评级匹配",
  },
];
const dataset = {
  schemaVersion: "ofw.workbench.v1.4",
  dataVersion,
  ontologyVersion: "ONT-ENTERPRISE-FINANCE-RISK-1.4",
  asOf,
  classification: "SYNTHETIC_FINANCE_WITH_READONLY_RISK_REFERENCE",
  currency: "CNY",
  amountUnit: "百万元",
  origin:
    "v1.3.2 enterprise master; standalone v1.4 synthetic loan/facility/guarantee/project records",
  assumptions: [
    "全部融资明细均为演示构造；三个已关联主体的总额和加权成本与来源快照对齐，但拆分出的借款不是原始借据",
    "其余18家企业融资数据为独立合成记录",
    "位置为城市级演示布点，不是注册地址",
    "历史风险评分不随模拟改变",
    "利率变化只作用于所选浮息借款；成本变化为本金不变情况下的年化估计",
    "展期只移动到期日，不代表银行已批准；授信收缩只减少未用额度",
  ],
  enterprises,
  banks,
  loans,
  facilities,
  guarantees,
  projects,
  events,
  definitions,
};
dataset.digest = createHash("sha256")
  .update(JSON.stringify(dataset))
  .digest("hex");
mkdirSync(new URL("../public/data/", import.meta.url), { recursive: true });
writeFileSync(new URL('../public/data/business-definitions.js',import.meta.url),`window.OFW_V14_BUSINESS_DEFINITIONS=${JSON.stringify({definitions,digest:dataset.digest,dataVersion,ontologyVersion:dataset.ontologyVersion,asOf})};\n`);
writeFileSync(
  new URL("../public/data/portfolio.json", import.meta.url),
  JSON.stringify(dataset, null, 2) + "\n",
);
const worldPath = new URL(
  "../public/data/world-110m.topojson",
  import.meta.url,
);
const world = JSON.parse(readFileSync(worldPath, "utf8"));
writeFileSync(
  new URL("../public/data/world.geojson", import.meta.url),
  JSON.stringify(feature(world, world.objects.countries)),
);
console.log(
  JSON.stringify({
    enterprises: enterprises.length,
    loans: loans.length,
    facilities: facilities.length,
    guarantees: guarantees.length,
    dataVersion,
    digest: dataset.digest,
  }),
);
