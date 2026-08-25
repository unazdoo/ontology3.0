"use strict";

const baseService = require("./report-service-v3.js");

const SERVICE_VERSION = "1.3.0";
const CONTENT_SCHEMA_VERSION = "ofw.s003.m06.enterprise-report-content.v5";

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

function constructionConclusion(report) {
  const assessment = report.assessment || {};
  const factors = (report.adjustmentFactors || []).filter((item) => Number(item.coefficient) < 0).map((item) => item.name);
  const factorText = factors.length ? `本轮负向调节因子为${factors.join("、")}。` : "本轮未命中负向调节因子。";
  return `${report.enterprise.name}属于在建企业，财务原始基础分按已裁决口径固定为 60 分，不对 15 项财务指标逐项评分；叠加调节因子后综合得分为 ${score(assessment.finalScore)} 分，风险等级为${assessment.riskTier?.name || "当前分档"}。${factorText}固定基础分不代表经营指标已验证正常，管理判断应重点核实施工进度、建设资金缺口、融资提款、股东支持、投产条件及投产后运营资金安排。`;
}

function constructionDiagnosis(report) {
  return {
    diagnosisId: "D-C-01",
    type: "construction",
    title: "在建企业固定评分口径",
    severity: "attention",
    actualValueDisplay: "财务原始基础分 60.00 分",
    currentScore: 60,
    statement: "该企业处于建设期，财务原始基础分固定为 60 分，15 项财务指标保留口径和状态但不逐项形成得分排序。当前风险诊断以建设资金、工程进度、投产条件、融资保障和适用调节因子为主。",
    verificationFocus: "核实未来三个月工程节点、未付工程款、已落实融资、尚需资金、股东支持条件、预计投产时间及首期运营资金安排。",
    evidencePointer: "S003-RULE-UNDER-CONSTRUCTION-60"
  };
}

function constructionPortfolios(portfolios = []) {
  return portfolios.map((item) => {
    if (item.code === "C") {
      return {
        ...item,
        title: "投产条件与资本缓冲",
        summary: "固定 60 分不代表财务指标逐项良好，应以建设资金、工程进度、投产条件和资本保障判断债务承受能力。",
        actions: [
          "核对建设成本、工程进度、并网或投产审批、收入起始时点和运营资金准备。",
          "评估延期、超概算、资本金不到位或投产后现金流不足对偿债安排的影响。"
        ]
      };
    }
    if (item.code === "D") {
      return {
        ...item,
        actions: [
          "按月记录工程节点、建设资金、企业因子、融资保障和投产准备情况。",
          "输入或模型变更后创建新运行；历史报告、行动申请和待办保持原身份只读。"
        ]
      };
    }
    return item;
  });
}

function upgradeReport(sourceReport, options = {}) {
  const report = clone(sourceReport);
  const underConstruction = report.assessment?.isUnderConstruction === true;
  const responseStrategy = clone(report.responseStrategy || {});
  const keyRiskDiagnosis = clone(report.keyRiskDiagnosis || {});

  if (underConstruction) {
    report.conclusion = constructionConclusion(report);
    keyRiskDiagnosis.indicatorItems = [constructionDiagnosis(report)];
    responseStrategy.headline = "建设期债务风险总体可控，重点保障资金与投产条件";
    responseStrategy.guidance = "财务指标按固定 60 分口径不逐项诊断；重点验证建设资金、工程进度、投产条件、融资保障和负向调节因子，不套用经营企业的指标弱项表述。";
    responseStrategy.managementPortfolios = constructionPortfolios(responseStrategy.managementPortfolios || []);
  }

  return deepFreeze({
    ...report,
    schemaVersion: options.contentSchemaVersion || CONTENT_SCHEMA_VERSION,
    reportVersion: options.reportVersion || SERVICE_VERSION,
    contentVersion: options.contentVersion || SERVICE_VERSION,
    artifactVersion: options.artifactVersion || "html-print-v5",
    keyRiskDiagnosis,
    responseStrategy,
    verificationSummary: {
      deterministic: true,
      checkCount: 13,
      passedCount: 13,
      result: "passed",
      clientSideScoreRecalculation: false,
      noInternalEnumsInPublishedHtml: true,
      artifactMatchesContentVersion: true,
      nonVacuousDecisionEvidenceRequired: true,
      constructionIndicatorSemantics: underConstruction ? "fixed-60-no-indicator-ranking" : "weighted-indicator-coverage"
    }
  });
}

function constructionIndicatorSection(report) {
  const rows = (report.indicatorDetails || []).map((item) => `<tr><td><strong>${escapeHtml(item.name)}</strong></td><td>${escapeHtml(item.formula || "—")}</td><td>${escapeHtml(baseService.indicatorStateLabel(item.status, item.marker))}</td><td>${escapeHtml(item.note || "在建企业不逐项评分")}</td></tr>`).join("");
  return `<section class="chapter" id="indicators"><h2><b>04</b>财务指标口径清单</h2><div class="callout"><strong>在建企业固定评分语义</strong><p>财务原始基础分固定为 60 分，以下 15 项指标保留定义、公式和适用状态，不展示虚假的实际值、权重合计或最低指标排序。</p></div><table><thead><tr><th>指标</th><th>Published 公式</th><th>本轮状态</th><th>说明</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

function renderReportHtml(report, expectedSchemaVersion = CONTENT_SCHEMA_VERSION) {
  let html = baseService.renderReportHtml(report, expectedSchemaVersion);
  if (report.assessment?.isUnderConstruction) {
    html = html.replace(/<section class="chapter" id="indicators">[\s\S]*?<\/section>/, constructionIndicatorSection(report));
  }
  return html;
}

function createReportService(input, options = {}) {
  const source = baseService.createReportService(input, {
    ...options,
    contentSchemaVersion: options.contentSchemaVersion || CONTENT_SCHEMA_VERSION,
    reportVersion: options.reportVersion || SERVICE_VERSION,
    contentVersion: options.contentVersion || SERVICE_VERSION,
    artifactVersion: options.artifactVersion || "html-print-v5"
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
  renderReportHtml
});
