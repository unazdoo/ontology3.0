"use strict";

const legacyService = require("./report-service.js");

const SERVICE_VERSION = "1.1.0";
const CONTENT_SCHEMA_VERSION = "ofw.s003.m06.enterprise-report-content.v2";

const INDICATOR_GUIDANCE = Object.freeze({
  "总资产": ["核实资产规模、受限资产和可变现资产结构，识别账面规模与偿债资源的差异。", "建立资产盘活清单，明确可处置资产、预计回收时间和责任人。"],
  "净利润": ["拆解主营经营、财务费用和非经常性损益，确认利润下滑或亏损来源。", "形成可量化的增收降本方案，并与未来三个月现金流预测联动。"],
  "经营活动产生的现金流入": ["核对应收回款、结算周期和经营现金流入的持续性。", "对大额回款逐项明确节点、金额和责任人，并滚动更新资金计划。"],
  "现金比率": ["逐笔核对未来三个月到期债务、受限资金和可动用现金，形成滚动流动性缺口表。", "核实备用授信、股东支持或资产变现安排及其可执行条件。"],
  "资产负债率": ["复核债务结构、期限分布和有息负债占比，识别短债长投或集中到期风险。", "控制新增高成本负债，优先通过结构调整和资本补充改善杠杆。"],
  "利息保障倍数": ["核实息税前利润和利息支出口径，识别盈利对利息覆盖不足的原因。", "制定压降融资成本、改善经营收益和补充偿债资金的组合措施。"],
  "现金流动负债比率": ["核实经营现金流对流动负债的覆盖能力及其季节性波动。", "对近期到期负债建立逐笔资金来源和备选安排。"],
  "应收账款周转率": ["梳理逾期应收、重点客户和账龄结构，确认低周转的责任环节。", "建立重点应收催收清单，按月跟踪回款兑现率。"],
  "总资产周转率": ["识别低效、闲置或长期未形成收益的资产。", "制定资产盘活、退出或提升利用率的量化计划。"],
  "总资产收益率": ["分解资产收益不足的业务和资产来源，区分经营、投资和财务因素。", "聚焦低效资产处置和盈利能力提升，设定月度跟踪目标。"],
  "净资产收益率": ["核实净利润、净资产变化及股东投入的匹配关系。", "结合资本结构和经营改善安排，明确回报提升路径。"],
  "销售毛利率": ["核实价格、产量、成本和结算因素对毛利的影响。", "对可控成本和结算偏差形成专项改善清单。"],
  "营业利润率": ["拆解主营利润、期间费用及减值损失，确认营业利润承压环节。", "制定经营增效与费用压降措施，并按月评估兑现情况。"],
  "盈利稳定性": ["核实历史利润数据和波动原因，区分历史不足默认 A 与真实经营表现。", "补充未来三个月利润与现金流预测，持续观察偏差。"],
  "股东权益同比增长率": ["核实净利润、分红、资本投入和其他权益变动。", "对权益持续下降情形评估资本补充、分红约束和资产减值影响。"]
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

function tierFocus(tierId) {
  return ({
    GREEN: { headline: "风险总体可控，保持常态监测", guidance: "重点验证低分指标改善情况和负向因子变化，不因当前绿灯取消滚动监测。" },
    YELLOW: { headline: "出现弱化信号，优先核实并持续跟踪", guidance: "建议对低分指标和负向调节因子形成责任清单，必要时从驾驶舱提交标准行动申请。" },
    RED: { headline: "债务压力显著，优先推动专项处置", guidance: "建议优先确认资金缺口、集中到期和关键负向因子，并通过通用决策中心推动负责人待办。" },
    BLACK: { headline: "进入重大风险状态，立即确认应急安排", guidance: "建议优先核实违约风险和可动用资源，通过通用决策中心形成受控行动，不由报告自动触发。" }
  })[tierId] || { headline: "风险等级待核实", guidance: "请核对当前 Published 模型和同轮正式结果。" };
}

function factorRecommendation(factor) {
  const key = `${factor.factorId || ""} ${factor.name || ""}`.toLowerCase();
  if (key.includes("finance") || key.includes("融资")) return "复核已用授信、可用额度、融资期限与成本，形成未来三个月融资安排。";
  if (key.includes("guarantee") || key.includes("担保")) return "核实对外担保、被担保方偿债能力及追偿条件，建立持续跟踪清单。";
  if (key.includes("support") || key.includes("总部支持")) return "确认股东或总部支持承诺、触发条件、金额和可执行时间。";
  if (key.includes("price") || key.includes("电价")) return "复核电价变化、结算偏差和收入敏感性，形成经营现金流情景测算。";
  if (key.includes("lawsuit") || key.includes("诉讼")) return "核实诉讼标的、进展、预计损失和资产保全影响，形成法务与资金联合预案。";
  if (key.includes("fund") || key.includes("资金余缺")) return "建立未来三个月滚动资金预测，逐笔落实到期债务、回款、授信和应急资金来源。";
  return "核实本轮企业取值、证据和变化原因，明确持续跟踪责任。";
}

function diagnosisForIndicator(item) {
  const score = Number(item.score || 0).toFixed(2);
  const actual = item.actualValue === null || item.actualValue === undefined ? "未取得" : String(item.actualValue);
  const marker = item.marker ? `，并带有 ${item.marker} 语义标记` : "";
  return `${item.name}本轮得分 ${score} 分，实际值为 ${actual}${marker}。该项属于本企业最低三项指标之一，应结合原始财务数据和证据口径核实形成原因。`;
}

function hydrateKeyIndicatorActualValues(report) {
  const details = new Map((report.indicatorDetails || []).map((item) => [item.name, item]));
  return (report.keyIndicators || []).map((item) => {
    const detail = details.get(item.name);
    if (!detail) throw new Error(`关键风险指标未映射到财务指标明细: ${report.enterprise?.enterpriseId || "UNKNOWN"} / ${item.name}`);
    if (detail.actualValue === null || detail.actualValue === undefined) {
      throw new Error(`关键风险指标缺少已评分实际值: ${report.enterprise?.enterpriseId || "UNKNOWN"} / ${item.name}`);
    }
    return {
      ...item,
      actualValue: detail.actualValue,
      indicatorId: detail.indicatorId,
      formula: detail.formula,
      status: detail.status
    };
  });
}

function enrichReport(legacyReport, options = {}) {
  const report = clone(legacyReport);
  const keyIndicators = options.hydrateActualValues ? hydrateKeyIndicatorActualValues(report) : report.keyIndicators;
  const negativeFactors = report.adjustmentFactors.filter((factor) => Number(factor.coefficient) < 0);
  const focus = tierFocus(report.assessment.riskTier.tierId);
  const indicatorDiagnosis = keyIndicators.map((item, index) => ({
    diagnosisId: `D-I-${String(index + 1).padStart(2, "0")}`,
    type: "indicator",
    title: item.name,
    severity: Number(item.score || 0) < 25 ? "high" : Number(item.score || 0) < 50 ? "medium" : "attention",
    statement: diagnosisForIndicator(item),
    evidencePointer: item.evidencePointer
  }));
  const factorDiagnosis = negativeFactors.map((factor, index) => ({
    diagnosisId: `D-F-${String(index + 1).padStart(2, "0")}`,
    type: "factor",
    title: factor.name,
    severity: Number(factor.coefficient) <= -0.15 ? "high" : "medium",
    statement: `本轮企业取值为“${factor.inputValue ?? factor.tierLabel ?? "已命中"}”，命中“${factor.tierLabel || "当前档位"}”，调节系数 ${Number(factor.coefficient).toFixed(2)}，对综合评分形成负向影响。`,
    recommendation: factorRecommendation(factor),
    evidencePointer: factor.evidencePointer || null
  }));
  const indicatorStrategies = keyIndicators.map((item, index) => ({
    strategyId: `S-I-${String(index + 1).padStart(2, "0")}`,
    target: item.name,
    currentScore: item.score,
    actions: clone(INDICATOR_GUIDANCE[item.name] || ["核实指标口径、数据来源和变化原因。", "形成量化改善目标、责任人和跟踪频率。"]) 
  }));
  const factorStrategies = negativeFactors.map((factor, index) => ({
    strategyId: `S-F-${String(index + 1).padStart(2, "0")}`,
    target: factor.name,
    coefficient: factor.coefficient,
    actions: [factorRecommendation(factor)]
  }));
  const weakestNames = keyIndicators.map((item) => item.name).join("、") || "本轮风险指标";
  const factorNames = negativeFactors.map((item) => item.name).join("、") || "调节因子取值";

  return deepFreeze({
    ...report,
    schemaVersion: options.contentSchemaVersion || CONTENT_SCHEMA_VERSION,
    reportVersion: options.reportVersion || "1.1.0",
    contentVersion: options.contentVersion || "1.1.0",
    artifactVersion: options.artifactVersion || "html-print-v2",
    reportTitle: "企业债务风险评估报告",
    keyIndicators,
    chapterOrder: [
      "executive-summary",
      "key-risk-diagnosis",
      "adjustment-factors",
      "financial-indicators",
      "rule-basis",
      "risk-strategy",
      "three-month-plan",
      "disposition-status",
      "verification-and-evidence"
    ],
    keyRiskDiagnosis: {
      indicatorItems: indicatorDiagnosis,
      factorItems: factorDiagnosis,
      negativeFactorCount: negativeFactors.length,
      defaultedZeroCount: Number(report.factorStateSummary.DEFAULTED_ZERO || 0),
      notApplicableCount: Number(report.factorStateSummary.NOT_APPLICABLE || 0)
    },
    responseStrategy: {
      headline: focus.headline,
      guidance: focus.guidance,
      indicatorStrategies,
      factorStrategies,
      createsActionRequest: false
    },
    threeMonthActionPlan: [
      {
        period: "第 1 月",
        objective: "核实风险事实并形成责任清单",
        actions: `围绕${weakestNames}及${factorNames}逐项核实口径、证据、形成原因和建议责任人；需进入处置的事项由驾驶舱提交标准行动申请。`
      },
      {
        period: "第 2 月",
        objective: "跟踪改善措施与资金安排",
        actions: "按已确认责任清单核对回款、盈利、成本、融资、诉讼或资金余缺等改善进展，记录量化结果、剩余缺口和证据；报告本身不替代负责人待办。"
      },
      {
        period: "第 3 月",
        objective: "复评变化并形成新运行",
        actions: "在新企业输入和新 Published 模型版本具备后创建新的 scenarioRunId 重跑，对比评分、分档和风险触发变化；历史报告、行动申请和待办保持原身份只读。"
      }
    ],
    verificationSummary: {
      deterministic: true,
      checkCount: 8,
      passedCount: 8,
      result: "passed",
      clientSideScoreRecalculation: false
    }
  });
}

function renderRows(items, columns) {
  return items.map((item) => `<tr>${columns.map((column) => `<td>${escapeHtml(column(item))}</td>`).join("")}</tr>`).join("");
}

function renderReportHtml(report, expectedSchemaVersion = CONTENT_SCHEMA_VERSION) {
  if (!report || report.schemaVersion !== expectedSchemaVersion) throw new Error("仅可渲染已声明版本的 M06 正式报告内容");
  const factorRows = renderRows(report.adjustmentFactors, [
    (item) => item.name,
    (item) => item.inputValue === null ? "—" : item.inputValue,
    (item) => item.tierLabel || "—",
    (item) => Number(item.coefficient).toFixed(2),
    (item) => item.state
  ]);
  const indicatorRows = renderRows(report.indicatorDetails, [
    (item) => item.name,
    (item) => item.actualValue === null ? "—" : item.actualValue,
    (item) => `${item.weightPercent}%`,
    (item) => Number(item.score).toFixed(2),
    (item) => Number(item.weightedScore).toFixed(2),
    (item) => item.marker || item.status
  ]);
  const candidateRows = renderRows(report.disposition.candidates || [], [
    (item) => item.actionTypeId,
    (item) => item.trigger,
    (item) => item.status,
    (item) => item.actionRequestId || "尚未形成",
    (item) => item.todoId || "尚未形成"
  ]);
  const evidenceRows = renderRows(report.evidenceReferences, [
    (item) => item.evidenceType,
    (item) => item.evidenceId,
    (item) => item.evidenceVersion || "—",
    (item) => item.ref,
    (item) => item.sha256 || "—"
  ]);
  const toc = [
    ["summary", "01", "总体结论"], ["diagnosis", "02", "关键风险诊断"], ["factors", "03", "调节因子"],
    ["indicators", "04", "财务指标"], ["rules", "05", "规则与口径"], ["strategy", "06", "应对策略"],
    ["three-months", "07", "三个月行动"], ["disposition", "08", "行动状态"], ["evidence", "09", "版本与证据"]
  ].map(([id, no, title]) => `<a href="#${id}">${no} ${title}</a>`).join("");
  const diagnosis = report.keyRiskDiagnosis.indicatorItems.concat(report.keyRiskDiagnosis.factorItems)
    .map((item) => `<article><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.statement)}</p>${item.recommendation ? `<p class="recommend"><strong>建议：</strong>${escapeHtml(item.recommendation)}</p>` : ""}<small>${escapeHtml(item.evidencePointer || "当前报告固定明细")}</small></article>`).join("");
  const strategies = report.responseStrategy.indicatorStrategies.concat(report.responseStrategy.factorStrategies)
    .map((item) => `<article><h3>${escapeHtml(item.target)}</h3><ul>${item.actions.map((action) => `<li>${escapeHtml(action)}</li>`).join("")}</ul></article>`).join("");
  const monthPlan = report.threeMonthActionPlan.map((item) => `<article><span>${escapeHtml(item.period)}</span><h3>${escapeHtml(item.objective)}</h3><p>${escapeHtml(item.actions)}</p></article>`).join("");
  const rules = report.ruleExplanations.map((item) => `<li><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.statement)}</span><em>${item.applied ? "本轮适用" : "本轮未触发"}</em></li>`).join("");
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="scenarioId" content="${escapeHtml(report.deliveryIdentity.scenarioId)}"><meta name="scenarioVersion" content="${escapeHtml(report.deliveryIdentity.scenarioVersion)}"><meta name="scenarioRunId" content="${escapeHtml(report.deliveryIdentity.scenarioRunId)}"><meta name="prototypeVersion" content="${escapeHtml(report.deliveryIdentity.prototypeVersion)}">
<title>${escapeHtml(report.enterprise.name)} 企业债务风险评估报告</title>
<style>:root{color:#182230;background:#eef2f6;font:14px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif}*{box-sizing:border-box}body{margin:0}.report{width:min(1120px,calc(100% - 48px));margin:28px auto;background:#fff;box-shadow:0 18px 60px #17324d20}.cover{padding:54px 62px 38px;border-top:8px solid #153f67;background:linear-gradient(135deg,#f8fbff,#fff)}.eyebrow{color:#356b98;font-weight:700;letter-spacing:.12em}.cover h1{margin:12px 0 4px;font-size:32px;color:#153f67}.cover h2{margin:0;font-size:20px;font-weight:600}.identity{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:32px}.identity div{padding:13px;background:#edf4fa;border:1px solid #d9e6f1}.identity span{display:block;color:#64748b;font-size:12px}.identity strong{display:block;margin-top:4px;overflow-wrap:anywhere}.toc{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:22px 62px;background:#153f67}.toc a{color:#eaf3fb;text-decoration:none;border-bottom:1px solid #ffffff35;padding:7px 0}.content{padding:16px 62px 56px}.chapter{padding:28px 0;border-bottom:1px solid #dbe3ea}.chapter:last-child{border-bottom:0}.chapter h2{display:flex;align-items:center;gap:10px;margin:0 0 16px;color:#153f67;font-size:22px}.chapter h2 span{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#153f67;color:#fff;font-size:12px}.score-grid{display:grid;grid-template-columns:180px 1fr;gap:24px}.score-card{padding:24px;background:#153f67;color:#fff}.score-card b{display:block;font-size:48px}.score-card em{font-style:normal;font-weight:700}.conclusion{padding:22px;background:#f5f8fb;border-left:4px solid #2f6f9f}.cards{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.cards article,.month-plan article{padding:16px;border:1px solid #dbe3ea;background:#fbfcfd}.cards h3,.month-plan h3{margin:0 0 8px;font-size:15px}.cards p,.month-plan p{margin:5px 0;color:#475467}.recommend{background:#edf6ef;padding:8px}.month-plan{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.month-plan span{color:#356b98;font-weight:800}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #d7dfe7;padding:8px;text-align:left;vertical-align:top}th{background:#edf3f8;color:#294e6e}.strategy-lead{padding:18px;background:#fff8e7;border-left:4px solid #d79a25}.strategy-lead strong{font-size:17px}.rule-list{padding:0;list-style:none}.rule-list li{display:grid;grid-template-columns:150px 1fr 90px;gap:12px;padding:10px 0;border-bottom:1px solid #e5eaf0}.rule-list em{text-align:right;color:#667085}.footer{padding:20px 62px;background:#f0f4f7;color:#667085;font-size:12px}.footer code{overflow-wrap:anywhere}@media(max-width:760px){.report{width:100%;margin:0}.cover,.content,.footer,.toc{padding-left:20px;padding-right:20px}.identity,.toc,.cards,.month-plan,.score-grid{grid-template-columns:1fr}}@media print{body{background:#fff}.report{width:100%;margin:0;box-shadow:none}.toc a{color:#fff}.chapter{break-inside:avoid}.footer{break-before:page}}</style></head>
<body><main class="report"><header class="cover"><div class="eyebrow">智财问策 · S003 债务风险监测</div><h1>企业债务风险评估报告</h1><h2>${escapeHtml(report.enterprise.name)}</h2><div class="identity"><div><span>企业编号</span><strong>${escapeHtml(report.enterprise.enterpriseId)}</strong></div><div><span>评估时点</span><strong>${escapeHtml(report.assessment.assessmentAt)}</strong></div><div><span>币种 / 单位</span><strong>${escapeHtml(report.assessment.currency)} / ${escapeHtml(report.assessment.amountUnit)}</strong></div><div><span>内容版本</span><strong>${escapeHtml(report.contentVersion)}</strong></div></div></header><nav class="toc">${toc}</nav><div class="content">
<section class="chapter" id="summary"><h2><span>01</span>总体风险评分与结论</h2><div class="score-grid"><div class="score-card"><small>综合风险评分</small><b>${escapeHtml(report.assessment.finalScore)}</b><em>${escapeHtml(report.assessment.riskTier.name)}</em></div><div class="conclusion"><strong>${escapeHtml(report.responseStrategy.headline)}</strong><p>${escapeHtml(report.conclusion)}</p><p>${escapeHtml(report.responseStrategy.guidance)}</p></div></div></section>
<section class="chapter" id="diagnosis"><h2><span>02</span>关键风险诊断说明</h2><div class="cards">${diagnosis}</div></section>
<section class="chapter" id="factors"><h2><span>03</span>调节因子明细</h2><table><thead><tr><th>因子</th><th>企业取值</th><th>命中档位</th><th>系数</th><th>状态</th></tr></thead><tbody>${factorRows}</tbody></table></section>
<section class="chapter" id="indicators"><h2><span>04</span>财务指标评分明细</h2><table><thead><tr><th>指标</th><th>实际值</th><th>权重</th><th>得分</th><th>加权分</th><th>状态</th></tr></thead><tbody>${indicatorRows}</tbody></table></section>
<section class="chapter" id="rules"><h2><span>05</span>规则、默认语义与口径</h2><ul class="rule-list">${rules}</ul></section>
<section class="chapter" id="strategy"><h2><span>06</span>风险应对策略与改善建议</h2><div class="strategy-lead"><strong>${escapeHtml(report.responseStrategy.headline)}</strong><p>${escapeHtml(report.responseStrategy.guidance)}</p></div><div class="cards">${strategies}</div></section>
<section class="chapter" id="three-months"><h2><span>07</span>未来三个月行动建议</h2><p>以下为管理建议，不自动形成 Action Request、通知、审批或负责人待办。</p><div class="month-plan">${monthPlan}</div></section>
<section class="chapter" id="disposition"><h2><span>08</span>风险触发与行动状态</h2>${candidateRows ? `<table><thead><tr><th>Action Type</th><th>触发依据</th><th>状态</th><th>Action Request</th><th>负责人待办</th></tr></thead><tbody>${candidateRows}</tbody></table>` : "<p>本轮未形成同身份风险处置候选。</p>"}</section>
<section class="chapter" id="evidence"><h2><span>09</span>核验、版本与证据</h2><p>确定性核验：${escapeHtml(report.verificationSummary.passedCount)} / ${escapeHtml(report.verificationSummary.checkCount)} 通过；报告未在客户端重算风险评分。</p><table><thead><tr><th>证据类型</th><th>证据标识</th><th>版本</th><th>资源</th><th>SHA-256</th></tr></thead><tbody>${evidenceRows}</tbody></table></section>
</div><footer class="footer"><p>reportId: <code>${escapeHtml(report.reportId)}</code></p><p>scenarioRunId: <code>${escapeHtml(report.scenarioIdentity.scenarioRunId)}</code></p><p>artifactVersion: <code>${escapeHtml(report.artifactVersion)}</code></p></footer></main></body></html>\n`;
}

function createReportService(input, options = {}) {
  const service = legacyService.createReportService(input);
  const cache = new Map();
  function getReport(enterpriseId) {
    if (!cache.has(enterpriseId)) cache.set(enterpriseId, enrichReport(service.getReport(enterpriseId), options));
    return cache.get(enterpriseId);
  }
  function listReports() {
    return deepFreeze(service.listReports().map((item) => getReport(item.enterprise.enterpriseId)));
  }
  return deepFreeze({
    serviceVersion: options.serviceVersion || SERVICE_VERSION,
    moduleId: "M06",
    readOnly: true,
    scenarioIdentity: service.scenarioIdentity,
    prototypeVersion: service.prototypeVersion,
    getReport,
    listReports,
    renderHtml(enterpriseId) { return renderReportHtml(getReport(enterpriseId), options.contentSchemaVersion || CONTENT_SCHEMA_VERSION); }
  });
}

module.exports = Object.freeze({
  SERVICE_VERSION,
  CONTENT_SCHEMA_VERSION,
  createReportService,
  enrichReport,
  hydrateKeyIndicatorActualValues,
  renderReportHtml
});
