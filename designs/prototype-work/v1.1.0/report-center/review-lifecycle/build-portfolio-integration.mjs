import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(here, "../..");
const s003Root = path.join(workspace, "scenarios/s003/resources");
const riskResults = JSON.parse(fs.readFileSync(path.join(s003Root, "m01/c035-risk-results.v2.json"), "utf8"));
const artifacts = JSON.parse(fs.readFileSync(path.join(s003Root, "m06/report-artifacts.v9.json"), "utf8"));
const outputDir = path.join(here, "portfolio-assets/s003");
fs.mkdirSync(outputDir, { recursive: true });

const mobileReportStyle = '<style id="ofw-mobile-report">@media screen and (max-width:700px){body{width:auto!important;min-width:0!important;padding:16px!important;box-shadow:none!important}.report{width:100%!important;max-width:100%!important;margin:0!important;overflow-x:clip!important}.no-print{margin:-16px -16px 16px!important}table{display:block!important;width:100%!important;max-width:100%!important;overflow-x:auto!important;-webkit-overflow-scrolling:touch}img,svg{max-width:100%!important;height:auto!important}}</style>';

function withMobileReportStyle(html) {
  if (!html.includes("</head>")) throw new Error("Report HTML is missing </head>");
  const withoutPreviousRule = html.replace(/\s*<style id=["']ofw-mobile-report["']>[\s\S]*?<\/style>/i, "");
  return withoutPreviousRule.replace("</head>", `${mobileReportStyle}</head>`);
}

const reportRows = artifacts.artifacts.map((artifact, index) => {
  const fileName = `${String(index + 1).padStart(2, "0")}-${artifact.reportId}.html`;
  fs.writeFileSync(path.join(outputDir, fileName), withMobileReportStyle(artifact.html), "utf8");
  const result = riskResults.results.find((item) => item.enterprise?.enterpriseId === artifact.reportId.split("-").at(-1)) || riskResults.results[index] || {};
  return {
    scenarioId: "S003",
    reportId: artifact.reportId,
    enterpriseId: result.enterprise?.enterpriseId || `S003-ENT-${String(index + 1).padStart(3, "0")}`,
    enterpriseName: result.enterprise?.name || result.enterprise?.enterpriseName || `成员企业 ${String(index + 1).padStart(2, "0")}`,
    category: result.enterprise?.category || artifact.enterpriseCategory || "成员企业",
    finalScore: result.finalScore,
    riskTier: result.riskTier?.name || "未分档",
    contentVersion: artifact.contentVersion,
    evidenceVersion: artifact.artifactVersion,
    html: `portfolio-assets/s003/${fileName}`,
    formats: artifact.formats || ["HTML", "PDF"]
  };
});

const portfolio = {
  version: "ofw.report.portfolio.v1",
  summary: {
    S001: { definitions: 1, reports: 1, dashboards: 1, status: "已发布" },
    S002: { definitions: 1, reports: 1, dashboards: 1, status: "已形成草稿" },
    S003: { definitions: 1, reports: reportRows.length, dashboards: 1, status: "已形成正式产物" },
    S004: { definitions: 1, reports: 2, dashboards: 0, status: "候选内容待人工确认" }
  },
  s002Topics: [
    { id: "overall", name: "总体预算执行", metric: "预算执行率 76.4%", note: "按集团、板块和单位比较批准预算与实际执行。" },
    { id: "application", name: "预算申报分析", metric: "2025 / 2026 两期申报", note: "初始申报与最终批准版本分开查看。" },
    { id: "project", name: "项目余额监督", metric: "项目可用余额", note: "定位余额不足、年末集中使用和项目节奏偏差。" },
    { id: "procurement", name: "采购占用监督", metric: "重点占用率 > 85%", note: "核查长期占用、释放安排与采购执行进度。" },
    { id: "expense", name: "费用与差旅分析", metric: "部门同比与偏差", note: "对比费用结构、差旅强度和预算消耗节奏。" },
    { id: "supplier", name: "供应商价格复核", metric: "人月成本与采购单价", note: "识别供应商价格异常并保留明细证据。" }
  ],
  s003: {
    summary: riskResults.summary,
    assessmentAt: riskResults.assessmentAt,
    resultSetId: riskResults.resultSetId,
    modelVersion: riskResults.modelPointer?.modelVersion || riskResults.modelPointer?.version || "1.0.2",
    reports: reportRows
  },
  s004: {
    definitionId: "RDEF-S004-PREFLIGHT-002",
    definitionName: "财务公司贷款贷前调查报告",
    templateId: "RT-S004-PREFLIGHT-002",
    templateVersion: "2.0.0",
    template: "../../scenarios/s004-runtime-v2.1.0/artifacts/templates/RT-S004-PREFLIGHT-002-v2.0.0.html",
    candidateHtml: "portfolio-assets/s004/RPT-S004-CGNPC-20260815-v2.1-preview.html",
    formalHtml: "../../scenarios/s004/artifacts/report/RPT-S004-CGNPC-20260815-v2.0.html",
    formalPdf: "../../scenarios/s004/artifacts/report/RPT-S004-CGNPC-20260815-v2.0.pdf",
    evidence: "../../scenarios/s004/artifacts/agent/evidence-package-v2.json",
    reportNo: "S004-PLR-2026-0001",
    contentVersion: "2.1.0-candidate",
    questions: [
      ["借款人是否具备成员单位资格？", "成员关系、统一社会信用代码与集团成员标识均已进入固定事实包。"],
      ["偿债能力结论依据是什么？", "结论引用近三年财务报表、现金流、授信与债务结构的确定性核验结果。"],
      ["当前还有哪些材料需要补齐？", "当前固定事实包 18 项核验均已完成；新一轮申请仍需按申请时点重新锁定资料。"]
    ]
  }
};

const js = `(function () {
  "use strict";
  const DATA = ${JSON.stringify(portfolio)};
  function hydrateReportData(reportData) {
    if (!reportData || reportData.portfolioIntegrationVersion === DATA.version) return reportData;
    const registry = window.OFW_COMPOSITE_REGISTRY;
    const byId = Object.fromEntries((registry?.scenes || []).map((item) => [item.scenarioId, item]));
    reportData.scenes = [
      { id: "S001", name: byId.S001?.name || "集团融资成本与债务结构优化", type: "管理驾驶舱", status: "可使用", description: "融资指标、单位比较、机构归因、Rule、报告与证据。" },
      { id: "S002", name: byId.S002?.name || "预算监督管理", type: "管理驾驶舱", status: "可使用", description: "六个预算监督专题、单位对比、明细下钻与报告草稿。" },
      { id: "S003", name: byId.S003?.name || "债务风险监测", type: "管理驾驶舱", status: "可使用", description: "21 家企业风险评分、风险分档、报告目录与行动证据。" },
      { id: "S004", name: byId.S004?.name || "财务公司贷款贷前调查", type: "正式报告", status: "可使用", description: "贷前调查定义、模板、固定事实包、HTML/PDF 与报告伴读。" }
    ];
    const additions = [
      { id: "RD-BUDGET-001", name: "预算监督专题报告", scene: "S002", purpose: "形成六个预算监督专题的固定分析报告。", audience: "集团预算管理者", version: "1.0.0", template: "预算监督专题模板 1.0.0", evidence: "58 项事实 / 66 个锚点 / 426 项核验", agent: "预算报告草稿 Agent 1.0", validation: "事实、指标和下钻明细逐项绑定", review: "报告复核人确认", publish: "当前保留草稿与驾驶舱版本", status: "已启用" },
      { id: "RD-RISK-001", name: "企业债务风险评估报告", scene: "S003", purpose: "按企业固定评分、分档、因子、指标和处置证据。", audience: "集团债务风险管理人员", version: "1.2.0", template: "债务风险评估模板 1.2.0", evidence: "C035 / 21 家企业 / CP38", agent: "债务风险报告伴读 Agent 1.0", validation: "评分、分档、指标和因子确定性核验", review: "集团风险管理人员复核", publish: "HTML/PDF 同源产物", status: "已启用" },
      { id: DATA.s004.definitionId, name: DATA.s004.definitionName, scene: "S004", purpose: "形成借款人贷前调查固定正式报告。", audience: "财务公司授信审查人员", version: "2.1.0", template: "贷前调查模板 2.0.0", evidence: "S004 固定事实包 / 18 项核验", agent: "贷前调查报告生成 Agent 2.1", validation: "借款人、成员关系、财务与偿债证据逐项核验", review: "授信负责人确认后进入待发布", publish: "受控 HTML 与同源 PDF", status: "已启用" }
    ];
    const existing = new Set(reportData.definitions.map((item) => item.id));
    reportData.definitions.push(...additions.filter((item) => !existing.has(item.id)));
    const templates = [
      { id: "RT-BUDGET-001", name: "预算监督专题模板", version: "1.0.0", status: "已启用", chapters: DATA.s002Topics.map((item) => item.name), formats: ["HTML"], templateFile: "portfolio-assets/s002-budget-report.html", downloadName: "S002-预算监督专题报告模板-v1.0.0.html", templateFileType: "可打印 HTML" },
      { id: "RT-RISK-001", name: "企业债务风险评估模板", version: "1.2.0", status: "已启用", chapters: ["执行摘要", "风险诊断", "调节因子", "财务指标", "应对策略", "证据"], formats: ["HTML", "PDF"], templateFile: DATA.s003.reports[0]?.html, downloadName: "S003-企业债务风险评估报告模板-v1.2.0.html", templateFileType: "可打印 HTML" },
      { id: DATA.s004.templateId, name: "财务公司贷款贷前调查模板", version: DATA.s004.templateVersion, status: "已启用", chapters: ["主体与成员关系", "经营与财务", "偿债能力", "授信风险", "调查结论", "证据"], formats: ["HTML", "PDF"], templateFile: DATA.s004.template, downloadName: "S004-财务公司贷款贷前调查报告模板-v2.0.0.html", templateFileType: "可打印 HTML" }
    ];
    const templateIds = new Set(reportData.templates.map((item) => item.id));
    reportData.templates.push(...templates.filter((item) => !templateIds.has(item.id)));
    reportData.portfolioIntegrationVersion = DATA.version;
    return reportData;
  }
  window.RC_PORTFOLIO = Object.freeze({ data: DATA, hydrateReportData });
})(window);
`;

fs.writeFileSync(path.join(here, "portfolio-integration.js"), js, "utf8");
console.log(`wrote ${reportRows.length} S003 reports and portfolio-integration.js`);
