"use strict";

const baseService = require("./report-service-v5.js");

const SERVICE_VERSION = "1.5.0";
const CONTENT_SCHEMA_VERSION = "ofw.s003.m06.enterprise-report-content.v7";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== "object" || Object.isFrozen(value) || seen.has(value)) return value;
  seen.add(value);
  Object.values(value).forEach((child) => deepFreeze(child, seen));
  return Object.freeze(value);
}

function score(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : "—";
}

function stripTechnicalSentence(value) {
  return String(value || "")
    .replaceAll("评分分档与重大因子管理信号分开判断；管理关注升级不改变当前评分或风险分档，行动申请仍须由风险管理人员人工确认。", "评分结果保持不变；重大因子作为亮灯预警中的诊断证据，由对应成员单位接口人一并核实。")
    .replaceAll("评分分档与重大因子管理信号分开判断", "评分结果与管理信号分别呈现")
    .replaceAll("管理关注升级不改变当前评分或风险分档", "管理信号不修改当前评分结果")
    .replaceAll("由风险管理人员优先核实，并人工判断是否提交行动申请。", "由对应成员单位接口人在本轮亮灯预警中优先核实。")
    .replaceAll("由风险管理人员人工判断是否提交行动申请。", "由对应成员单位接口人在本轮亮灯预警中核实。")
    .replaceAll("决定是否提交标准行动申请。", "在对应亮灯预警中完成事实核实。")
    .replaceAll(
      "红灯或黑灯企业建议按月高频跟踪，重大变化及时提交行动申请。",
      "红灯或黑灯企业已进入本轮亮灯预警跟踪，成员单位接口人确认后按月跟踪并记录重大变化。"
    )
    .replace(
      /(?:\s*由对应成员单位接口人在本轮亮灯预警中优先核实。){2,}/g,
      " 由对应成员单位接口人在本轮亮灯预警中优先核实。"
    );
}

function stripTechnicalSentenceLegacy(value) {
  return String(value || "")
    .replaceAll("评分分档与重大因子管理信号分开判断；管理关注升级不改变当前评分或风险分档，行动申请仍须由风险管理人员人工确认。", "评分结果保持不变；本轮识别到的管理信号请由风险管理人员核实后决定是否提交行动申请。")
    .replaceAll("评分分档与重大因子管理信号分开判断", "评分结果与管理信号分别呈现")
    .replaceAll("管理关注升级不改变当前评分或风险分档", "管理信号不修改当前评分结果");
}

const INDICATOR_MEANING = Object.freeze({
  "总资产": ["资产规模不等同于可动用偿债资源", "低效、受限或在建资产可能占用资金并削弱资产变现能力"],
  "净利润": ["盈利贡献不足以形成稳定内部偿债来源", "利润不足或波动可能压缩利息和本金偿付缓冲"],
  "经营活动产生的现金流入": ["经营回款对短期债务的支撑偏弱", "回款延迟可能增加续贷、外部支持或临时融资依赖"],
  "现金比率": ["可动用现金对短期负债的覆盖不足", "短期到期债务可能更多依赖回款、续贷或股东支持"],
  "资产负债率": ["杠杆水平对再融资弹性形成压力", "债务成本上升或融资收紧时安全垫可能继续收窄"],
  "利息保障倍数": ["经营收益对利息支出的覆盖不足", "利息刚性支出可能挤压经营现金流和新增融资空间"],
  "现金流动负债比率": ["经营现金流对流动负债的覆盖不足", "短期债务滚续和临时融资依赖可能上升"],
  "应收账款周转率": ["应收款回收速度偏慢", "账龄拉长、补贴或客户结算延迟可能造成资金占用"],
  "总资产周转率": ["资产投入转化为收入的效率偏弱", "沉淀资产或低利用率项目可能拖累现金回收"],
  "总资产收益率": ["资产创利能力偏弱", "低收益项目可能难以持续覆盖债务成本和资本占用"],
  "净资产收益率": ["股东资本回报偏弱", "盈利不足或权益资本使用效率偏低可能削弱资本缓冲"],
  "销售毛利率": ["业务毛利空间承压", "价格、产品结构或成本波动可能压缩经营缓冲"],
  "营业利润率": ["主营经营利润空间偏弱", "收入下滑或成本费用刚性可能削弱持续偿债能力"],
  "盈利稳定性": ["盈利历史或利润波动需要进一步核实", "历史不足按 A 或真实波动都可能影响对持续偿债能力的判断"],
  "股东权益同比增长率": ["资本缓冲出现收缩", "亏损、分红、减值或资本投入不足可能降低风险承受能力"]
});

const FACTOR_MEANING = Object.freeze([
  ["融资能力", "授信使用率或融资条件偏紧，后续融资和置换安排需要提前落实"],
  ["资金余缺", "未来资金计划存在缺口或预警，需优先核对到期债务、回款和可用资金"],
  ["诉讼", "或有负债、资产保全或预计损失可能影响现金流和融资条件"],
  ["担保", "对外担保责任可能在被担保方出现风险时转化为实际偿债压力"],
  ["总部支持", "外部支持强度或兑现条件偏弱，不能将未落实承诺视同可用资金"],
  ["电价", "收入和经营现金流对电价或结算变化较敏感"],
  ["环保", "环保约束、整改或运营条件变化可能影响收入和债务安排"]
]);

function indicatorMeaning(name) {
  return INDICATOR_MEANING[name] || ["该指标进入本企业最低关注项", "如该表现持续，可能削弱现金流、盈利或资本缓冲，需要结合企业事实核实"];
}

function factorMeaning(name) {
  const item = FACTOR_MEANING.find(([key]) => String(name || "").includes(key));
  return item?.[1] || "该人工输入命中负向调节档位，需要结合原始证据、持续时间和缓释安排核实";
}

function tierSummary(tierId) {
  return ({
    GREEN: "当前评分落在绿灯区间，尚未形成分档层面的高风险结论，但最低关注项仍需纳入持续监测",
    YELLOW: "当前评分进入黄灯区间，说明偿债缓冲或资金安排出现需要跟踪的弱化信号",
    RED: "当前评分进入红灯区间，说明偿债安全垫明显收窄，应进入专项预警核实与分办",
    BLACK: "当前评分进入黑灯区间，说明进入应急风险状态，应优先核对违约防控与资金保障"
  })[tierId] || "当前评分已形成风险分档，需要结合本轮证据继续核实";
}

function tierSummaryLegacy(tierId) {
  return ({
    GREEN: "当前评分落在绿灯区间，尚未形成分档层面的高风险结论，但最低关注项仍需纳入持续监测",
    YELLOW: "当前评分进入黄灯区间，说明偿债缓冲或资金安排出现需要跟踪的弱化信号",
    RED: "当前评分进入红灯区间，说明偿债安全垫明显收窄，应优先人工确认专项处置",
    BLACK: "当前评分进入黑灯区间，说明进入应急风险状态，应优先核对违约防控与资金保障"
  })[tierId] || "当前评分已形成风险分档，需要结合本轮证据继续核实";
}

function tierHeadline(tierId, topics) {
  const first = topics[0] || "本轮最低关注项";
  return ({
    GREEN: `常态监测：优先改善${first}`,
    YELLOW: `预防性跟踪：重点核查${first}`,
    RED: `专项处置：优先压降${first}带来的偿债压力`,
    BLACK: `应急响应：立即核对${first}与资金保障`
  })[tierId] || `持续监测：重点核查${first}`;
}

function genericFactorRecommendation(factor) {
  const name = String(factor.name || "");
  if (name.includes("融资能力")) return "核实已用授信、可用额度、融资期限与成本，形成未来三个月融资安排。";
  if (name.includes("资金余缺")) return "建立未来三个月滚动资金预测，逐笔落实到期债务、回款、授信和应急资金来源。";
  if (name.includes("诉讼")) return "核实诉讼标的、进展、预计损失和资产保全影响，形成法务与资金联合预案。";
  if (name.includes("担保")) return "核实对外担保、被担保方偿债能力及追偿条件，建立持续跟踪清单。";
  if (name.includes("总部支持")) return "确认股东或总部支持承诺、触发条件、金额和可执行时间。";
  if (name.includes("电价")) return "复核电价变化、结算偏差和收入敏感性，形成经营现金流情景测算。";
  return "核实该人工输入的事实依据、持续时间和可执行的缓释安排。";
}

function upgradeReport(sourceReport, options = {}) {
  const legacyV7 = options.legacyV7 === true;
  const normalizeSentence = legacyV7 ? stripTechnicalSentenceLegacy : stripTechnicalSentence;
  const report = clone(baseService.upgradeReport(sourceReport, {
    ...options,
    contentSchemaVersion: CONTENT_SCHEMA_VERSION,
    reportVersion: options.reportVersion || SERVICE_VERSION,
    contentVersion: options.contentVersion || SERVICE_VERSION,
    artifactVersion: options.artifactVersion || "html-print-capability-v7"
  }));
  const assessment = report.assessment || {};
  const details = new Map((report.indicatorDetails || []).map((item) => [item.name, item]));
  const negativeFactors = (report.adjustmentFactors || []).filter((item) => Number(item.coefficient) < 0);
  const sourceIndicators = (report.keyIndicators || []).slice(0, 3);
  const sourceDiagnosis = report.keyRiskDiagnosis?.indicatorItems || [];
  const underConstruction = assessment.isUnderConstruction === true;
  const indicatorItems = underConstruction
    ? [{
        diagnosisId: "D-C-01",
        type: "construction",
        title: "在建企业固定评分口径",
        severity: "attention",
        actualValueDisplay: "财务原始基础分 60.00 分",
        currentScore: 60,
        statement: "该企业处于建设期，财务原始基础分按已确认口径固定为 60 分，15 项财务指标保留定义和状态但不形成逐项得分排序。因此，本报告关注的是建设资金、工程进度、投产条件、融资保障和运营资金安排，而不是把固定分误读为经营指标已验证良好。",
        verificationFocus: "核实施工进度、未付工程款、已落实融资、尚需资金、预计投产时间和首期运营资金安排。",
        evidencePointer: "S003-RULE-UNDER-CONSTRUCTION-60"
      }]
    : sourceIndicators.map((item, index) => {
        const detail = details.get(item.name) || item;
        const original = sourceDiagnosis.find((diagnosis) => diagnosis.title === item.name) || {};
        const [meaning, exposure] = indicatorMeaning(item.name);
        const scoreValue = Number(item.score || 0);
        const scoreLabel = scoreValue < 25 ? "显著弱项" : scoreValue < 50 ? "重点关注项" : "相对弱项";
        return {
          diagnosisId: `D-I-${String(index + 1).padStart(2, "0")}`,
          type: "indicator",
          title: item.name,
          severity: scoreValue < 25 ? "high" : scoreValue < 50 ? "medium" : "attention",
          actualValueDisplay: original.actualValueDisplay || "—",
          currentScore: scoreValue,
          statement: `${item.name}实际值为 ${original.actualValueDisplay || "—"}，本轮得分 ${score(scoreValue)} 分，属于${scoreLabel}。该结果提示${meaning}；如果相关表现持续，可能出现${exposure}。这是一项本轮核查重点，不等同于已确认发生违约。`,
          verificationFocus: original.verificationFocus || `核实${item.name}的口径、形成原因、持续时间和量化改善目标。`,
          evidencePointer: original.evidencePointer || detail.evidencePointer || null
        };
      });
  const factorItems = negativeFactors.map((factor, index) => {
    const source = (report.keyRiskDiagnosis?.factorItems || []).find((item) => item.title === factor.name) || {};
    const coefficient = Number(factor.coefficient || 0);
    const input = factor.inputValue ?? factor.tierLabel ?? "已命中";
    const tier = factor.tierLabel || "当前档位";
    return {
      diagnosisId: `D-F-${String(index + 1).padStart(2, "0")}`,
      type: "factor",
      title: factor.name,
      severity: coefficient <= -0.15 ? "high" : "medium",
      statement: `企业填报“${input}”，对应配置档位“${tier}”，本轮调节 ${coefficient.toFixed(2)} 分；原始评分 ${score(assessment.rawScore)} 分经该类因子调整后形成当前综合评分 ${score(assessment.finalScore)} 分。该信号提示${factorMeaning(factor.name)}。`,
      recommendation: normalizeSentence(source.recommendation || genericFactorRecommendation(factor)),
      evidencePointer: source.evidencePointer || factor.evidencePointer || factor.factorId || null
    };
  });
  const indicatorTopics = indicatorItems.filter((item) => item.type !== "construction").map((item) => item.title);
  const factorTopics = negativeFactors.map((item) => item.name);
  const potentialRisks = [
    ...indicatorItems.filter((item) => item.type !== "construction").map((item) => ({
      title: item.title,
      detail: item.statement,
      source: item.evidencePointer || "当前报告指标明细"
    })),
    ...factorItems.map((item) => ({ title: item.title, detail: item.statement, source: item.evidencePointer || "当前报告调节因子明细" }))
  ];
  const tierId = assessment.riskTier?.tierId;
  const managementEscalation = report.managementEscalation?.triggered ? {
    ...report.managementEscalation,
    signalType: "优先管理信号",
    guidance: legacyV7
      ? "该信号不修改已形成的评分结果；请由风险管理人员核实事实后，决定是否提交标准行动申请。"
      : tierId && tierId !== "GREEN"
        ? "该信号不修改评分或风险分档，也不单独形成行动；本轮已按黄灯、红灯或黑灯亮灯形成一条预警，成员单位接口人在对应行动申请中一并核实。"
        : "该信号不修改评分或风险分档，也不单独形成行动；本轮为绿灯，纳入持续监测，后续如亮灯再按风险分档形成预警。"
  } : null;
  const riskList = potentialRisks.slice(0, 3).map((item) => item.title).join("、");
  const factorSummary = factorTopics.length ? `本轮另有负向调节因子：${factorTopics.join("、")}。` : "本轮未命中负向调节因子。";
  const conclusion = underConstruction
    ? `${report.enterprise.name}属于在建企业，财务原始基础分按已确认口径固定为 60 分；叠加本轮调节因子后综合评分为 ${score(assessment.finalScore)} 分，风险等级为${assessment.riskTier?.name || "当前分档"}。固定基础分不代表经营指标已经验证良好，潜在风险重点是建设资金、工程进度、投产条件、融资保障和投产后运营资金。${factorSummary}`
    : `${report.enterprise.name}本轮综合评分为 ${score(assessment.finalScore)} 分，风险等级为${assessment.riskTier?.name || "当前分档"}。${legacyV7 ? tierSummaryLegacy(assessment.riskTier?.tierId) : tierSummary(assessment.riskTier?.tierId)}。${riskList ? `潜在风险重点包括：${riskList}。` : "本轮未形成单独的指标弱项标签。"}${factorSummary}${managementEscalation ? `同时，${managementEscalation.factors.join("、")}被识别为优先管理信号，请先核实相关事实。` : ""}`;
  const alertRoutingGuidance = tierId && tierId !== "GREEN"
    ? `本轮${assessment.riskTier?.name || "亮灯"}已按亮灯形成一条预警行动；集团债务风险管理人员核对本报告后从驾驶舱提交，系统直接送达对应成员单位债务风险接口人确认，接口人确认后再分办本单位负责人。`
    : "本轮为绿灯，保持常态监测，不形成预警行动或负责人待办。";
  const guidance = legacyV7
    ? underConstruction
      ? "先核对未来三个月建设支付、融资提款、股东支持和投产后首期运营资金；输入或模型变化后创建新运行，不覆盖历史报告。"
      : `${tierSummaryLegacy(assessment.riskTier?.tierId)}。建议先核对${riskList || "本轮最低关注项"}${factorTopics.length ? `及${factorTopics.join("、")}` : ""}，形成责任人、完成时点和量化证据；确需处置时由风险管理人员从驾驶舱提交行动申请。`
    : underConstruction
      ? `先核对未来三个月建设支付、融资提款、股东支持和投产后首期运营资金；${alertRoutingGuidance}输入或模型变化后创建新运行，不覆盖历史报告。`
      : `${tierSummary(assessment.riskTier?.tierId)}。建议先核对${riskList || "本轮最低关注项"}${factorTopics.length ? `及${factorTopics.join("、")}` : ""}，形成责任人、完成时点和量化证据；${alertRoutingGuidance}`;
  const plan = clone(report.threeMonthActionPlan || []);
  if (plan.length === 3) {
    plan[0].objective = underConstruction ? "锁定建设资金与工程节点" : `核实${riskList || "本轮最低关注项"}`;
    plan[0].actions = underConstruction
      ? "核实施工进度、未付工程款、已落实融资、尚需资金和未来三个月支付节点，形成建设资金缺口及责任清单。"
      : `围绕${riskList || "本轮最低关注项"}${factorTopics.length ? `和${factorTopics.join("、")}` : ""}核实数据口径、形成原因、持续时间和责任环节。`;
    plan[1].objective = underConstruction ? "核对投产条件与资金计划兑现" : "跟踪风险缓释与资金安排";
    plan[1].actions = underConstruction
      ? "对照工程节点检查资金拨付、授信提款、股东支持和成本偏差，评估延期或超概算对债务偿付的影响。"
      : "按月核对回款、盈利、成本、授信和资金余缺变化，记录已完成措施、剩余缺口和证据位置。";
    plan[2].objective = "复评风险是否回落并形成新运行";
    plan[2].actions = "使用新的输入或 Published 模型创建新的 scenarioRunId 重跑，对比评分、风险分档和触发类型；历史报告、行动申请和待办保持原身份只读。";
  }
  report.schemaVersion = CONTENT_SCHEMA_VERSION;
  report.reportVersion = options.reportVersion || SERVICE_VERSION;
  report.contentVersion = options.contentVersion || SERVICE_VERSION;
  report.artifactVersion = options.artifactVersion || "html-print-capability-v7";
  report.conclusion = conclusion;
  report.managementEscalation = managementEscalation;
  report.keyRiskDiagnosis = {
    ...(report.keyRiskDiagnosis || {}),
    indicatorItems,
    factorItems,
    negativeFactorCount: negativeFactors.length,
    defaultedZeroCount: Number(report.factorStateSummary?.DEFAULTED_ZERO || 0),
    notApplicableCount: Number(report.factorStateSummary?.NOT_APPLICABLE || 0)
  };
  report.riskProfile = {
    overall: legacyV7 ? tierSummaryLegacy(assessment.riskTier?.tierId) : tierSummary(assessment.riskTier?.tierId),
    potentialRisks,
    managementPriority: factorTopics.length ? factorTopics : indicatorTopics,
    note: "潜在风险为本轮评分最低项和人工调节因子形成的核查重点，不等同于已确认违约事实。"
  };
  report.responseStrategy = {
    ...(report.responseStrategy || {}),
    headline: tierHeadline(assessment.riskTier?.tierId, underConstruction ? ["建设资金与投产条件"] : (indicatorTopics.length ? indicatorTopics : factorTopics)),
    guidance,
    ...(legacyV7 ? {} : {
      managementPortfolios: (report.responseStrategy?.managementPortfolios || []).map((portfolio) => ({
        ...portfolio,
        actions: (portfolio.actions || []).map((action) => String(action).includes("重大变化通过驾驶舱提交标准行动申请")
          ? alertRoutingGuidance
          : normalizeSentence(action))
      }))
    }),
    createsActionRequest: false
  };
  report.threeMonthActionPlan = plan;
  report.ruleExplanations = (report.ruleExplanations || []).map((rule) => ({
    ...rule,
    statement: normalizeSentence(rule.statement)
  }));
  return deepFreeze(report);
}

function renderReportHtml(report, expectedSchemaVersion = CONTENT_SCHEMA_VERSION) {
  let html = baseService.renderReportHtml(report, expectedSchemaVersion);
  return html.replaceAll("评分分档与重大因子管理信号分开判断", "评分结果与管理信号分别呈现");
}

function createReportService(input, options = {}) {
  const source = baseService.createReportService(input, {
    ...options,
    contentSchemaVersion: CONTENT_SCHEMA_VERSION,
    reportVersion: options.reportVersion || SERVICE_VERSION,
    contentVersion: options.contentVersion || SERVICE_VERSION,
    artifactVersion: options.artifactVersion || "html-print-capability-v7"
  });
  const cache = new Map();
  function getReport(enterpriseId) {
    if (!cache.has(enterpriseId)) cache.set(enterpriseId, upgradeReport(source.getReport(enterpriseId), options));
    return cache.get(enterpriseId);
  }
  return deepFreeze({
    serviceVersion: options.serviceVersion || SERVICE_VERSION,
    moduleId: "M06",
    readOnly: true,
    scenarioIdentity: source.scenarioIdentity,
    prototypeVersion: source.prototypeVersion,
    getReport,
    listReports() { return deepFreeze(source.listReports().map((item) => getReport(item.enterprise.enterpriseId))); },
    renderHtml(enterpriseId) { return renderReportHtml(getReport(enterpriseId), options.contentSchemaVersion || CONTENT_SCHEMA_VERSION); }
  });
}

module.exports = Object.freeze({ SERVICE_VERSION, CONTENT_SCHEMA_VERSION, createReportService, upgradeReport, renderReportHtml });
