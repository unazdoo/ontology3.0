import Decimal from "decimal.js";
import { z } from "zod";

const D = (value) => new Decimal(value);
const sum = (items) => items.reduce((total, value) => total.plus(value), D(0));
export const numeric = (value) =>
  typeof value === "number" && Number.isFinite(value);
export const round = (value, places = 6) =>
  D(value).toDecimalPlaces(places).toNumber();
export const clone = (value) => structuredClone(value);
export const dateOffset = (date, days) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
export const fmt = (value, digits = 2) =>
  numeric(value)
    ? new Intl.NumberFormat("zh-CN", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      }).format(value)
    : "暂无";
export const amount = (value) =>
  numeric(value) ? `${fmt(value / 100, 2)} 亿元` : "暂无";
export const percent = (value, digits = 2) =>
  numeric(value) ? `${fmt(value, digits)}%` : "暂无数据";
export const riskRank = (tier) =>
  ({ 黑灯: 0, 红灯: 1, 黄灯: 2, 绿灯: 3 })[tier] ?? 4;
const unique = (items) => [
  ...new Map(items.map((item) => [item.id, item])).values(),
];
export const validDate = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export function validateDataset(data) {
  if (data.schemaVersion !== "ofw.workbench.v1.4")
    throw new Error("数据版本无法识别");
  for (const key of [
    "enterprises",
    "banks",
    "loans",
    "facilities",
    "guarantees",
    "projects",
    "events",
    "definitions",
  ]) {
    if (
      !Array.isArray(data[key]) ||
      data[key].some((item) => !item.id || typeof item.id !== "string") ||
      unique(data[key]).length !== data[key].length
    )
      throw new Error(`${key} 身份缺失或重复`);
  }
  const entities = new Set(data.enterprises.map((item) => item.id)),
    banks = new Set(data.banks.map((item) => item.id));
  if (
    !validDate(data.asOf) ||
    !data.dataVersion ||
    !data.ontologyVersion ||
    !data.digest
  )
    throw new Error("缺少有效观察日或版本");
  for (const entity of [...data.enterprises, ...data.banks])
    if (
      entity.coordinates?.length !== 2 ||
      !entity.coordinates.every(numeric) ||
      Math.abs(entity.coordinates[0]) > 180 ||
      Math.abs(entity.coordinates[1]) > 85
    )
      throw new Error(`位置无效 ${entity.id}`);
  for (const entity of data.enterprises)
    if (
      !numeric(entity.cash) ||
      entity.cash < 0 ||
      !numeric(entity.benchmarkRate) ||
      !numeric(entity.riskScore) ||
      !["绿灯", "黄灯", "红灯", "黑灯"].includes(entity.riskTier)
    )
      throw new Error(`企业数据无效 ${entity.id}`);
  for (const loan of data.loans)
    if (
      !entities.has(loan.enterpriseId) ||
      !banks.has(loan.bankId) ||
      !numeric(loan.principal) ||
      loan.principal < 0 ||
      !numeric(loan.rate) ||
      loan.rate < 0 ||
      !["FLOATING", "FIXED"].includes(loan.rateType) ||
      !validDate(loan.startDate) ||
      !validDate(loan.maturityDate) ||
      loan.maturityDate <= loan.startDate ||
      loan.currency !== "CNY" ||
      !data.projects.some(
        (project) =>
          project.id === loan.projectId &&
          project.enterpriseId === loan.enterpriseId,
      )
    )
      throw new Error(`借款合同无效 ${loan.id}`);
  for (const facility of data.facilities)
    if (
      !entities.has(facility.enterpriseId) ||
      !banks.has(facility.bankId) ||
      !numeric(facility.undrawn) ||
      facility.undrawn < 0 ||
      !validDate(facility.validUntil) ||
      facility.currency !== "CNY"
    )
      throw new Error(`授信无效 ${facility.id}`);
  for (const guarantee of data.guarantees)
    if (
      !entities.has(guarantee.guarantorId) ||
      !entities.has(guarantee.beneficiaryId) ||
      guarantee.guarantorId === guarantee.beneficiaryId ||
      !numeric(guarantee.amount) ||
      guarantee.amount < 0 ||
      !validDate(guarantee.validUntil)
    )
      throw new Error(`担保关系无效 ${guarantee.id}`);
  for (const object of [...data.projects, ...data.events])
    if (!entities.has(object.enterpriseId))
      throw new Error(`归属无效 ${object.id}`);
  return data;
}

export const scenarioSchema = z.object({
  rateBps: z.number().min(-200).max(500),
  creditHaircut: z.number().min(0).max(100),
  extensionDays: z.number().int().min(0).max(365),
  bankId: z.string().nullable().default(null),
});
export const defaultParams = () => ({
  rateBps: 0,
  creditHaircut: 0,
  extensionDays: 0,
  bankId: null,
});

export function projectLoans(data, plan = null) {
  if (!plan) return data.loans;
  const parameters = scenarioSchema.parse(plan.parameters),
    set = new Set(plan.objectIds);
  if (
    plan.dataVersion !== data.dataVersion ||
    plan.dataDigest !== data.digest ||
    plan.ontologyVersion !== data.ontologyVersion
  )
    throw new Error("方案输入版本与当前数据不一致");
  if (
    !plan.objectIds.length ||
    plan.objectIds.some(
      (id) => !data.enterprises.some((entity) => entity.id === id),
    ) ||
    (parameters.bankId &&
      !data.banks.some((bank) => bank.id === parameters.bankId))
  )
    throw new Error("方案对象无效");
  return data.loans.map((loan) => {
    if (
      loan.startDate > data.asOf ||
      loan.maturityDate <= data.asOf ||
      !set.has(loan.enterpriseId) ||
      (parameters.bankId && loan.bankId !== parameters.bankId)
    )
      return loan;
    return {
      ...loan,
      rate:
        loan.rateType === "FLOATING"
          ? Math.max(
              0,
              round(D(loan.rate).plus(D(parameters.rateBps).div(100))),
            )
          : loan.rate,
      maturityDate: dateOffset(loan.maturityDate, parameters.extensionDays),
    };
  });
}

export function facilityUndrawn(facility, plan = null) {
  if (!plan) return facility.undrawn;
  const parameters = scenarioSchema.parse(plan.parameters),
    affected =
      plan.objectIds.includes(facility.enterpriseId) &&
      (!parameters.bankId || facility.bankId === parameters.bankId);
  return D(facility.undrawn)
    .times(affected ? D(1).minus(D(parameters.creditHaircut).div(100)) : 1)
    .toNumber();
}
export function metrics(
  data,
  ids = data.enterprises.map((item) => item.id),
  horizon = 90,
  plan = null,
) {
  if (![30, 90, 180, 365].includes(horizon))
    throw new Error("不支持的展望窗口");
  const requested = new Set(ids),
    end = dateOffset(data.asOf, horizon);
  const loans = unique(
    projectLoans(data, plan).filter(
      (loan) =>
        requested.has(loan.enterpriseId) &&
        loan.startDate <= data.asOf &&
        loan.maturityDate > data.asOf,
    ),
  );
  const entities = data.enterprises.filter((item) => requested.has(item.id));
  const rows = entities.map((entity) => {
    const owned = loans.filter((loan) => loan.enterpriseId === entity.id),
      total = sum(owned.map((loan) => loan.principal));
    const maturityLoans = owned.filter((loan) => loan.maturityDate <= end),
      due = sum(maturityLoans.map((loan) => loan.principal));
    const interest = sum(
      owned.map((loan) => D(loan.principal).times(loan.rate).div(100)),
    );
    const credit = sum(
      data.facilities
        .filter(
          (facility) =>
            facility.enterpriseId === entity.id && facility.validUntil >= end,
        )
        .map((facility) => facilityUndrawn(facility, plan)),
    );
    const cost = total.gt(0) ? round(interest.div(total).times(100)) : null;
    return {
      ...entity,
      balance: total.toNumber(),
      cost,
      annualInterest: interest.toNumber(),
      due: due.toNumber(),
      dueRatio: total.gt(0) ? round(due.div(total).times(100)) : null,
      credit: credit.toNumber(),
      gap: Decimal.max(0, due.minus(entity.cash).minus(credit)).toNumber(),
      premium:
        cost === null
          ? null
          : round(D(cost).minus(entity.benchmarkRate).times(100)),
      loanIds: owned.map((loan) => loan.id),
      dueLoanIds: maturityLoans.map((loan) => loan.id),
      bankIds: [...new Set(owned.map((loan) => loan.bankId))],
      resultKind: plan ? "SIMULATION" : "DEMO_BASELINE",
    };
  });
  const total = sum(rows.map((row) => row.balance)),
    interest = sum(rows.map((row) => row.annualInterest));
  return {
    rows,
    loans,
    asOf: data.asOf,
    end,
    horizon,
    dataVersion: data.dataVersion,
    dataDigest: data.digest,
    ontologyVersion: data.ontologyVersion,
    planId: plan?.id || null,
    resultKind: plan ? "SIMULATION" : "DEMO_BASELINE",
    totals: {
      count: rows.length,
      balance: total.toNumber(),
      cost: total.gt(0) ? round(interest.div(total).times(100)) : null,
      due: sum(rows.map((row) => row.due)).toNumber(),
      gap: sum(rows.map((row) => row.gap)).toNumber(),
      annualInterest: interest.toNumber(),
      attention: rows.filter((row) => row.riskTier !== "绿灯").length,
    },
  };
}

export function bankExposure(data, result) {
  return data.banks
    .map((bank) => {
      const loans = unique(
        result.loans.filter((loan) => loan.bankId === bank.id),
      );
      return {
        ...bank,
        balance: sum(loans.map((loan) => loan.principal)).toNumber(),
        enterpriseIds: [...new Set(loans.map((loan) => loan.enterpriseId))],
        loanIds: loans.map((loan) => loan.id),
      };
    })
    .filter((bank) => bank.loanIds.length)
    .sort((a, b) => b.balance - a.balance);
}

export function filterEnterprises(data, filters, horizon = 90, plan = null) {
  const scope =
    filters.objectIds === null || filters.objectIds === undefined
      ? data.enterprises.map((item) => item.id)
      : filters.objectIds;
  const search = String(filters.search || "")
    .trim()
    .toLowerCase();
  return metrics(data, scope, horizon, plan)
    .rows.filter(
      (row) =>
        (filters.boxIds == null || filters.boxIds.includes(row.id)) &&
        (!search ||
          [row.name, row.city, row.province, row.id, ...row.aliasNames]
            .join(" ")
            .toLowerCase()
            .includes(search)) &&
        (!filters.industry || row.industry === filters.industry) &&
        (!filters.riskTier || row.riskTier === filters.riskTier) &&
        (!filters.bankId || row.bankIds.includes(filters.bankId)) &&
        (!filters.highCost || row.premium > (filters.premiumThreshold || 0)) &&
        (!filters.gapOnly || row.gap > 0),
    )
    .sort((a, b) =>
      filters.sort === "cost"
        ? (b.cost ?? -Infinity) - (a.cost ?? -Infinity)
        : filters.sort === "due"
          ? b.due - a.due
          : filters.sort === "gap"
            ? b.gap - a.gap
            : riskRank(a.riskTier) - riskRank(b.riskTier) ||
              a.riskScore - b.riskScore,
    );
}
export function ruleEvidence(filters) {
  return filters.ruleRef
    ? clone(filters.ruleRef)
    : filters.highCost
      ? {
          id: filters.ruleId || "baseline",
          premiumThreshold: filters.premiumThreshold || 0,
        }
      : null;
}

const intents = [
  "overview",
  "filter",
  "banks",
  "relations",
  "explain",
  "simulate",
  "action",
];
export const querySchema = z.object({
  intent: z.enum(intents),
  horizon: z.number().optional(),
  highCost: z.boolean().optional(),
  gapOnly: z.boolean().optional(),
  riskTier: z.string().optional(),
  industry: z.string().optional(),
  bankId: z.string().optional(),
  objectIds: z.array(z.string()).optional(),
  premiumThreshold: z.number().min(0).max(200).optional(),
  parameters: scenarioSchema.optional(),
});

const queryWords = [
  "请帮我", "帮我", "请问", "请", "查询", "查看", "筛选", "找出", "解释", "为什么",
  "这家公司", "该公司", "这家企业", "该企业", "这些企业", "那些企业", "企业", "集团",
  "全部", "所有", "当前", "这些", "那些", "总体", "总额", "平均", "合计", "概览",
  "融资余额", "融资成本", "融资", "加权", "余额", "成本", "本金", "到期",
  "高成本", "成本偏离", "偏离", "高于", "超过", "资金缺口", "偿债", "资金", "缺口",
  "到期压力较大", "优先关注", "需要关注", "需要复核", "红灯", "黄灯", "绿灯", "黑灯",
  "风电", "环保", "核电", "产业", "板块", "未用授信", "授信", "借款",
  "主要依赖", "依赖", "关联银行", "银行敞口", "银行", "敞口", "担保关系", "担保", "关联", "关系", "传染",
  "详情", "依据", "风险", "方案", "模拟", "如果", "未来", "展望", "窗口",
  "发起", "创建", "安排", "跟进", "协商", "处置", "多少", "哪些", "分别", "存在",
  "的", "是", "有", "和", "与", "及", "且", "或", "各家", "各", "家", "本", "全", "吗", "呢",
].sort((left, right) => right.length - left.length);

function assertQuestionConsumed(question, matched, bank, parameters) {
  const names = [...matched.flatMap(entity => [entity.name, entity.id, ...entity.aliasNames]), ...(bank ? [bank.name] : [])]
    .sort((left, right) => right.length - left.length);
  // Consume left to right, preserving unknown spans even beside a registered name.
  let remaining = question;
  while (remaining) {
    const punctuation = /^[\s，,。？?！!、；;：:（）()“”"「」]+/.exec(remaining);
    if (punctuation) { remaining = remaining.slice(punctuation[0].length); continue; }
    const name = names.find(value => remaining.toLowerCase().startsWith(value.toLowerCase()) && !/^[A-Za-z0-9]/.test(remaining.slice(value.length)));
    const parameter = parameters.find(value => value && remaining.startsWith(value));
    const window = /^(?:30|90|180|365)\s*天/.exec(remaining)?.[0];
    const word = name || parameter || window || queryWords.find(value => remaining.startsWith(value));
    if (!word) throw new Error(`主体未登记或问题含未识别内容“${remaining.slice(0, 24)}”。请选用已登记主体或当前企业范围，并调整为单阶段问题；当前范围未改变。`);
    remaining = remaining.slice(word.length);
  }
}

export function parseQuestion(text, data) {
  const q = text.trim();
  if (!q) throw new Error("请输入问题");
  const matched = data.enterprises.filter((entity) =>
    [entity.name, entity.id, ...entity.aliasNames].some((name) =>
      new RegExp(
        name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![A-Za-z0-9])",
        "i",
      ).test(q),
    ),
  );
  const bank = data.banks.find((item) => q.includes(item.name));
  if (
    data.banks.filter((item) => q.includes(item.name)).length > 1 ||
    ["红灯", "黄灯", "绿灯", "黑灯"].filter((value) => q.includes(value))
      .length > 1 ||
    ["风电", "环保", "核电"].filter((value) => q.includes(value)).length > 1
  )
    throw new Error(
      "当前问数一次支持一个银行、产业和风险档位，请分组查询或清除筛选查看全部企业。",
    );
  if (
    /(?:最低|最高|前\d+|同比|环比|预测|美元|季度|去年|明年|成本高于\s*\d.*%)/.test(
      q,
    )
  )
    throw new Error(
      "该问题涉及未登记的排名、跨期或币种口径，请调整问题后重试。",
    );
  if (
    /银行/.test(q) &&
    !bank &&
    !/哪些银行|银行有哪些|银行敞口|依赖.*银行|关联银行|各家银行|全部银行/.test(
      q,
    )
  )
    throw new Error("没有识别到该银行，请使用已登记银行名称。");
  const intent = /方案|模拟|收缩|降息|加息|展期|如果/.test(q)
    ? "simulate"
    : /发起|创建|安排|跟进|协商|处置/.test(q)
      ? "action"
      : /担保|关联|传染/.test(q)
        ? "relations"
        : bank || /哪些银行|银行敞口|依赖.*银行/.test(q)
          ? "banks"
          : /为什么|解释|依据|详情/.test(q)
            ? "explain"
            : /多少|总额|平均|概览/.test(q) && !/筛选|找出/.test(q)
              ? "overview"
              : /筛选|找出|高成本|高于|缺口|红灯|黄灯|绿灯|黑灯|风电|环保|核电/.test(
                    q,
                  )
                ? "filter"
                : /概览|总体|总额|平均|多少|优先关注|到期|融资成本/.test(q)
                  ? "overview"
                  : null;
  for (const [label, pattern] of [["利率", /降息|加息/g], ["授信收缩", /收缩/g], ["展期", /展期/g]]) {
    if ([...q.matchAll(pattern)].length > 1)
      throw new Error(`暂不支持分阶段、重复或冲突的${label}参数；每类参数只能填写一次，请明确单阶段假设后重试。`);
  }
  if (/先.*(?:再|后|然后)|分阶段|分别(?:降息|加息|收缩|展期)/.test(q))
    throw new Error("暂不支持分阶段方案，请将各类参数整理为一次生效的单阶段假设后重试。");
  const rate = /(降息|加息)\s*(\d+(?:\.\d)?)\s*bp\b/i.exec(q),
    credit = /收缩\s*(\d+(?:\.\d)?)\s*[%％]/.exec(q),
    extension = /展期\s*(\d+)\s*天/.exec(q),
    threshold = /(?:高于|超过|偏离)\s*(\d+(?:\.\d+)?)\s*bp/i.exec(q);
  if ((/降息|加息/.test(q) && !rate) || (/收缩/.test(q) && !credit) || (/展期/.test(q) && !extension))
    throw new Error("参数无法识别：利率使用非负数bp、授信收缩使用非负百分比（最多1位小数），展期使用非负整数天。请修正后重试。");
  const horizonText = q.replace(/展期\s*\d+\s*天/g, "");
  const dayMatch = /(\d+)\s*天/.exec(horizonText);
  if (dayMatch && ![30, 90, 180, 365].includes(Number(dayMatch[1])))
    throw new Error("当前展望窗口支持30、90、180或365天。");
  if ([...horizonText.matchAll(/(\d+)\s*天/g)].length > 1)
    throw new Error("请一次指定一个展望窗口。");
  assertQuestionConsumed(q, matched, bank, [rate?.[0], credit?.[0], extension?.[0], threshold?.[0]]);
  if (!intent)
    throw new Error(
      "当前问题无法映射到已登记业务口径，请指定企业、融资成本、到期本金、银行敞口或担保关系。",
    );
  return querySchema.parse({
    intent,
    ...(dayMatch ? { horizon: Number(dayMatch[1]) } : {}),
    ...(/高成本|成本高于/.test(q) || threshold ? { highCost: true } : {}),
    ...(threshold ? { premiumThreshold: Number(threshold[1]) } : {}),
    ...(/有.*缺口|存在.*缺口|缺口.*企业|到期压力较大/.test(q)
      ? { gapOnly: true }
      : {}),
    ...(intent === "simulate"
      ? {
          parameters: scenarioSchema.parse({
            ...defaultParams(),
            rateBps: rate ? Number(rate[2]) * (rate[1] === "降息" ? -1 : 1) : 0,
            creditHaircut: credit ? Number(credit[1]) : 0,
            extensionDays: extension ? Number(extension[1]) : 0,
            bankId: bank?.id || null,
          }),
        }
      : {}),
    ...(matched.length ? { objectIds: matched.map((item) => item.id) } : {}),
    ...(bank ? { bankId: bank.id } : {}),
    ...(["红灯", "黄灯", "绿灯", "黑灯"].find((tier) => q.includes(tier))
      ? {
          riskTier: ["红灯", "黄灯", "绿灯", "黑灯"].find((tier) =>
            q.includes(tier),
          ),
        }
      : {}),
    ...(!matched.length && ["风电", "环保", "核电"].find((industry) => q.includes(industry))
      ? {
          industry: ["风电", "环保", "核电"].find((industry) =>
            q.includes(industry),
          ),
        }
      : {}),
  });
}

export function query(
  data,
  text,
  { filters, horizon, plan = null, selectedId = null },
) {
  const parsed = parseQuestion(text, data);
  const nextFilters = {
    ...filters,
    ...(parsed.objectIds
      ? {
          objectIds: parsed.objectIds,
          boxIds: null,
          ruleRef: null,
          search: "",
          industry: "",
          riskTier: "",
          bankId: "",
          highCost: false,
          gapOnly: false,
        }
      : {}),
  };
  for (const field of [
    "highCost",
    "gapOnly",
    "industry",
    "riskTier",
    "bankId",
    "premiumThreshold",
  ])
    if (parsed[field] !== undefined) nextFilters[field] = parsed[field];
  if (
    parsed.premiumThreshold !== undefined &&
    nextFilters.ruleRef &&
    parsed.premiumThreshold !== nextFilters.ruleRef.premiumThreshold
  ) {
    nextFilters.ruleRef = null;
    nextFilters.ruleId = null;
  }
  if (!parsed.objectIds && /这家|该企业|该公司/.test(text)) {
    if (!selectedId)
      throw new Error("请先选择一家企业，再使用“这家企业”提问。");
    Object.assign(nextFilters, {
      objectIds: [selectedId],
      boxIds: null,
      ruleRef: null,
      search: "",
      industry: "",
      riskTier: "",
      bankId: "",
      highCost: false,
      gapOnly: false,
    });
  }
  const nextHorizon = parsed.horizon || horizon;
  const rows = filterEnterprises(data, nextFilters, nextHorizon, plan);
  const result = metrics(
    data,
    rows.map((row) => row.id),
    nextHorizon,
    plan,
  );
  const refs =
    parsed.intent === "banks"
      ? bankExposure(data, result)
          .filter((bank) => !parsed.bankId || bank.id === parsed.bankId)
          .map((bank) => ({
            type: "bank",
            id: bank.id,
            name: bank.name,
            primary: amount(bank.balance),
            secondary: `${bank.enterpriseIds.length} 家企业`,
          }))
      : parsed.intent === "relations"
        ? data.guarantees
            .filter(
              (g) =>
                g.validUntil >= data.asOf &&
                rows.some(
                  (row) =>
                    row.id === g.guarantorId || row.id === g.beneficiaryId,
                ),
            )
            .map((g) => ({
              type: "guarantee",
              id: g.id,
              name: g.name,
              primary: amount(g.amount),
              secondary: "担保关系 · 不计入借款本金",
            }))
        : rows.map((row) => ({
            type: "enterprise",
            id: row.id,
            name: row.name,
            primary: parsed.highCost ? `${fmt(row.cost)}%` : row.riskTier,
            secondary: `缺口 ${amount(row.gap)}`,
          }));
  let summary = !rows.length
    ? "当前条件下没有匹配企业。"
    : parsed.intent === "banks"
      ? `当前企业涉及 ${refs.length} 家银行；借款本金按唯一合同汇总，担保和未用授信不重复计入。`
      : parsed.intent === "relations"
        ? `找到 ${refs.length} 条已登记担保关系。关系表示合同关联，不等同于风险已经传染。`
        : parsed.intent === "simulate"
          ? `已固定 ${rows.length} 家企业与 ${result.loans.length} 笔借款，下一步确认方案参数。`
          : parsed.intent === "action"
            ? `已准备 ${rows.length} 家企业的分析依据，确认负责人和到期日后建立本地跟踪事项。`
            : `${rows.length} 家企业，融资余额 ${amount(result.totals.balance)}，余额加权成本 ${fmt(result.totals.cost)}%；未来 ${nextHorizon} 天到期 ${amount(result.totals.due)}，测算缺口 ${amount(result.totals.gap)}。`;
  if (parsed.intent === "explain" && rows.length === 1) {
    const row = rows[0],
      banks = bankExposure(data, result),
      largest = banks[0];
    summary = `${row.name}：历史评分 ${fmt(row.riskScore)} 分，${row.riskTier}，引用现行1.0.2模型。当前融资成本 ${fmt(row.cost)}%，较产业演示基准偏离 ${fmt(row.premium)}bp；未来${nextHorizon}天到期 ${amount(row.due)}，测算缺口 ${amount(row.gap)}。${largest && row.balance > 0 ? `最大借款银行为${largest.name}，占本金${fmt((largest.balance / row.balance) * 100)}%。` : ""}历史评分成因不能由本次合成借款反推，评分归因须单独核验模型证据。`;
  }
  return {
    parsed,
    filters: nextFilters,
    horizon: nextHorizon,
    result,
    refs,
    summary,
    question: text,
    evidence: {
      dataVersion: data.dataVersion,
      dataDigest: data.digest,
      ontologyVersion: data.ontologyVersion,
      asOf: data.asOf,
      horizon: nextHorizon,
      objectIds: rows.map((row) => row.id),
      resultKind: result.resultKind,
      planId: result.planId,
      rule: ruleEvidence(nextFilters),
      bankId: parsed.bankId || null,
    },
  };
}

export function createPlan(
  data,
  objectIds,
  parameters,
  name = "融资调整方案",
  horizon = 90,
) {
  const parsed = scenarioSchema.parse(parameters),
    known = new Set(data.enterprises.map((entity) => entity.id));
  if (![30, 90, 180, 365].includes(horizon))
    throw new Error("不支持的展望窗口");
  if (!objectIds.length || objectIds.some((id) => !known.has(id)))
    throw new Error("方案需包含有效企业");
  if (parsed.bankId && !data.banks.some((bank) => bank.id === parsed.bankId))
    throw new Error("方案银行不存在");
  return {
    id: crypto.randomUUID(),
    name: name.trim() || "未命名方案",
    objectIds: [...new Set(objectIds)],
    parameters: parsed,
    horizon,
    asOf: data.asOf,
    dataVersion: data.dataVersion,
    dataDigest: data.digest,
    ontologyVersion: data.ontologyVersion,
    createdAt: new Date().toISOString(),
    resultKind: "SIMULATION",
  };
}

export function comparePlan(data, plan) {
  const before = metrics(data, plan.objectIds, plan.horizon),
    after = metrics(data, plan.objectIds, plan.horizon, plan);
  return {
    before,
    after,
    changes: after.rows.map((row) => {
      const prior = before.rows.find((item) => item.id === row.id);
      return {
        id: row.id,
        name: row.name,
        cost:
          row.cost === null || prior.cost === null
            ? null
            : round(D(row.cost).minus(prior.cost)),
        due: round(D(row.due).minus(prior.due)),
        gap: round(D(row.gap).minus(prior.gap)),
        annualInterest: round(
          D(row.annualInterest).minus(prior.annualInterest),
        ),
        riskScoreUnchanged: row.riskScore === prior.riskScore,
      };
    }),
  };
}

export const taskTransitions = Object.freeze({
  OPEN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: ["OPEN"],
  CANCELLED: ["OPEN"],
});
export const taskLabels = Object.freeze({
  OPEN: "待处理",
  IN_PROGRESS: "跟进中",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
});
export function transitionTask(task, status, note) {
  if (!taskTransitions[task.status]?.includes(status))
    throw new Error("不允许的事项状态变更");
  if (!note.trim()) throw new Error("请记录处理结果或变更原因");
  return {
    ...clone(task),
    status,
    updatedAt: new Date().toISOString(),
    history: [
      ...task.history,
      {
        from: task.status,
        to: status,
        note: note.trim(),
        at: new Date().toISOString(),
      },
    ],
  };
}

export function pointInBounds([lon, lat], { west, east, south, north }) {
  return (
    lat >= south &&
    lat <= north &&
    (west <= east ? lon >= west && lon <= east : lon >= west || lon <= east)
  );
}
