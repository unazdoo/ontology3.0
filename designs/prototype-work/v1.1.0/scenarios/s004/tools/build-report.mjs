import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scenarioDir = path.resolve(__dirname, "..");
const reportDir = path.join(scenarioDir, "artifacts", "report");
const pdfTmpDir = path.join(scenarioDir, "tmp", "pdf-pages");
const reportBaseName = "RPT-S004-CGNPC-20260815-v1.0.1";
const htmlPath = path.join(reportDir, `${reportBaseName}.html`);
const pdfPath = path.join(reportDir, `${reportBaseName}.pdf`);
const reportDataPath = path.join(reportDir, "report-data-v1.0.1.json");
const publicationManifestPath = path.join(reportDir, "publication-manifest-v1.0.1.json");
const docPagePath = "/Users/domi/.codex/skills/baoyu-design/starter-components/doc-page.js";

const readJson = async (relativePath) =>
  JSON.parse(await fs.readFile(path.join(scenarioDir, relativePath), "utf8"));

const [official, synthetic, c008, evidencePackage, draft, definition, human, verification, docPageJs] =
  await Promise.all([
    readJson("artifacts/data/official-public.json"),
    readJson("artifacts/data/synthetic-demo.json"),
    readJson("artifacts/ontology/c008-authoritative-facts.json"),
    readJson("artifacts/agent/evidence-package.json"),
    readJson("artifacts/agent/draft-output.json"),
    readJson("artifacts/report/report-definition.json"),
    readJson("artifacts/report/human-confirmation.json"),
    readJson("artifacts/report/deterministic-verification.json"),
    fs.readFile(docPagePath, "utf8")
  ]);

const context = human.scenarioContext;
const reportNumber = human.identity.reportNumber;
const reportId = human.identity.reportId;
const applicationId = human.identity.applicationId;
const contentVersion = "1.0.1";
const evidencePackageId = evidencePackage.evidencePackageId || "EVP-S004-20260815-0001";
const publicationStatus = "PUBLISHED_DEMO";
const publishedAt = human.publicationAuthorization.authorizedAt;
const borrower = official.borrower;
const loan = synthetic.loanApplication;
const facility = synthetic.internalFacility;
const humanDecision = human.creditDecision;

const financial2024 = official.financialPeriodSets.find((item) => item.period === "2024")?.facts || {};
const financial2025 = official.financialPeriodSets.find((item) => item.period === "2025")?.facts || {};
const metricRows = c008.metricRun.results;
const metric = (id) => metricRows.find((item) => item.metricId === id);

const anchors = definition.sections.map((section) => section.anchor);
const money = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return numeric.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const percent = (value) => `${(Number(value) * 100).toFixed(2)}%`;
const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const sourceChip = (text, kind = "official") =>
  `<span class="source-chip source-${kind}">${escapeHtml(text)}</span>`;

const metricTableRows = [
  ["资产负债率", "MET-DEBT-ASSET-RATIO", "ATTENTION"],
  ["流动比率", "MET-CURRENT-RATIO", "ATTENTION"],
  ["EBIT/利息", "MET-EBIT-INTEREST-COVERAGE", "PASS"],
  ["主营业务利润率", "MET-MAIN-BUSINESS-PROFIT-MARGIN", "PASS"],
  ["总资产报酬率", "MET-RETURN-ON-TOTAL-ASSETS", "PASS"],
  ["净资产收益率", "MET-RETURN-ON-PARENT-EQUITY", "PASS"],
  ["存货周转率", "MET-INVENTORY-TURNOVER", "PASS"],
  ["应收账款周转率", "MET-AR-TURNOVER", "PASS"],
  ["总资产周转率", "MET-TOTAL-ASSET-TURNOVER", "PASS"],
  ["流动资产周转率", "MET-CURRENT-ASSET-TURNOVER", "PASS"],
  ["总资产增长率", "MET-TOTAL-ASSET-GROWTH", "PASS"],
  ["净资产增长率", "MET-PARENT-EQUITY-GROWTH", "ATTENTION"],
  ["净利润增长率", "MET-NET-PROFIT-GROWTH", "ATTENTION"],
  ["营业收入增长率", "MET-REVENUE-GROWTH", "ATTENTION"]
].map(([label, id, status]) => {
  const result = metric(id);
  return `<tr><td>${label}</td><td>${escapeHtml(result?.displayValue || "-")}</td><td><code>${id}</code></td><td><span class="status status-${status.toLowerCase()}">${status}</span></td></tr>`;
}).join("");

const conditions = humanDecision.conditions
  .map((item) => `<li id="${item.conditionId}"><strong>${item.conditionId}</strong>${escapeHtml(item.text)}</li>`)
  .join("");

const reportData = {
  schemaVersion: "ofw.s004.controlled-report-data.v1",
  reportId,
  reportNumber,
  contentVersion,
  evidencePackageId,
  publicationStatus,
  publishedAt,
  scenarioContext: context,
  applicationId,
  borrowerId: borrower.borrowerId,
  stableAnchors: anchors,
  sameSource: {
    html: `artifacts/report/${reportBaseName}.html`,
    pdf: `artifacts/report/${reportBaseName}.pdf`
  },
  sourceClasses: ["official-public", "synthetic-demo", "derived-deterministic", "human-input"],
  automationBoundary: human.automationBoundary
};

const controlMetadata = escapeHtml(JSON.stringify(reportData));

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="design_doc_mode" content="document">
  <title>${reportNumber} - 贷前调查报告</title>
  <style>
    :root {
      --navy: #17324d;
      --navy-2: #274b6d;
      --blue: #235a93;
      --teal: #2e776b;
      --amber: #9b6118;
      --red: #9c3535;
      --ink: #17222d;
      --muted: #617080;
      --line: #d8dee6;
      --paper: #ffffff;
      --soft: #f4f7fa;
      --official: #eaf2fa;
      --synthetic: #fff4e1;
      --human: #eee9fa;
      --derived: #e9f5f2;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; color: var(--ink); font-family: "Noto Serif SC", "Songti SC", "STSong", serif; background: #e8edf2; }
    body { font-size: 14px; line-height: 1.72; }
    doc-page:not(:defined) { visibility: hidden; }
    doc-page { --doc-page-margin: 0.68in; }
    h1, h2, h3, h4 { color: var(--navy); font-family: "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif; }
    h1 { margin: 0; font-size: 30px; line-height: 1.25; letter-spacing: 0.08em; text-align: center; }
    h2 { margin: 34px 0 14px; padding: 8px 0 8px 13px; border-left: 5px solid var(--blue); border-bottom: 1px solid var(--line); font-size: 20px; }
    h3 { margin: 24px 0 10px; font-size: 16px; }
    h4 { margin: 16px 0 7px; font-size: 14px; }
    p { margin: 8px 0; orphans: 3; widows: 3; text-align: justify; }
    a { color: inherit; }
    code { font-family: "SFMono-Regular", Consolas, monospace; color: #385067; font-size: 10px; }
    .running-header, .running-footer { width: 100%; color: #5f6d7b; font-family: "PingFang SC", sans-serif; font-size: 9px; }
    .running-header { display: flex; justify-content: space-between; border-bottom: 1px solid #dfe4ea; padding-bottom: 4px; }
    .running-footer { display: flex; justify-content: space-between; border-top: 1px solid #dfe4ea; padding-top: 4px; }
    .cover { min-height: 8.7in; display: flex; flex-direction: column; justify-content: center; position: relative; break-after: page; }
    .cover::before { content: "演示案例"; position: absolute; right: -24px; top: 6px; transform: rotate(8deg); padding: 6px 13px; color: var(--red); border: 2px solid var(--red); font-family: "PingFang SC", sans-serif; font-weight: 800; letter-spacing: .16em; opacity: .78; }
    .cover-rule { height: 5px; width: 100%; margin: 24px 0 36px; background: linear-gradient(90deg, var(--navy), var(--blue) 70%, #8fb1d2); }
    .cover .borrower { margin-top: 16px; color: var(--navy-2); font-size: 20px; text-align: center; font-family: "PingFang SC", sans-serif; font-weight: 650; }
    .cover .subtitle { margin-top: 8px; color: var(--muted); text-align: center; font-family: "PingFang SC", sans-serif; }
    .control-banner { margin: 34px auto 0; padding: 10px 16px; color: #7d3b21; background: #fff6e7; border: 1px solid #e7c89b; border-radius: 3px; font-family: "PingFang SC", sans-serif; font-size: 11px; text-align: center; }
    .cover-meta { width: 100%; margin: 52px auto 0; border-collapse: collapse; font-family: "PingFang SC", sans-serif; font-size: 11px; }
    .cover-meta th, .cover-meta td { padding: 7px 9px; border-bottom: 1px solid var(--line); text-align: left; }
    .cover-meta th { width: 19%; color: var(--muted); font-weight: 600; }
    .cover-meta td { width: 31%; }
    .statement { margin-top: auto; padding-top: 28px; color: var(--muted); font-size: 10px; text-align: center; }
    .summary-strip { margin: 16px 0 24px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; break-inside: avoid; }
    .summary-card { padding: 11px 12px; background: var(--soft); border-top: 3px solid var(--blue); }
    .summary-card small { display: block; color: var(--muted); font-family: "PingFang SC", sans-serif; font-size: 9px; }
    .summary-card strong { display: block; margin-top: 3px; color: var(--navy); font-family: "PingFang SC", sans-serif; font-size: 16px; }
    .meta-line { margin: 8px 0 18px; color: var(--muted); font-family: "PingFang SC", sans-serif; font-size: 10px; }
    .source-chip { display: inline-block; margin: 2px 4px 2px 0; padding: 1px 6px; border-radius: 9px; font-family: "PingFang SC", sans-serif; font-size: 8px; vertical-align: 1px; }
    .source-official { color: #214d77; background: var(--official); }
    .source-synthetic { color: #7b4a0e; background: var(--synthetic); }
    .source-human { color: #58428d; background: var(--human); }
    .source-derived { color: #22675d; background: var(--derived); }
    .fact-note { margin: 11px 0; padding: 10px 12px; background: #f8fafc; border-left: 3px solid #8fa5ba; color: #334252; font-size: 12px; break-inside: avoid; }
    .warning { background: #fff8ea; border-left-color: #c78525; }
    .human-note { background: #f4f0fb; border-left-color: #7b63a7; }
    .decision { padding: 16px 18px; background: #f0f6fb; border: 1px solid #b9cbdd; border-top: 5px solid var(--navy); break-inside: avoid; }
    .decision strong { color: var(--navy); }
    table { width: 100%; margin: 12px 0 18px; border-collapse: collapse; table-layout: fixed; font-family: "PingFang SC", sans-serif; font-size: 10px; break-inside: auto; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
    th, td { padding: 6px 7px; border: 1px solid var(--line); vertical-align: top; word-break: break-word; }
    th { color: #fff; background: var(--navy-2); text-align: left; font-weight: 650; }
    tbody tr:nth-child(even) td { background: #f8fafc; }
    .number { text-align: right; font-variant-numeric: tabular-nums; }
    .status { padding: 1px 5px; border-radius: 8px; font-size: 8px; font-weight: 700; }
    .status-pass { color: #23685f; background: var(--derived); }
    .status-attention { color: #86540f; background: var(--synthetic); }
    .risk-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; break-inside: avoid; }
    .risk-card { padding: 12px 13px; border: 1px solid var(--line); border-top: 3px solid var(--amber); }
    .risk-card h4 { margin-top: 0; }
    .risk-card p { font-size: 11px; }
    .term-grid { display: grid; grid-template-columns: repeat(3, 1fr); margin: 13px 0; border: 1px solid var(--line); break-inside: avoid; }
    .term { padding: 10px; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
    .term:nth-child(3n) { border-right: 0; }
    .term small { display: block; color: var(--muted); font-family: "PingFang SC", sans-serif; font-size: 9px; }
    .term strong { display: block; margin-top: 3px; color: var(--navy); font-family: "PingFang SC", sans-serif; font-size: 13px; }
    .conditions { margin: 10px 0 0; padding-left: 22px; }
    .conditions li { margin: 7px 0; padding-left: 5px; }
    .conditions strong { display: inline-block; margin-right: 8px; color: var(--blue); font-family: "SFMono-Regular", Consolas, monospace; font-size: 9px; }
    .section-page { break-before: page; }
    .appendix-table td:nth-child(1), .appendix-table th:nth-child(1) { width: 29%; }
    .appendix-table td:nth-child(2), .appendix-table th:nth-child(2) { width: 20%; }
    #sec-06-data-sources h3 { margin: 14px 0 6px; }
    #sec-06-data-sources table { margin: 7px 0 10px; font-size: 9px; }
    #sec-06-data-sources th, #sec-06-data-sources td { padding: 4px 5px; }
    .signature-grid { margin-top: 26px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-family: "PingFang SC", sans-serif; font-size: 10px; break-inside: avoid; }
    .signature { padding: 10px; border-top: 1px solid #9faab5; }
    .signature span { display: block; color: var(--muted); }
    .end-mark { margin: 18px 0 6px; color: #8190a0; text-align: center; letter-spacing: .32em; }
    @media screen and (max-width: 760px) {
      body { font-size: 13px; }
      .summary-strip, .risk-grid, .term-grid { grid-template-columns: 1fr; }
      .term { border-right: 0; }
    }
    @media print {
      body { background: #fff; }
      .cover { min-height: 9.4in; }
      .screen-only { display: none !important; }
    }
  </style>
</head>
<body>
<doc-page size="a4" margin="0.68in">
  <h1 class="sr-only" style="position:absolute;left:-9999px">贷前调查报告</h1>
  <section class="cover" id="report-cover" data-anchor="report-cover">
    <div class="cover-rule"></div>
    <h1>贷前调查报告</h1>
    <div class="borrower">（${escapeHtml(borrower.fullName)}）</div>
    <div class="subtitle">财务公司成员单位流动资金贷款 · 演示案例</div>
    <div class="control-banner">本报告为 S004 产品演示的受控正式产物，不构成真实授信调查或信贷决定。</div>
    <table class="cover-meta">
      <tr><th>报告编号</th><td>${reportNumber}</td><th>内容版本</th><td>${contentVersion}</td></tr>
      <tr><th>申请编号</th><td>${applicationId}</td><th>报告ID</th><td>${reportId}</td></tr>
      <tr><th>借款人</th><td>${escapeHtml(borrower.fullName)}</td><th>统一社会信用代码</th><td>${borrower.unifiedSocialCreditCode}</td></tr>
      <tr><th>业务主体</th><td>${escapeHtml(synthetic.financialCompany.displayName)}</td><th>报告日期</th><td>2026年8月15日</td></tr>
      <tr><th>发布状态</th><td>${publicationStatus}</td><th>证据包</th><td>${evidencePackageId}</td></tr>
    </table>
    <div class="statement">财务事实截至2025年12月31日；内部演示资料截至2026年8月15日。</div>
  </section>

  <section id="report-summary" data-anchor="report-summary">
    <h2>报告控制摘要</h2>
    <div class="summary-strip">
      <div class="summary-card"><small>申请金额</small><strong>${money(loan.requestedAmount)} 万元</strong></div>
      <div class="summary-card"><small>确定性新增流贷上限</small><strong>${money(metric("MET-MAX-NEW-WORKING-CAPITAL-LOAN")?.displayValue)} 万元</strong></div>
      <div class="summary-card"><small>内部可用授信</small><strong>${money(facility.availableFacility)} 万元</strong></div>
      <div class="summary-card"><small>人工批准金额</small><strong>${money(humanDecision.approvedAmount)} 万元</strong></div>
    </div>
    <p class="meta-line">报告事实经 Published 本体与 C008 获取；Agent仅基于固定证据包组织表达；最终授信决定、风险定性、额度、利率和条件均来自人工输入。</p>
    <div class="fact-note warning"><strong>数据可比性提示：</strong>${escapeHtml(human.dataScopeAcknowledgement.statement)} ${sourceChip("DQ-RESTATEMENT-SCOPE", "derived")}</div>
  </section>

  <section id="sec-01-borrower-evaluation" data-anchor="sec-01-borrower-evaluation" data-evidence="EVD-AR2025-IDENTITY,SIM_MEMBER_REGISTRY">
    <h2>第一部分 借款人评价</h2>
    <h3>一、借款人基本情况</h3>
    <p>${escapeHtml(borrower.fullName)}（简称“${escapeHtml(borrower.shortName)}”，A股代码${borrower.aShareCode}，H股代码${borrower.hShareCode}）成立于${borrower.establishedDate}，统一社会信用代码${borrower.unifiedSocialCreditCode}，注册资本${money(borrower.registeredCapital.value)}万元，法定代表人为${escapeHtml(borrower.legalRepresentative)}，注册地址为${escapeHtml(borrower.registeredAddress)}。控股股东为${escapeHtml(borrower.controllingShareholder)}，实际控制人为${escapeHtml(borrower.ultimateController)}。${sourceChip("2025年报", "official")}</p>
    <table>
      <thead><tr><th>项目</th><th>核验结果</th><th>时点</th><th>来源</th></tr></thead>
      <tbody>
        <tr><td>集团成员资格</td><td>ACTIVE</td><td>2026-08-15</td><td>${sourceChip("SIM_MEMBER_REGISTRY", "synthetic")}</td></tr>
        <tr><td>借款人稳定身份</td><td>BORR-CN-USCC-91440300093677087R</td><td>2025-12-31</td><td>${sourceChip("official-public", "official")}</td></tr>
        <tr><td>控股股东持股</td><td>58.89%</td><td>2025-12-31</td><td>${sourceChip("EVD-AR2025-OWNERSHIP", "official")}</td></tr>
        <tr><td>贷款产品适格性</td><td>CNY / 12个月 / 流动资金 / 信用</td><td>2026-08-15</td><td>${sourceChip("RULE-S004-LOAN-MINIMUM-SCOPE", "derived")}</td></tr>
      </tbody>
    </table>
    <div class="fact-note"><strong>调查边界：</strong>${escapeHtml(borrower.businessBoundary)}。报告中的“财务公司”为正式业务主体，“借款人”为集团成员单位。</div>
  </section>

  <section id="sec-02-operations" data-anchor="sec-02-operations" data-evidence="EVD-AR2025-OPERATIONS,SIM_SITE_SURVEY">
    <h2>第二部分 借款人经营情况</h2>
    <h3>一、经营基本情况</h3>
    <p>借款人以核能发电为核心业务，是中国广核集团核电运营上市平台。截至2025年末，公司管理在运核电机组28台、装机容量31,838MW；管理在建机组20台、容量24,222MW。2025年管理机组上网电量2,326.48亿千瓦时。${sourceChip("2025年报", "official")}</p>
    <h3>二、主要业务与市场结构</h3>
    <p>电力销售是借款人的核心收入来源，核电业务具有高资本投入、长建设周期和运行安全要求高等特征。2025年广东地区营业收入占比49.38%，区域收入集中度构成持续关注项。该表述不将中国广核集团其他新能源平台业务并入借款人合并范围。${sourceChip("FACT-S004-OPS-006", "official")}</p>
    <h3>三、现场调查与用途资料</h3>
    <p>2026年8月12日完成演示现场调查。模拟资料显示，借款人主体及主要经营场所与登记信息一致，申请用途资料金额覆盖本次申请，且现场材料未替代年报已有财务事实。${sourceChip("SIM_SITE_SURVEY", "synthetic")}</p>
    <div class="fact-note human-note"><strong>人工调查意见：</strong>${escapeHtml(human.investigationOpinion.statement)} ${sourceChip("HUMAN_INVESTIGATION_OPINION", "human")}</div>
  </section>

  <section id="sec-03-financial" class="section-page" data-anchor="sec-03-financial" data-evidence="C008-S004-AUTHORITATIVE-FACTS-001,MTR-S004-20260815-0001">
    <h2>第三部分 借款人财务情况</h2>
    <h3>一、基本财务情况</h3>
    <table>
      <thead><tr><th>项目（万元）</th><th class="number">2024重述</th><th class="number">2025</th><th>变化/说明</th></tr></thead>
      <tbody>
        <tr><td>资产总计</td><td class="number">${money(financial2024.totalAssets)}</td><td class="number">${money(financial2025.totalAssets)}</td><td>增长7.24%</td></tr>
        <tr><td>负债合计</td><td class="number">${money(financial2024.totalLiabilities)}</td><td class="number">${money(financial2025.totalLiabilities)}</td><td>资产负债率65.15%</td></tr>
        <tr><td>流动资产 / 流动负债</td><td class="number">${money(financial2024.currentAssets)} / ${money(financial2024.currentLiabilities)}</td><td class="number">${money(financial2025.currentAssets)} / ${money(financial2025.currentLiabilities)}</td><td>流动比率0.66</td></tr>
        <tr><td>营业收入</td><td class="number">${money(financial2024.revenue)}</td><td class="number">${money(financial2025.revenue)}</td><td>同比下降4.11%</td></tr>
        <tr><td>净利润</td><td class="number">${money(financial2024.netProfit)}</td><td class="number">${money(financial2025.netProfit)}</td><td>同比下降15.67%</td></tr>
        <tr><td>经营活动现金流量净额</td><td class="number">${money(financial2024.operatingCashFlow)}</td><td class="number">${money(financial2025.operatingCashFlow)}</td><td>2025年约299.71亿元</td></tr>
        <tr><td>在建工程</td><td class="number">${money(financial2024.constructionInProgress)}</td><td class="number">${money(financial2025.constructionInProgress)}</td><td>资本支出压力持续</td></tr>
        <tr><td>短期借款</td><td class="number">-</td><td class="number">${money(financial2025.shortTermBorrowings)}</td><td>需持续跟踪集中到期压力</td></tr>
      </tbody>
    </table>
    <h3>二、确定性财务指标</h3>
    <table>
      <thead><tr><th>指标</th><th>结果</th><th>Metric ID</th><th>信号</th></tr></thead>
      <tbody>${metricTableRows}</tbody>
    </table>
    <p class="meta-line">以上指标由 M01 确定性 Metric 引擎按 Published 数据计算；Agent不读取工作簿、不选择“最新数据”、不重算正式指标。</p>
    <h3>三、资金需求分析</h3>
    <table>
      <thead><tr><th>计算项</th><th class="number">金额（万元）</th><th>来源/口径</th></tr></thead>
      <tbody>
        <tr><td>营运资金量</td><td class="number">${money(metric("MET-WORKING-CAPITAL-NEED")?.displayValue)}</td><td>S004-FUNDING-V2-FULL-PRECISION</td></tr>
        <tr><td>减：货币资金</td><td class="number">${money(financial2025.cashAndBank)}</td><td>2025年报</td></tr>
        <tr><td>减：现有流动资金贷款</td><td class="number">${money(synthetic.workingCapitalFunding.existingWorkingCapitalLoans)}</td><td>SIM_LOAN_LEDGER</td></tr>
        <tr><td>减：其他渠道营运资金</td><td class="number">${money(synthetic.workingCapitalFunding.otherWorkingCapitalChannels)}</td><td>SIM_LOAN_LEDGER</td></tr>
        <tr><td><strong>新增流动资金贷款上限</strong></td><td class="number"><strong>${money(metric("MET-MAX-NEW-WORKING-CAPITAL-LOAN")?.displayValue)}</strong></td><td>确定性结果</td></tr>
        <tr><td>本次申请</td><td class="number">${money(loan.requestedAmount)}</td><td>金额规则 PASS；不等于审批通过</td></tr>
      </tbody>
    </table>
    <div class="fact-note warning"><strong>计算口径：</strong>${escapeHtml(human.calculationPolicyAcknowledgement.statement)} 历史样本的展示值中间舍入结果不作为本报告正式 Metric 版本。</div>
  </section>

  <section id="sec-04-risk" data-anchor="sec-04-risk" data-evidence="RULERUN-S004-20260815-0001,HCONF-S004-20260815-0001">
    <h2>第四部分 借款风险分析</h2>
    <p>以下主题由固定事实和确定性 Rule 信号形成，Agent只组织“关注事实—缓释事实—待跟踪项”的证据化表述。任何“风险可控”判断均须人工确认。</p>
    <div class="risk-grid">
      <article class="risk-card"><h4>一、偿债与流动性风险</h4><p>2025年资产负债率为65.15%，流动比率为0.66，短期借款421.51亿元，形成偿债与流动性关注信号。缓释事实为2025年经营现金流净额299.71亿元、EBIT利息保障倍数4.87倍。</p></article>
      <article class="risk-card"><h4>二、盈利与电价市场风险</h4><p>2025年营业收入和净利润分别下降4.11%和15.67%，主营业务利润率为30.80%；广东区域收入占比49.38%。需持续关注市场交易电价、检修节奏和区域集中度。</p></article>
      <article class="risk-card"><h4>三、资本支出与项目建设风险</h4><p>2025年在建工程1,139.31亿元，投资活动现金流净流出323.36亿元。核电建设周期长、资金投入大，项目进度与融资结构需持续监测。</p></article>
      <article class="risk-card"><h4>四、资料与演示数据风险</h4><p>成员资格、内部授信、征信、评级、用途合同、还款计划和现场调查均为synthetic-demo；2023跨期数据存在重述可比性限制。生产使用前必须替换并重新核验。</p></article>
    </div>
    <div class="fact-note human-note"><strong>人工风险复核：</strong>${escapeHtml(human.riskReview.statement)} ${sourceChip("human-input", "human")}</div>
  </section>

  <section id="sec-05-credit-conclusion" class="section-page" data-anchor="sec-05-credit-conclusion" data-evidence="HUMAN_CREDIT_DECISION,HCONF-S004-20260815-0001">
    <h2>第五部分 授信结论</h2>
    <div class="decision">
      <p><strong>人工确认结论：</strong>${escapeHtml(humanDecision.humanAuthoredConclusion)}</p>
      <p class="meta-line">本段由“最终授信决定人”于2026年8月15日确认；Agent、Metric、Rule和报告助手均未生成或改写该结论。</p>
    </div>
    <div class="term-grid">
      <div class="term"><small>申请金额</small><strong>${money(loan.requestedAmount)} 万元</strong></div>
      <div class="term"><small>人工批准金额</small><strong>${money(humanDecision.approvedAmount)} 万元</strong></div>
      <div class="term"><small>期限</small><strong>${humanDecision.termMonths} 个月</strong></div>
      <div class="term"><small>利率</small><strong>${percent(humanDecision.annualInterestRate)} 固定</strong></div>
      <div class="term"><small>担保方式</small><strong>信用</strong></div>
      <div class="term"><small>保证 / 抵质押</small><strong>NOT_APPLICABLE</strong></div>
    </div>
    <h3>人工设定的授信条件</h3>
    <ol class="conditions">${conditions}</ol>
    <div class="signature-grid">
      <div class="signature"><span>最终授信决定人</span>人工确认记录：${human.confirmationId}</div>
      <div class="signature"><span>报告复核与发布人</span>发布授权：${escapeHtml(human.publicationAuthorization.authorizedByRole)}</div>
    </div>
  </section>

  <section id="sec-06-data-sources" class="section-page" data-anchor="sec-06-data-sources">
    <h2>数据来源</h2>
    <h3>一、正式事实来源</h3>
    <table>
      <thead><tr><th>来源</th><th>期间</th><th>分类</th><th>SHA-256</th></tr></thead>
      <tbody>
        ${official.sourceDocuments.map((doc) => `<tr><td>${escapeHtml(doc.name)}</td><td>${doc.periodEnd}</td><td>${sourceChip("official-public", "official")}</td><td><code>${doc.sha256}</code></td></tr>`).join("")}
      </tbody>
    </table>
    <h3>二、模拟内部来源节点</h3>
    <p>${synthetic.sourceNodes.map((node) => sourceChip(node, "synthetic")).join(" ")}</p>
    <p>年报已经提供的财务事实没有另设上传型模拟数据；模拟节点仅补齐成员、申请、内部授信、融资、征信、评级、用途合同、还款计划和现场调查。</p>
    <h3>三、报告结构依据</h3>
    <p>正式章节结构参考用户提供的输出 DOCX 和同源 Markdown，仅继承结构，不沿用历史样本中的授信结论或风险定性。</p>
    <h3>四、稳定锚点与证据链</h3>
    <table class="appendix-table">
      <thead><tr><th>稳定锚点</th><th>Owner</th><th>主要事实/证据</th></tr></thead>
      <tbody>
        <tr><td><code>sec-01-borrower-evaluation</code></td><td>M06消费 / M01、M02提供</td><td>身份、股权、成员资格</td></tr>
        <tr><td><code>sec-02-operations</code></td><td>M06消费 / M02提供</td><td>经营事实、现场调查</td></tr>
        <tr><td><code>sec-03-financial</code></td><td>M06消费 / M01、M02提供</td><td>C008、Metric、资金需求</td></tr>
        <tr><td><code>sec-04-risk</code></td><td>M05起草 / M06人工复核</td><td>Rule信号、人工风险判断</td></tr>
        <tr><td><code>sec-05-credit-conclusion</code></td><td>M06人工输入</td><td>授信决定、额度、利率和条件</td></tr>
        <tr><td><code>sec-06-data-sources</code></td><td>M06</td><td>证据清单、来源版本和哈希</td></tr>
      </tbody>
    </table>
    <div class="fact-note"><strong>一期范围：</strong>正式产物为受控HTML和同源PDF；DOCX、电子签章、外部报送和复杂审批流未纳入。历史报告不会因数据、模板或Agent变化而原地更新。</div>
    <div class="end-mark">— 完 —</div>
  </section>
</doc-page>
<script id="report-control-metadata" type="application/json">${controlMetadata}</script>
<script>${docPageJs.replaceAll("</script>", "<\\/script>")}</script>
</body>
</html>`;

await fs.mkdir(reportDir, { recursive: true });
await fs.mkdir(pdfTmpDir, { recursive: true });
await fs.writeFile(htmlPath, html, "utf8");
await fs.writeFile(reportDataPath, `${JSON.stringify(reportData, null, 2)}\n`, "utf8");
await fs.writeFile(
  publicationManifestPath,
  `${JSON.stringify({
    schemaVersion: "ofw.s004.report-publication-manifest.v1",
    publicationId: "PUB-S004-20260815-0002",
    supersedesPublicationId: "PUB-S004-20260815-0001",
    owner: "M06",
    status: publicationStatus,
    publishedAt,
    scenarioContext: context,
    reportIdentity: {
      reportId,
      reportNumber,
      contentVersion,
      reportDefinitionId: definition.reportDefinitionId,
      evidencePackageId,
      sourceContentId: "RSRC-S004-20260815-0002"
    },
    changeReason: "修正封面打印页眉裁切；业务事实、人工授信结论、证据包和稳定锚点均未变化",
    formalOutputs: [
      { format: "CONTROLLED_HTML", file: `${reportBaseName}.html`, immutable: true },
      { format: "SAME_SOURCE_PDF", file: `${reportBaseName}.pdf`, immutable: true }
    ],
    stableAnchors: anchors,
    humanConfirmationId: human.confirmationId,
    verificationRunId: verification.verificationRunId,
    sameSourceRequired: true,
    inPlaceUpdateAllowed: false,
    docxOutput: "NOT_IN_PHASE_ONE"
  }, null, 2)}\n`,
  "utf8"
);

const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
await page.emulateMedia({ media: "print" });
await page.pdf({
  path: pdfPath,
  format: "A4",
  printBackground: true,
  preferCSSPageSize: false,
  displayHeaderFooter: true,
  headerTemplate: `<div></div>`,
  footerTemplate: `<div style="width:100%;font-size:8px;color:#657384;padding:0 13mm;display:flex;justify-content:space-between"><span>${reportNumber} · 内容版本 ${contentVersion} · ${evidencePackageId}</span><span><span class="pageNumber"></span>/<span class="totalPages"></span></span></div>`,
  margin: { top: "12mm", right: "0mm", bottom: "12mm", left: "0mm" }
});
await browser.close();

const [htmlBytes, pdfBytes] = await Promise.all([fs.readFile(htmlPath), fs.readFile(pdfPath)]);
const outputManifest = {
  schemaVersion: "ofw.s004.same-source-output.v1",
  reportId,
  reportNumber,
  contentVersion,
  evidencePackageId,
  publicationStatus,
  sourceHtmlRef: path.relative(scenarioDir, htmlPath),
  sourceHtmlSha256: crypto.createHash("sha256").update(htmlBytes).digest("hex"),
  pdfRef: path.relative(scenarioDir, pdfPath),
  pdfSha256: crypto.createHash("sha256").update(pdfBytes).digest("hex"),
  generatedFromSameHtml: true,
  stableAnchors: anchors,
  generatedAt: publishedAt
};
await fs.writeFile(path.join(reportDir, "same-source-output-v1.0.1.json"), `${JSON.stringify(outputManifest, null, 2)}\n`, "utf8");

console.log(JSON.stringify({ htmlPath, pdfPath, reportDataPath, publicationManifestPath, outputManifest }, null, 2));
