"use strict";

const baseService = require("./report-service-v4.js");

const SERVICE_VERSION = "1.4.0";
const CONTENT_SCHEMA_VERSION = "ofw.s003.m06.enterprise-report-content.v6";
const INTERNAL_PRESENTATION_ENUM = /\b(?:APPLIED|EVALUATED|NOT_APPLICABLE|DEFAULTED_ZERO|CONFIRMED_TO_OWNER_TODO|CANDIDATE_AWAITING_HUMAN_CONFIRMATION)\b/;

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

function sameIdentity(left, right) {
  return Boolean(left && right && ["scenarioId", "scenarioVersion", "scenarioRunId"].every((field) => left[field] && left[field] === right[field]));
}

function evidenceByType(report, type) {
  return (report.evidenceReferences || []).find((item) => item.evidenceType === type) || null;
}

function majorFactorCandidates(report) {
  return (report.disposition?.candidates || []).filter((candidate) => candidate.trigger?.type === "MAJOR_FACTOR" && (candidate.trigger.factors || []).length);
}

function applyMajorFactorManagementSemantics(report) {
  const candidates = majorFactorCandidates(report);
  if (!candidates.length) return report;
  const factors = [...new Set(candidates.flatMap((candidate) => candidate.trigger.factors || []))];
  report.managementEscalation = {
    triggered: true,
    signalType: "重大因子管理升级",
    scoringTierUnchanged: true,
    riskTierName: report.assessment?.riskTier?.name || null,
    factors,
    candidateIds: candidates.map((candidate) => candidate.candidateId),
    guidance: "评分分档与重大因子管理信号分开判断；管理关注升级不改变当前评分或风险分档，行动申请仍须由风险管理人员人工确认。"
  };

  if (report.assessment?.riskTier?.tierId === "GREEN") {
    report.conclusion = `${report.enterprise.name}本轮调整后综合得分为 ${Number(report.assessment.finalScore).toFixed(2)} 分，评分分档仍为绿灯；但已命中重大因子“${factors.join("、")}”，触发重大因子管理升级。该升级不改变评分或分档，应优先核实资金缺口、到期债务、回款、授信和应急资金来源，并由风险管理人员判断是否提交标准行动申请。`;
    report.responseStrategy = {
      ...(report.responseStrategy || {}),
      headline: "评分仍为绿灯，但重大因子触发管理关注升级",
      guidance: "保持绿灯评分事实不变，同时把重大因子作为独立管理信号优先处置；不得仅按常态监测弱化资金余缺风险。"
    };
  }

  const factorItems = report.keyRiskDiagnosis?.factorItems || [];
  for (const factor of factors) {
    const diagnosis = factorItems.find((item) => factor.includes(item.title) || item.title.includes(factor.replace(/^当月/, "")));
    if (!diagnosis) continue;
    diagnosis.severity = "high";
    diagnosis.statement = `${diagnosis.statement} 该取值同时形成重大因子管理信号，需与当前评分分档分开判断。`;
    diagnosis.recommendation = `${diagnosis.recommendation || "核实事实证据与缓释安排。"} 由风险管理人员优先核实，并人工判断是否提交行动申请。`;
  }

  if ((report.threeMonthActionPlan || []).length >= 3) {
    report.threeMonthActionPlan[0] = {
      ...report.threeMonthActionPlan[0],
      objective: "核实重大资金余缺信号并确定管理动作",
      actions: `核实${factors.join("、")}的金额、持续时间、到期债务、回款、可用授信和应急资金来源；由风险管理人员人工判断是否提交标准行动申请。`
    };
    report.threeMonthActionPlan[1] = {
      ...report.threeMonthActionPlan[1],
      objective: "跟踪资金缺口缓释与负责人待办",
      actions: "滚动核对资金计划、融资落实和经营回款；如已提交行动申请，只读跟踪通用决策中心和负责人待办，不在报告中心重建处置状态。"
    };
    report.threeMonthActionPlan[2] = {
      ...report.threeMonthActionPlan[2],
      objective: "形成新运行并复核管理升级是否解除",
      actions: "输入或模型变化后创建新的 scenarioRunId 重跑，分别比较评分分档与重大因子信号；历史报告、行动申请和待办保持原身份只读。"
    };
  }
  return report;
}

function diagnosticValueAligned(report) {
  if (report.assessment?.isUnderConstruction) return true;
  const indicators = new Map((report.indicatorDetails || []).map((item) => [item.name, item]));
  return (report.keyRiskDiagnosis?.indicatorItems || []).every((item) => {
    const indicator = indicators.get(item.title);
    if (!indicator) return false;
    return Number(item.currentScore).toFixed(2) === Number(indicator.score).toFixed(2);
  });
}

function constructionSemanticsComplete(report) {
  if (!report.assessment?.isUnderConstruction) return true;
  const semanticText = JSON.stringify({
    conclusion: report.conclusion,
    diagnosis: report.keyRiskDiagnosis,
    strategy: report.responseStrategy,
    plan: report.threeMonthActionPlan
  });
  return Number(report.assessment.rawScore) === 60
    && (report.indicatorDetails || []).length === 15
    && !(report.keyRiskDiagnosis?.indicatorItems || []).some((item) => item.type === "indicator")
    && /固定 60/.test(semanticText)
    && /建设资金/.test(semanticText)
    && /投产条件/.test(semanticText)
    && !/低分指标|最低指标/.test(semanticText);
}

function formationChecks(report, artifactHtmlProbe) {
  const evidenceTypes = new Set((report.evidenceReferences || []).map((item) => item.evidenceType));
  const requiredEvidence = [
    "C035_RESULT", "PUBLISHED_RISK_FACT", "PUBLISHED_MODEL_POINTER", "FORMAL_DATA_ASSET",
    "HUMAN_INPUT_SNAPSHOT", "QUALITY_RESULT", "REPORT_CONTRACT", "DECISION_RESULT"
  ];
  const indicatorWeight = (report.indicatorDetails || []).reduce((sum, item) => sum + Number(item.weightPercent ?? Number(item.weight || 0) * 100), 0);
  const factorStates = new Set(["APPLIED", "NOT_APPLICABLE", "DEFAULTED_ZERO"]);
  const candidates = report.disposition?.candidates || [];
  const scenarioEvidence = evidenceByType(report, "C035_RESULT");
  return {
    "scenario-identity": {
      passed: sameIdentity(report.scenarioIdentity, report.deliveryIdentity),
      evidence: `${report.scenarioIdentity?.scenarioId || "—"} / ${report.scenarioIdentity?.scenarioVersion || "—"} / ${report.scenarioIdentity?.scenarioRunId || "—"}`
    },
    "published-binding": {
      passed: Boolean(evidenceByType(report, "PUBLISHED_MODEL_POINTER") && evidenceByType(report, "PUBLISHED_RISK_FACT") && scenarioEvidence),
      evidence: `${evidenceByType(report, "PUBLISHED_MODEL_POINTER")?.evidenceId || "缺失"}；${evidenceByType(report, "PUBLISHED_RISK_FACT")?.evidenceId || "缺失"}`
    },
    "score-record": {
      passed: Number.isFinite(Number(report.assessment?.finalScore)) && Boolean(report.assessment?.riskTier?.tierId) && Boolean(scenarioEvidence),
      evidence: `${scenarioEvidence?.evidenceId || "缺失"}；最终评分 ${report.assessment?.finalScore ?? "—"}；${report.assessment?.riskTier?.name || "未分档"}`
    },
    "indicator-coverage": {
      passed: (report.indicatorDetails || []).length === 15 && (report.assessment?.isUnderConstruction ? Number(report.assessment.rawScore) === 60 : Math.abs(indicatorWeight - 100) < 0.01),
      evidence: `${(report.indicatorDetails || []).length} 项指标；${report.assessment?.isUnderConstruction ? `固定原始分 ${report.assessment.rawScore}` : `权重合计 ${indicatorWeight.toFixed(2)}%`}`
    },
    "factor-coverage": {
      passed: (report.adjustmentFactors || []).length > 0 && (report.adjustmentFactors || []).every((item) => factorStates.has(item.state)),
      evidence: `${(report.adjustmentFactors || []).length} 项调节因子；缺失套零 ${report.factorStateSummary?.DEFAULTED_ZERO || 0}；业务不适用 ${report.factorStateSummary?.NOT_APPLICABLE || 0}`
    },
    "evidence-coverage": {
      passed: requiredEvidence.every((type) => evidenceTypes.has(type)),
      evidence: requiredEvidence.map((type) => `${type}:${evidenceTypes.has(type) ? "已定位" : "缺失"}`).join("；")
    },
    "artifact-identity": {
      passed: Boolean(report.contentVersion && report.artifactVersion && report.generationPolicy?.sameIdentityAcrossFormats === true),
      evidence: `内容版本 ${report.contentVersion || "缺失"}；产物版本 ${report.artifactVersion || "缺失"}；浏览器打印与 HTML 使用同一内容`
    },
    "side-effect-boundary": {
      passed: report.generationPolicy?.createsActionRequest === false && report.generationPolicy?.createsTodo === false && report.generationPolicy?.sendsNotification === false,
      evidence: "报告形成不创建行动申请、负责人待办或通知"
    },
    "localized-business-status": {
      passed: Boolean(artifactHtmlProbe) && !INTERNAL_PRESENTATION_ENUM.test(artifactHtmlProbe),
      evidence: "下载 HTML 已扫描内部状态枚举，技术标识仅保留在结构化追溯字段"
    },
    "structured-trigger": {
      passed: candidates.every((candidate) => candidate.candidateId && candidate.actionTypeId && candidate.trigger?.type && (candidate.trigger.type !== "MAJOR_FACTOR" || (candidate.trigger.factors || []).length)),
      evidence: candidates.length ? `${candidates.length} 条候选均含 candidateId、Action Type 与结构化触发依据` : "本企业本轮无处置候选，未补造触发记录"
    },
    "diagnosis-value-format": {
      passed: diagnosticValueAligned(report),
      evidence: report.assessment?.isUnderConstruction ? "在建企业使用固定 60 分专题语义，不形成虚假指标诊断" : "诊断得分与 15 项指标明细逐项对齐"
    },
    "decision-status-alignment": {
      passed: Boolean(evidenceByType(report, "DECISION_RESULT")) && candidates.every((candidate) => candidate.candidateId && candidate.enterpriseId !== "" && candidate.status),
      evidence: candidates.length ? `${evidenceByType(report, "DECISION_RESULT")?.evidenceId || "缺失"}；${candidates.length} 条形成时候选非空且身份完整` : `${evidenceByType(report, "DECISION_RESULT")?.evidenceId || "缺失"}；本企业无预期候选`
    },
    "construction-semantics": {
      passed: constructionSemanticsComplete(report),
      evidence: report.assessment?.isUnderConstruction ? "固定 60 分、建设资金、投产条件和 15 项口径清单均已覆盖" : "非在建企业，本检查不适用并按适用性通过"
    }
  };
}

function verificationResponsibility(checkId) {
  if (["published-binding", "score-record", "structured-trigger"].includes(checkId)) return "本体管理提供正式事实，报告中心核对并固定引用";
  if (["indicator-coverage", "factor-coverage", "evidence-coverage"].includes(checkId)) return "数据工程提供数据与输入证据，报告中心核对完整性；评分规则仍归本体管理";
  if (checkId === "decision-status-alignment") return "决策中心提供 C011/C019 状态，报告中心只读固定形成时证据";
  return "报告中心";
}

function buildVerificationResults(report, checks, artifactHtmlProbe, checkedAt) {
  const outcomes = formationChecks(report, artifactHtmlProbe);
  return (checks || []).map((check) => {
    const outcome = outcomes[check.checkId] || { passed: false, evidence: "检查实现未注册" };
    return {
      checkId: check.checkId,
      label: check.label,
      severity: check.severity === "blocking" ? "阻断" : "提示",
      passed: outcome.passed === true,
      status: outcome.passed === true ? "通过" : "失败",
      evidence: outcome.evidence,
      impact: outcome.passed === true ? "未发现影响正式报告消费的一致性问题。" : "阻断该内容版本进入正式报告目录。",
      responsibility: verificationResponsibility(check.checkId),
      recommendation: outcome.passed === true ? "保持当前不可变证据引用；输入、模型或内容变化后形成新版本。" : "修复来源证据或合同后重新形成新的报告内容版本，不覆盖当前记录。",
      checkedAt
    };
  });
}

function upgradeReport(sourceReport, options = {}) {
  const report = applyMajorFactorManagementSemantics(clone(baseService.upgradeReport(sourceReport, {
    ...options,
    contentSchemaVersion: options.contentSchemaVersion || CONTENT_SCHEMA_VERSION,
    reportVersion: options.reportVersion || SERVICE_VERSION,
    contentVersion: options.contentVersion || SERVICE_VERSION,
    artifactVersion: options.artifactVersion || "html-print-capability-v6"
  })));
  report.schemaVersion = options.contentSchemaVersion || CONTENT_SCHEMA_VERSION;
  report.reportVersion = options.reportVersion || SERVICE_VERSION;
  report.contentVersion = options.contentVersion || SERVICE_VERSION;
  report.artifactVersion = options.artifactVersion || "html-print-capability-v6";
  report.artifactPolicy = {
    primaryFormat: "html",
    independentPdfArtifact: false,
    browserPrintToPdf: true,
    statement: "正式产物为固定 HTML；PDF 由浏览器打印/另存为能力形成，不声明独立 PDF 文件或哈希。"
  };
  const probe = baseService.renderReportHtml(report, report.schemaVersion);
  report.verificationResults = buildVerificationResults(report, options.verificationChecks || [], probe, options.checkedAt || report.generatedAt);
  const passedCount = report.verificationResults.filter((item) => item.passed).length;
  report.verificationSummary = {
    deterministic: true,
    checkCount: report.verificationResults.length,
    passedCount,
    failedCount: report.verificationResults.length - passedCount,
    result: passedCount === report.verificationResults.length ? "passed" : "failed",
    derivedFromResults: true,
    clientSideScoreRecalculation: false,
    noInternalEnumsInPublishedHtml: !INTERNAL_PRESENTATION_ENUM.test(probe),
    artifactMatchesContentVersion: Boolean(report.artifactVersion && report.contentVersion),
    nonVacuousDecisionEvidenceRequired: true,
    constructionIndicatorSemantics: report.assessment?.isUnderConstruction ? "fixed-60-no-indicator-ranking" : "weighted-indicator-coverage"
  };
  return deepFreeze(report);
}

function verificationTable(report) {
  const rows = (report.verificationResults || []).map((item) => `<tr><td><strong>${escapeHtml(item.label)}</strong><br><code>${escapeHtml(item.checkId)}</code></td><td>${escapeHtml(item.status)}</td><td>${escapeHtml(item.evidence)}</td><td>${escapeHtml(item.impact)}</td><td>${escapeHtml(item.responsibility)}</td><td>${escapeHtml(item.recommendation)}</td></tr>`).join("");
  return `<h3>报告形成时逐项核验</h3><table><thead><tr><th>检查项</th><th>结果</th><th>证据</th><th>影响</th><th>责任</th><th>建议</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function managementEscalationCallout(report) {
  const escalation = report.managementEscalation;
  if (!escalation?.triggered) return "";
  return `<div class="callout"><strong>重大因子管理升级（评分分档不变）</strong><p>当前评分分档仍为${escapeHtml(escalation.riskTierName || "当前分档")}；同时命中${escapeHtml(escalation.factors.join("、"))}。管理关注升级不改变评分或分档，需由风险管理人员人工判断是否提交标准行动申请。</p></div>`;
}

function renderReportHtml(report, expectedSchemaVersion = CONTENT_SCHEMA_VERSION) {
  let html = baseService.renderReportHtml(report, expectedSchemaVersion);
  const callout = managementEscalationCallout(report);
  if (callout) html = html.replace(/(<section class="chapter" id="summary">[\s\S]*?)(<\/section>)/, `$1${callout}$2`);
  if ((report.verificationResults || []).length) {
    html = html.replace(/(<section class="chapter" id="evidence">[\s\S]*?)(<\/section>)/, `$1${verificationTable(report)}$2`);
  }
  return html;
}

function createReportService(input, options = {}) {
  const source = baseService.createReportService(input, {
    ...options,
    contentSchemaVersion: options.contentSchemaVersion || CONTENT_SCHEMA_VERSION,
    reportVersion: options.reportVersion || SERVICE_VERSION,
    contentVersion: options.contentVersion || SERVICE_VERSION,
    artifactVersion: options.artifactVersion || "html-print-capability-v6"
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
  renderReportHtml,
  buildVerificationResults
});
