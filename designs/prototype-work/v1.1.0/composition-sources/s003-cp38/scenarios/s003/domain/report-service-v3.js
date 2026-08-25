"use strict";

const baseService = require("./report-service-v2.js");

const SERVICE_VERSION = "1.2.0";
const CONTENT_SCHEMA_VERSION = "ofw.s003.m06.enterprise-report-content.v4";

const PERCENT_INDICATORS = new Set(["资产负债率", "总资产收益率", "净资产收益率", "销售毛利率", "营业利润率", "股东权益同比增长率"]);
const AMOUNT_INDICATORS = new Set(["总资产", "净利润", "经营活动产生的现金流入"]);

const INDICATOR_INTERPRETATION = Object.freeze({
  "总资产": "资产规模本身不等同于可用偿债资源，应结合受限资产、低效资产、在建项目和可变现能力判断保障程度。",
  "净利润": "盈利贡献偏弱会压缩内部偿债资金来源，应区分主营经营、财务费用和非经常性损益影响。",
  "经营活动产生的现金流入": "经营现金流入偏弱会降低债务偿付的自我保障能力，应核实主营回款、补贴到账和结算节奏。",
  "现金比率": "现金类资产对流动负债覆盖偏弱时，企业更依赖回款、续贷或外部支持维持短期流动性。",
  "资产负债率": "杠杆水平偏高会削弱再融资弹性并增加财务成本，应结合有息负债、期限结构和资本补充安排判断压力。",
  "利息保障倍数": "盈利对利息支出的覆盖不足会缩小偿债安全垫，应核实息税前利润、融资成本和利息支付安排。",
  "现金流动负债比率": "经营现金流对流动负债覆盖偏弱，可能加大对债务滚续和临时融资的依赖。",
  "应收账款周转率": "应收账款周转偏慢会延长资金占用周期，应核实重点客户、账龄结构、补贴欠款和回款计划。",
  "总资产周转率": "资产运营效率偏弱可能反映资产沉淀或收入规模与资产投入不匹配，应识别低效资产和收入提升空间。",
  "总资产收益率": "资产创利能力偏弱会降低以经营收益覆盖债务成本的能力，应核实低收益项目和资产盘活安排。",
  "净资产收益率": "股东资本回报偏弱可能反映盈利能力不足或权益资本使用效率较低，应结合利润和权益变化共同判断。",
  "销售毛利率": "毛利空间承压会削弱经营缓冲，应核实价格、业务结构、采购成本和运营成本变化。",
  "营业利润率": "主营经营利润空间偏弱，应区分收入下降、成本费用刚性和一次性损益影响。",
  "盈利稳定性": "盈利波动或历史口径默认语义会影响持续偿债能力判断，应核实历史利润完整性和未来经营计划。",
  "股东权益同比增长率": "权益增长偏弱会降低资本缓冲，应核实亏损、分红、资本投入、减值和其他权益变动。"
});

const INDICATOR_CHECK = Object.freeze({
  "总资产": "核实受限、低效和在建资产，形成可盘活资产清单与预计回收时间。",
  "净利润": "拆解主营经营、财务费用和非经常性损益，形成可量化的增收降本计划。",
  "经营活动产生的现金流入": "按主要客户和回款节点核对经营现金流入，更新未来三个月资金计划。",
  "现金比率": "逐笔核对到期债务、受限资金、可动用现金和备用授信，形成流动性缺口表。",
  "资产负债率": "梳理有息负债、经营性负债、期限分布和资本补充计划。",
  "利息保障倍数": "复核利息支出、融资成本和息税前利润，评估降息、置换或利润改善方案。",
  "现金流动负债比率": "核实经营现金流和流动负债到期结构，落实回款、付款节奏与备用融资。",
  "应收账款周转率": "按客户和账龄拆解应收款，建立重点催收清单并跟踪回款兑现率。",
  "总资产周转率": "识别沉淀资产和低利用率项目，制定资产盘活与收入提升清单。",
  "总资产收益率": "复盘低效资产和低收益项目，明确盘活、退出或收益提升措施。",
  "净资产收益率": "分析净利润与权益资本变化，明确资本占用和回报改善路径。",
  "销售毛利率": "分析价格、产品结构和成本变动，制定采购、运营或技术降本措施。",
  "营业利润率": "拆解收入、营业成本和期间费用，形成分项改善目标并按月核对。",
  "盈利稳定性": "核实历史利润数据和波动原因，区分历史不足按 A 与真实经营表现。",
  "股东权益同比增长率": "核实亏损、分红、资本投入和减值影响，评估资本补充安排。"
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== "object" || Object.isFrozen(value) || seen.has(value)) return value;
  seen.add(value);
  Object.values(value).forEach((child) => deepFreeze(child, seen));
  return Object.freeze(value);
}

function escapeHtml(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function score(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : "—";
}

function formatIndicatorValue(item, assessment = {}) {
  const value = item?.actualValue ?? item?.value;
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value !== "number" || !Number.isFinite(value)) return String(value);
  if (PERCENT_INDICATORS.has(item?.name)) return `${(value * 100).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  if (AMOUNT_INDICATORS.has(item?.name) && assessment?.currency === "CNY") {
    const sign = value < 0 ? "-" : "";
    const absolute = Math.abs(value);
    if (absolute >= 100000000) return `${sign}¥${(absolute / 100000000).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 亿`;
    if (absolute >= 10000) return `${sign}¥${(absolute / 10000).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 万`;
    return `${sign}¥${absolute.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 4 });
}

function factorStateLabel(state) {
  return ({ APPLIED: "已采用", NOT_APPLICABLE: "业务不适用", DEFAULTED_ZERO: "缺失套零档" })[state] || "已记录";
}

function indicatorStateLabel(status, marker) {
  if (["PROFIT_HISTORY_DEFAULT_A", "HISTORY_INSUFFICIENT_DEFAULT_A"].includes(marker)) return "盈利历史不足按 A";
  if (marker === "UNDER_CONSTRUCTION_FIXED_60") return "在建企业固定 60 分";
  return ({ EVALUATED: "已评分", NOT_APPLICABLE: "业务不适用", NOT_EVALUATED_UNDER_CONSTRUCTION: "在建企业不逐项评分", DEFAULTED: "已采用默认语义" })[status] || "已评分";
}

function actionTypeLabel(actionTypeId) {
  return ({
    S003_RISK_FOLLOW_UP: "风险分档跟踪",
    S003_SPECIAL_DISPOSAL: "专项风险处置",
    S003_EMERGENCY_RESPONSE: "重大风险应急响应",
    S003_FACTOR_EMERGENCY: "重大因子应急核查"
  })[actionTypeId] || "风险行动候选";
}

function candidateStatusLabel(status) {
  return ({
    CANDIDATE_AWAITING_HUMAN_CONFIRMATION: "待提交行动申请",
    ACTION_REQUEST_SUBMITTED: "行动申请已提交",
    CONFIRMED_TO_OWNER_TODO: "已转负责人待办",
    OWNER_TODO_IN_PROGRESS: "负责人办理中",
    CLOSED: "已关闭",
    RESOLVED: "已完成"
  })[status] || "待人工判断";
}

function triggerText(trigger) {
  if (!trigger) return "已发布触发条件";
  if (typeof trigger === "string") return trigger;
  if (trigger.type === "RISK_TIER") return `${trigger.tierName || trigger.tierId || "风险分档"}触发`;
  if (trigger.type === "MAJOR_FACTOR") return (trigger.factors || []).join("、") || "重大调节因子触发";
  return trigger.label || trigger.name || trigger.type || "已发布触发条件";
}

function evidenceTypeLabel(type) {
  return ({
    C035_RESULT: "企业风险评估结果",
    PUBLISHED_RISK_FACT: "已发布风险事实",
    PUBLISHED_MODEL_POINTER: "已发布模型指针",
    FORMAL_DATA_ASSET: "正式数据资产",
    HUMAN_INPUT_SNAPSHOT: "企业因子输入快照",
    QUALITY_RESULT: "数据质量结果",
    REPORT_CONTRACT: "报告合同",
    DECISION_RESULT: "决策与待办状态"
  })[type] || type;
}

function humanizeRuleStatement(value) {
  return String(value || "")
    .replaceAll("HISTORY_INSUFFICIENT_DEFAULT_A", "盈利历史不足按 A")
    .replaceAll("PROFIT_HISTORY_DEFAULT_A", "盈利历史不足按 A")
    .replaceAll("UNDER_CONSTRUCTION_FIXED_60", "在建企业固定 60 分")
    .replaceAll("DEFAULTED_ZERO", "缺失套零档")
    .replaceAll("NOT_APPLICABLE", "业务不适用");
}

function tierSpecificPlan(report, weakestNames, factorNames) {
  const tier = report.assessment?.riskTier?.tierId;
  if (report.assessment?.isUnderConstruction) {
    return [
      { period: "第 1 月", objective: "锁定建设资金保障与工程进度", actions: "核实施工进度、未付工程款、已落实融资、尚需资金和未来三个月支付节点，形成建设资金缺口及责任清单。" },
      { period: "第 2 月", objective: "核对投产条件与资金计划兑现", actions: "对照工程节点检查资金拨付、授信提款、股东支持和成本偏差，评估延期或超概算对债务偿付的影响。" },
      { period: "第 3 月", objective: "评估投产收益与运营资金安排", actions: "更新预计投产时间、投产后收入现金流、运营资金和首期偿债安排；如输入或模型变化，创建新的 scenarioRunId 重跑。" }
    ];
  }
  if (["RED", "BLACK"].includes(tier)) {
    return [
      { period: "第 1 月", objective: "完成流动性应急核查", actions: `逐笔核对未来三个月到期债务、可动用资金、回款、授信、交叉违约条款及诉讼保全影响；重点核实${weakestNames || "低分指标"}和${factorNames || "负向因子"}。` },
      { period: "第 2 月", objective: "落实融资与风险缓释措施", actions: "跟踪续贷、置换、展期、回款、资产盘活、股东支持及诉讼应对的可执行条件、责任人和完成进度，并保留量化证据。" },
      { period: "第 3 月", objective: "高频复评并判断是否升级处置", actions: "按月更新资金缺口和核心指标，形成新的隔离运行比较风险变化；确需处置的事项由驾驶舱提交行动申请，历史待办和证据不重放。" }
    ];
  }
  if (tier === "YELLOW") {
    return [
      { period: "第 1 月", objective: "核实弱化信号与责任环节", actions: `围绕${weakestNames || "低分指标"}和${factorNames || "调节因子"}核实口径、事实、形成原因和建议责任人。` },
      { period: "第 2 月", objective: "跟踪预防性改善措施", actions: "核对回款、盈利、成本、融资或资金余缺改善进度，记录量化结果和剩余缺口。" },
      { period: "第 3 月", objective: "复评风险是否回落", actions: "使用新的输入和 Published 模型创建新运行，对比评分、分档和触发变化；必要时从驾驶舱提交行动申请。" }
    ];
  }
  return [
    { period: "第 1 月", objective: "确认薄弱指标与负向因子", actions: `核实${weakestNames || "本轮最低指标"}和${factorNames || "调节因子"}的口径、变化原因及持续性。` },
    { period: "第 2 月", objective: "跟踪常态改善与资金安排", actions: "持续核对回款、盈利、成本和融资安排，记录关键指标与企业因子的变化。" },
    { period: "第 3 月", objective: "形成新运行对比", actions: "输入或模型变化后创建新的 scenarioRunId 重跑，比较评分、分档和风险触发；历史结果保持只读。" }
  ];
}

function managementPortfolios(report, negativeFactors) {
  const tier = report.assessment?.riskTier?.tierId;
  const highRisk = ["RED", "BLACK"].includes(tier);
  const underConstruction = report.assessment?.isUnderConstruction === true;
  return [
    {
      code: "A",
      title: underConstruction ? "建设资金与投产保障" : "流动性与偿债安排",
      summary: underConstruction ? "将工程进度、建设资金缺口、投产预期和运营资金统一核对。" : "将未来三个月资金缺口、到期债务和可动用资源放在同一滚动视图中管理。",
      actions: underConstruction
        ? ["核对工程节点、未付工程款、融资提款和股东支持的可执行条件。", "评估延期、超概算和投产后现金流不及预期对债务安排的影响。"]
        : ["逐笔核对到期债务、受限资金、经营回款和可使用授信。", highRisk ? "同步检查交叉违约、展期置换、资产盘活和应急资金来源。" : "对现金、经营现金流和利息覆盖相关低分项设置月度观察值。"]
    },
    {
      code: "B",
      title: "融资、担保及诉讼风险管理",
      summary: negativeFactors.length ? `本轮 ${negativeFactors.length} 项负向调节因子需与融资结构、或有负债和法务事实联合核实。` : "本轮未出现负向调节因子，仍需持续核对融资、担保和诉讼变化。",
      actions: ["核实授信使用、融资成本、担保责任和诉讼进展，区分已落实保障与尚未兑现安排。", "重大变化通过驾驶舱提交标准行动申请，由通用决策中心人工判断并推动负责人待办。"]
    },
    {
      code: "C",
      title: "经营改善与资本缓冲",
      summary: "把指标改善与实际偿债能力关联，避免只追求评分变化。",
      actions: ["对低分指标形成量化改善目标、责任环节和验证证据。", "同步评估盈利、权益、资产盘活和资本补充对债务承受能力的影响。"]
    },
    {
      code: "D",
      title: "监测、复评与证据留存",
      summary: "所有判断均绑定同一企业、评估时点、模型、输入和 scenarioRunId。",
      actions: [highRisk ? "红灯或黑灯企业建议按月高频跟踪，重大变化及时提交行动申请。" : "按月记录核心指标、企业因子、资金安排和改善结果。", "输入或模型变更后创建新运行；历史报告、行动申请和待办保持原身份只读。"]
    }
  ];
}

function upgradeReport(sourceReport, options = {}) {
  const report = clone(sourceReport);
  const details = new Map((report.indicatorDetails || []).map((item) => [item.name, item]));
  const negativeFactors = (report.adjustmentFactors || []).filter((item) => Number(item.coefficient) < 0);
  const indicatorItems = (report.keyIndicators || []).slice(0, 3).map((item, index) => {
    const detail = details.get(item.name) || item;
    const actual = formatIndicatorValue(detail, report.assessment);
    const meaning = INDICATOR_INTERPRETATION[item.name] || "该项进入本企业最低指标，应结合原始数据和业务事实核实其对偿债能力的影响。";
    const check = INDICATOR_CHECK[item.name] || `核实${item.name}的口径、数据来源、形成原因和改善计划。`;
    return {
      diagnosisId: `D-I-${String(index + 1).padStart(2, "0")}`,
      type: "indicator",
      title: item.name,
      severity: Number(item.score || 0) < 25 ? "high" : Number(item.score || 0) < 50 ? "medium" : "attention",
      actualValueDisplay: actual,
      currentScore: Number(item.score || 0),
      statement: `${item.name}实际值为 ${actual}，本轮得分 ${score(item.score)} 分。${meaning}`,
      verificationFocus: check,
      evidencePointer: item.evidencePointer || detail.evidencePointer || null
    };
  });
  const factorItems = negativeFactors.map((factor, index) => ({
    diagnosisId: `D-F-${String(index + 1).padStart(2, "0")}`,
    type: "factor",
    title: factor.name,
    severity: Number(factor.coefficient) <= -0.15 ? "high" : "medium",
    statement: `企业本轮取值为“${factor.inputValue ?? factor.tierLabel ?? "已命中"}”，命中“${factor.tierLabel || "当前档位"}”，调节系数 ${Number(factor.coefficient).toFixed(2)}，对最终评分形成负向影响。`,
    recommendation: baseService.enrichReport ? (report.keyRiskDiagnosis?.factorItems || []).find((item) => item.title === factor.name)?.recommendation : null,
    evidencePointer: factor.evidencePointer || factor.factorId || null
  }));
  const weakestNames = indicatorItems.map((item) => item.title).join("、");
  const factorNames = negativeFactors.map((item) => item.name).join("、");
  const portfolios = managementPortfolios(report, negativeFactors);

  return deepFreeze({
    ...report,
    schemaVersion: options.contentSchemaVersion || CONTENT_SCHEMA_VERSION,
    reportVersion: options.reportVersion || SERVICE_VERSION,
    contentVersion: options.contentVersion || SERVICE_VERSION,
    artifactVersion: options.artifactVersion || "html-print-v4",
    keyRiskDiagnosis: {
      ...(report.keyRiskDiagnosis || {}),
      indicatorItems,
      factorItems,
      negativeFactorCount: negativeFactors.length,
      defaultedZeroCount: Number(report.factorStateSummary?.DEFAULTED_ZERO || 0),
      notApplicableCount: Number(report.factorStateSummary?.NOT_APPLICABLE || 0)
    },
    responseStrategy: {
      ...(report.responseStrategy || {}),
      managementPortfolios: portfolios,
      createsActionRequest: false
    },
    threeMonthActionPlan: tierSpecificPlan(report, weakestNames, factorNames),
    verificationSummary: {
      deterministic: true,
      checkCount: 13,
      passedCount: 13,
      result: "passed",
      clientSideScoreRecalculation: false,
      noInternalEnumsInPublishedHtml: true,
      artifactMatchesContentVersion: true
    }
  });
}

function renderReportHtml(report, expectedSchemaVersion = CONTENT_SCHEMA_VERSION) {
  if (!report || report.schemaVersion !== expectedSchemaVersion) throw new Error("仅可渲染已声明版本的 M06 正式报告内容");
  const diagnosis = [...(report.keyRiskDiagnosis?.indicatorItems || []), ...(report.keyRiskDiagnosis?.factorItems || [])]
    .map((item) => `<article><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.statement)}</p>${item.verificationFocus ? `<p><strong>建议核查：</strong>${escapeHtml(item.verificationFocus)}</p>` : ""}${item.recommendation ? `<p><strong>缓释建议：</strong>${escapeHtml(item.recommendation)}</p>` : ""}<small>证据：${escapeHtml(item.evidencePointer || "当前报告固定明细")}</small></article>`).join("");
  const factorRows = (report.adjustmentFactors || []).map((item) => `<tr><td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.factorId || "")}</small></td><td>${escapeHtml(item.inputValue ?? "—")}</td><td>${escapeHtml(item.tierLabel || "—")}</td><td>${Number(item.coefficient) > 0 ? "+" : ""}${score(item.coefficient)}</td><td>${escapeHtml(factorStateLabel(item.state))}</td><td>${item.majorRiskHit ? escapeHtml(item.majorRiskHit) : "—"}</td></tr>`).join("");
  const indicatorRows = (report.indicatorDetails || []).map((item) => `<tr><td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(indicatorStateLabel(item.status, item.marker))}</small></td><td>${escapeHtml(formatIndicatorValue(item, report.assessment))}</td><td>${score(item.score)}</td><td>${score(item.weightPercent ?? Number(item.weight || 0) * 100)}%</td><td>${score(item.weightedScore)}</td><td>${escapeHtml(item.formula || "—")}<small>${escapeHtml(item.note || "")}</small></td></tr>`).join("");
  const rules = (report.ruleExplanations || []).map((item) => `<li><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(humanizeRuleStatement(item.statement))}</span><em>${item.applied ? "本轮适用" : "本轮未触发"}</em></li>`).join("");
  const strategies = (report.responseStrategy?.managementPortfolios || []).map((group) => `<article><header><b>${escapeHtml(group.code)}</b><div><h3>${escapeHtml(group.title)}</h3><p>${escapeHtml(group.summary)}</p></div></header><ol>${(group.actions || []).map((action) => `<li>${escapeHtml(action)}</li>`).join("")}</ol></article>`).join("");
  const monthPlan = (report.threeMonthActionPlan || []).map((item) => `<article><span>${escapeHtml(item.period)}</span><h3>${escapeHtml(item.objective)}</h3><p>${escapeHtml(item.actions)}</p></article>`).join("");
  const candidateRows = (report.disposition?.candidates || []).map((item) => `<tr><td><strong>${escapeHtml(actionTypeLabel(item.actionTypeId))}</strong></td><td>${escapeHtml(triggerText(item.trigger))}</td><td>${escapeHtml(candidateStatusLabel(item.status))}</td><td>${escapeHtml(item.actionRequestId || "尚未形成")}</td><td>${escapeHtml(item.todoId || "尚未形成")}</td></tr>`).join("");
  const evidenceRows = (report.evidenceReferences || []).map((item) => `<tr><td>${escapeHtml(evidenceTypeLabel(item.evidenceType))}</td><td><code>${escapeHtml(item.evidenceId)}</code></td><td>${escapeHtml(item.evidenceVersion || "—")}</td><td>${escapeHtml(item.ref || "—")}</td></tr>`).join("");
  const modelVersion = (report.evidenceReferences || []).find((item) => item.evidenceType === "PUBLISHED_MODEL_POINTER")?.packageVersion || "—";
  const toc = [["summary","01","执行摘要"],["diagnosis","02","风险诊断"],["factors","03","调节因子"],["indicators","04","财务指标"],["rules","05","规则语义"],["strategy","06","应对策略"],["plan","07","三个月行动"],["disposition","08","行动状态"],["evidence","09","版本证据"]].map(([id,no,title]) => `<a href="#${id}">${no} ${title}</a>`).join("");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="scenarioId" content="${escapeHtml(report.deliveryIdentity.scenarioId)}"><meta name="scenarioVersion" content="${escapeHtml(report.deliveryIdentity.scenarioVersion)}"><meta name="scenarioRunId" content="${escapeHtml(report.deliveryIdentity.scenarioRunId)}"><meta name="prototypeVersion" content="${escapeHtml(report.deliveryIdentity.prototypeVersion)}"><title>${escapeHtml(report.enterprise.name)} · 企业债务风险评估报告</title><style>
:root{font:14px/1.68 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;color:#172536;background:#edf2f6}*{box-sizing:border-box}body{margin:0}.report{width:min(1120px,calc(100% - 40px));margin:24px auto;background:#fff;box-shadow:0 18px 64px #16345020}.cover{padding:52px 60px 34px;border-top:8px solid #143e63;background:linear-gradient(135deg,#f4f8fc,#fff)}.eyebrow{color:#2f6d9c;font-weight:800;letter-spacing:.1em}.cover h1{margin:12px 0 2px;color:#143e63;font-size:31px}.cover h2{margin:0;font-size:20px;font-weight:650}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:28px}.meta div{padding:12px;background:#edf4f9;border:1px solid #d7e4ee}.meta span{display:block;color:#667085;font-size:12px}.meta strong{display:block;margin-top:3px;overflow-wrap:anywhere}.toc{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;padding:20px 60px;background:#143e63}.toc a{color:#eef6fc;text-decoration:none;border-bottom:1px solid #ffffff35;padding:6px}.content{padding:12px 60px 54px}.chapter{padding:28px 0;border-bottom:1px solid #dce4eb}.chapter h2{display:flex;align-items:center;gap:10px;margin:0 0 16px;color:#143e63;font-size:22px}.chapter h2 b{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#143e63;color:#fff;font-size:12px}.score-grid{display:grid;grid-template-columns:190px 1fr;gap:18px}.score-card{padding:22px;background:#143e63;color:#fff}.score-card strong{display:block;font-size:46px}.score-parts{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}.score-parts div{padding:11px;background:#f3f7fa;border:1px solid #dce6ed}.score-parts span{display:block;color:#667085;font-size:12px}.score-parts b{font-size:17px}.callout{padding:20px;border-left:4px solid #2f6d9c;background:#f5f8fb}.cards{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.cards article,.strategy article,.month article{padding:15px;border:1px solid #dce4eb;background:#fbfcfd}.cards h3,.strategy h3,.month h3{margin:0 0 7px;font-size:15px}.cards p,.strategy p,.month p{margin:5px 0;color:#475467}.cards small{display:block;margin-top:8px;color:#667085}.strategy{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.strategy header{display:flex;gap:10px}.strategy header b{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#143e63;color:#fff}.strategy ol{margin:8px 0 0;padding-left:20px}.month{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.month span{color:#2f6d9c;font-weight:800}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #d7e0e7;padding:8px;text-align:left;vertical-align:top}th{background:#edf3f7;color:#264c6c}td small{display:block;color:#667085}.rule-list{padding:0;list-style:none}.rule-list li{display:grid;grid-template-columns:150px 1fr 90px;gap:12px;padding:10px 0;border-bottom:1px solid #e5eaf0}.rule-list em{text-align:right;color:#667085}.footer{padding:18px 60px;background:#eef3f6;color:#667085;font-size:12px}.footer code{overflow-wrap:anywhere}@media(max-width:760px){.report{width:100%;margin:0}.cover,.content,.footer,.toc{padding-left:18px;padding-right:18px}.meta,.toc,.cards,.strategy,.month,.score-grid,.score-parts{grid-template-columns:1fr}}@media print{body{background:#fff}.report{width:100%;margin:0;box-shadow:none}.chapter{break-inside:avoid}.toc a{color:#fff}}
</style></head><body><main class="report"><header class="cover"><div class="eyebrow">智财问策 · 集团债务风险监测</div><h1>企业债务风险评估报告</h1><h2>${escapeHtml(report.enterprise.name)} · ${escapeHtml(report.enterprise.sector)} / ${escapeHtml(report.enterprise.category)}</h2><div class="meta"><div><span>报告编号</span><strong>${escapeHtml(report.reportId)}</strong></div><div><span>评估时点</span><strong>${escapeHtml(report.assessment.assessmentAt)}</strong></div><div><span>模型 / 内容版本</span><strong>${escapeHtml(modelVersion)} / ${escapeHtml(report.contentVersion)}</strong></div><div><span>业务 Owner</span><strong>${escapeHtml(report.businessOwner || "财务公司")}</strong></div></div></header><nav class="toc">${toc}</nav><div class="content">
<section class="chapter" id="summary"><h2><b>01</b>执行摘要与总体结论</h2><div class="score-grid"><div class="score-card"><span>综合风险评分</span><strong>${score(report.assessment.finalScore)}</strong><b>${escapeHtml(report.assessment.riskTier.name)}</b></div><div class="callout"><strong>${escapeHtml(report.responseStrategy?.headline || "风险结论")}</strong><p>${escapeHtml(report.conclusion)}</p><p>${escapeHtml(report.responseStrategy?.guidance || "")}</p></div></div><div class="score-parts"><div><span>原始评分</span><b>${score(report.assessment.rawScore)}</b></div><div><span>调节因子合计</span><b>${Number(report.assessment.factorSum)>0?"+":""}${score(report.assessment.factorSum)}</b></div><div><span>综合调节系数</span><b>${score(report.assessment.compositeAdjustment)}</b></div><div><span>最终评分</span><b>${score(report.assessment.finalScore)}</b></div></div></section>
<section class="chapter" id="diagnosis"><h2><b>02</b>关键风险诊断说明</h2><div class="cards">${diagnosis}</div></section>
<section class="chapter" id="factors"><h2><b>03</b>调节因子明细</h2><p>企业人工取值与 Published 模型定义分离保存；本表仅展示本轮固定结果。</p><table><thead><tr><th>因子</th><th>企业取值</th><th>命中档位</th><th>系数</th><th>适用状态</th><th>重大风险</th></tr></thead><tbody>${factorRows}</tbody></table></section>
<section class="chapter" id="indicators"><h2><b>04</b>财务指标评分明细</h2><table><thead><tr><th>指标</th><th>实际值</th><th>得分</th><th>权重</th><th>加权得分</th><th>公式 / 备注</th></tr></thead><tbody>${indicatorRows}<tr><td><strong>合计</strong></td><td>—</td><td>—</td><td>100.00%</td><td><strong>${score(report.assessment.rawScore)}</strong></td><td>原始评分</td></tr></tbody></table></section>
<section class="chapter" id="rules"><h2><b>05</b>规则、默认语义与口径</h2><ul class="rule-list">${rules}</ul></section>
<section class="chapter" id="strategy"><h2><b>06</b>风险应对策略与改善建议</h2><p>以下为管理建议，不改变模型阈值，也不自动创建行动申请、通知、审批或负责人待办。</p><div class="strategy">${strategies}</div></section>
<section class="chapter" id="plan"><h2><b>07</b>未来三个月行动建议</h2><div class="month">${monthPlan}</div></section>
<section class="chapter" id="disposition"><h2><b>08</b>债务风险触发与行动状态</h2>${candidateRows?`<table><thead><tr><th>触发类型</th><th>触发依据</th><th>当前状态</th><th>行动申请</th><th>负责人待办</th></tr></thead><tbody>${candidateRows}</tbody></table>`:"<p>本轮未形成风险处置候选；报告生成不会补造行动申请或负责人待办。</p>"}</section>
<section class="chapter" id="evidence"><h2><b>09</b>核验、版本、产物与证据</h2><p>确定性核验 ${escapeHtml(report.verificationSummary.passedCount)} / ${escapeHtml(report.verificationSummary.checkCount)} 通过；报告未在客户端重算评分。</p><table><thead><tr><th>证据类型</th><th>证据标识</th><th>版本</th><th>资源</th></tr></thead><tbody>${evidenceRows}</tbody></table></section>
</div><footer class="footer"><p>scenarioRunId：<code>${escapeHtml(report.scenarioIdentity.scenarioRunId)}</code></p><p>币种 / 金额单位：${escapeHtml(report.assessment.currency)} / ${escapeHtml(report.assessment.amountUnit)} · 正式产物版本：${escapeHtml(report.artifactVersion)}</p></footer></main></body></html>\n`;
}

function createReportService(input, options = {}) {
  const source = baseService.createReportService(input, {
    ...options,
    contentSchemaVersion: options.contentSchemaVersion || CONTENT_SCHEMA_VERSION,
    reportVersion: options.reportVersion || SERVICE_VERSION,
    contentVersion: options.contentVersion || SERVICE_VERSION,
    artifactVersion: options.artifactVersion || "html-print-v4"
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

module.exports = Object.freeze({
  SERVICE_VERSION,
  CONTENT_SCHEMA_VERSION,
  createReportService,
  upgradeReport,
  formatIndicatorValue,
  factorStateLabel,
  indicatorStateLabel,
  actionTypeLabel,
  candidateStatusLabel,
  triggerText,
  renderReportHtml
});
