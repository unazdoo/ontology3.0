import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scenarioDir = path.resolve(__dirname, "..");
const outputDir = path.join(scenarioDir, "artifacts", "data");
const previewDir = path.join(scenarioDir, "tmp", "workbook-previews");
const outputPath = path.join(outputDir, "S004_贷前调查合成演示资料包.xlsx");

const COLORS = {
  navy: "#17324D",
  blue: "#235A93",
  blueSoft: "#EAF2FA",
  teal: "#2E776B",
  tealSoft: "#E9F5F2",
  amber: "#A36317",
  amberSoft: "#FFF4E1",
  red: "#A13D3D",
  redSoft: "#FCECEC",
  gray: "#5E6B78",
  graySoft: "#F3F5F7",
  line: "#D8DEE6",
  white: "#FFFFFF"
};

const workbook = Workbook.create();
workbook.comments.setSelf({ displayName: "User" });

function addSheet(name, widths = []) {
  const sheet = workbook.worksheets.add(name);
  sheet.showGridLines = false;
  if (widths.length) {
    widths.forEach((width, index) => {
      sheet.getCell(0, index).format.columnWidth = width;
    });
  }
  return sheet;
}

function title(sheet, text, endCol) {
  sheet.mergeCells(`A1:${endCol}1`);
  const range = sheet.getRange(`A1:${endCol}1`);
  range.values = [[text]];
  range.format = {
    fill: COLORS.navy,
    font: { bold: true, color: COLORS.white, size: 16 },
    verticalAlignment: "center"
  };
  range.format.rowHeight = 32;
}

function header(sheet, rangeAddress) {
  const range = sheet.getRange(rangeAddress);
  range.format = {
    fill: COLORS.blue,
    font: { bold: true, color: COLORS.white },
    borders: { preset: "all", style: "thin", color: COLORS.line },
    verticalAlignment: "center",
    wrapText: true
  };
  range.format.rowHeight = 28;
}

function body(sheet, rangeAddress, options = {}) {
  const range = sheet.getRange(rangeAddress);
  range.format = {
    font: { color: "#1F2933" },
    borders: { preset: "inside", style: "thin", color: COLORS.line },
    verticalAlignment: "top",
    wrapText: options.wrap !== false
  };
  if (options.numberFormat) range.format.numberFormat = options.numberFormat;
}

function addStatusFormatting(sheet, address) {
  const range = sheet.getRange(address);
  range.conditionalFormats.add("containsText", {
    text: "PASS",
    format: { fill: COLORS.tealSoft, font: { bold: true, color: COLORS.teal } }
  });
  range.conditionalFormats.add("containsText", {
    text: "WARNING",
    format: { fill: COLORS.amberSoft, font: { bold: true, color: COLORS.amber } }
  });
  range.conditionalFormats.add("containsText", {
    text: "FAIL",
    format: { fill: COLORS.redSoft, font: { bold: true, color: COLORS.red } }
  });
}

// 1. 说明与索引
{
  const s = addSheet("说明与索引", [24, 30, 34, 62]);
  title(s, "S004 财务公司贷款贷前调查 - 合成演示资料包", "D");
  s.getRange("A3:D10").values = [
    ["字段", "值", "分类", "说明"],
    ["场景", "S004 / S004-v1", "场景身份", "父基线 v1.0.3；独立运行和数据命名空间"],
    ["业务主体", "集团财务公司（演示）", "synthetic-demo", "正式业务角色为财务公司；不是商业银行"],
    ["借款人", "中国广核电力股份有限公司", "official-public", "仅限集团成员单位，本演示通过成员名录节点核验"],
    ["申请", "100,000.00 万元 / 人民币 / 12个月 / 流动资金信用贷款", "synthetic-demo", "保证人与抵质押均为 NOT_APPLICABLE"],
    ["正式产物", "受控 HTML + 同源 PDF", "范围", "共享报告编号、内容版本、证据链、稳定锚点和发布状态"],
    ["数据原则", "年报事实不重复模拟上传", "质量边界", "公开年报作为共享资料来源；内部缺口由模拟管道节点补齐"],
    ["人工边界", "最终授信结论必须人工确认", "human-input", "Agent 不计算、不审批、不发布、不创建 Action Request"],
    ["演示声明", "仅用于产品原型与合同联调", "限制", "不得作为真实授信调查或信贷决策依据"]
  ];
  header(s, "A3:D3");
  body(s, "A4:D11");
  s.freezePanes.freezeRows(3);
}

// 2. 来源与版本
{
  const s = addSheet("来源与版本", [20, 42, 19, 15, 15, 28, 70, 70]);
  title(s, "来源、版本与证据登记", "H");
  s.getRange("A3:H9").values = [
    ["来源ID", "资料名称", "来源分类", "期间/时点", "敏感性", "SHA-256", "本地引用", "用途"],
    ["SRC-AR-2023", "中国广核2023年年度报告", "official-public", "2023年度", "公开", "ad61895a8117b7c9129bb28483816f4f5d60b346245bd3a8a09d5c22e62f5d67", "/Users/domi/Public/Vibecoding/ontology2.0/ai 竞赛资料/贷前调查报告/贷前调查报告skill_20260812/输入材料/中国广核2023年报.pdf", "原始披露参考；跨年趋势受后续重述影响"],
    ["SRC-AR-2024", "中国广核2024年年度报告", "official-public", "2024年度", "公开", "c379d7a62bb0fb8c0c5ceeba34f1ca9c806ee2ceb1b53bfcbf6c6f22076f9d5e", "/Users/domi/Public/Vibecoding/ontology2.0/ai 竞赛资料/贷前调查报告/贷前调查报告skill_20260812/输入材料/中国广核2024年报.pdf", "原始披露参考；正式比较采用2025年报重述数"],
    ["SRC-AR-2025", "中国广核2025年年度报告", "official-public", "2025年度/2025-12-31", "公开", "f1ae0b9f53db25faf937d38be0abcee756ea7c8b58c29635aee0335a87904206", "/Users/domi/Public/Vibecoding/ontology2.0/ai 竞赛资料/贷前调查报告/贷前调查报告skill_20260812/输入材料/中国广核2025年报.pdf", "2025事实及2024重述比较期的主要权威来源"],
    ["SRC-TPL-MD", "中国广核贷前调查报告_新结构v1.md", "report-structure", "2026-08-12", "内部", "a929fa629804ba688b5ed928782ca8b17846a6422d6403ea9e2553c466175ef7", "/Users/domi/Public/Vibecoding/ontology2.0/ai 竞赛资料/贷前调查报告/贷前调查报告skill_20260812/输出报告/中国广核贷前调查报告_新结构v1.md", "仅作为正式报告章节结构，不继承历史授信结论"],
    ["SRC-TPL-DOCX", "中国广核贷前调查报告_工商信息版.docx", "completed-sample", "2026-08-12", "内部", "dcdaac53d7ec62d8f7f65d5edd4b2932b5cb4d219bdd5e8927d7c3cb292974e1", "/Users/domi/Public/Vibecoding/ontology2.0/ai 竞赛资料/贷前调查报告/贷前调查报告skill_20260812/输出报告/中国广核贷前调查报告_工商信息版.docx", "样本和版式参考；DOCX不纳入一期正式产物"],
    ["SRC-SIM-BUNDLE", "S004 合成演示内部资料", "synthetic-demo", "2026-08-15", "受控内部", "由场景构建时生成", "本工作簿及场景 JSON", "成员、申请、内部授信、征信、评级、用途、还款、现场调查与人工意见"]
  ];
  header(s, "A3:H3");
  body(s, "A4:H9");
  s.freezePanes.freezeRows(3);
}

// 3. 借款人与成员
{
  const s = addSheet("借款人与成员", [25, 42, 22, 25, 56]);
  title(s, "借款人身份与集团成员资格", "E");
  s.getRange("A3:E13").values = [
    ["字段", "值", "来源分类", "证据/节点", "质量说明"],
    ["借款人ID", "BORR-CN-USCC-91440300093677087R", "official-public", "SRC-AR-2025", "稳定键"],
    ["统一社会信用代码", "91440300093677087R", "official-public", "SRC-AR-2025", "稳定主体身份"],
    ["借款人名称", "中国广核电力股份有限公司", "official-public", "SRC-AR-2025", "与年报一致"],
    ["A股代码", "003816.SZ", "official-public", "SRC-AR-2025", "辅助身份"],
    ["H股代码", "1816.HK", "official-public", "SRC-AR-2025", "辅助身份"],
    ["控股股东", "中国广核集团有限公司", "official-public", "SRC-AR-2025", "持股58.89%"],
    ["实际控制人", "国务院国资委", "official-public", "SRC-AR-2025", "中央企业控制"],
    ["成员ID", "MEM-CGN-003816", "synthetic-demo", "SIM_MEMBER_REGISTRY", "内部成员名录稳定键"],
    ["成员状态", "ACTIVE", "synthetic-demo", "SIM_MEMBER_REGISTRY", "截至2026-08-15有效"],
    ["财务公司主体", "集团财务公司（演示）", "synthetic-demo", "FC-DEMO-001", "正式业务角色=财务公司"]
  ];
  header(s, "A3:E3");
  body(s, "A4:E13");
  s.freezePanes.freezeRows(3);
}

// 4. 贷款申请
{
  const s = addSheet("贷款申请", [26, 42, 20, 26, 58]);
  title(s, "贷款申请与产品条件", "E");
  s.getRange("A3:E16").values = [
    ["字段", "值", "单位/枚举", "来源节点", "核验要求"],
    ["申请编号", "APP-S004-20260815-0001", "稳定键", "SIM_LOAN_APPLICATION", "与报告编号关联"],
    ["申请日期", new Date("2026-08-15T00:00:00+08:00"), "日期", "SIM_LOAN_APPLICATION", "不得晚于调查日期"],
    ["申请金额", 100000, "万元", "SIM_LOAN_APPLICATION", "不得超过资金需求上限及可用授信"],
    ["币种", "CNY", "枚举", "SIM_LOAN_APPLICATION", "一期固定人民币"],
    ["期限", 12, "月", "SIM_LOAN_APPLICATION", "一期固定一年期"],
    ["产品", "流动资金贷款", "WORKING_CAPITAL", "SIM_LOAN_APPLICATION", "与用途合同一致"],
    ["担保方式", "信用", "CREDIT", "SIM_LOAN_APPLICATION", "不得误生成保证/抵质押"],
    ["保证人", "NOT_APPLICABLE", "枚举", "SIM_LOAN_APPLICATION", "显式N/A"],
    ["抵质押物", "NOT_APPLICABLE", "枚举", "SIM_LOAN_APPLICATION", "显式N/A"],
    ["建议年利率", 0.0235, "%", "SIM_LOAN_APPLICATION", "最终由有权审批人确认"],
    ["用途", "核电运营相关日常经营周转，包括核燃料、备品备件及运维服务采购", "文本", "SIM_LOAN_APPLICATION", "需与合同和支付凭证核对"],
    ["申请状态", "SUBMITTED", "枚举", "SIM_LOAN_APPLICATION", "不等于审批通过"]
  ];
  header(s, "A3:E3");
  body(s, "A4:E16");
  s.getRange("B5").format.numberFormat = "yyyy-mm-dd";
  s.getRange("B6").format.numberFormat = "#,##0.00";
  s.getRange("B13").format.numberFormat = "0.00%";
  s.freezePanes.freezeRows(3);
}

// 5. 财务报表
{
  const s = addSheet("财务报表", [32, 18, 18, 18, 18, 23, 23, 34]);
  title(s, "财务报表事实（单位：万元，合并口径）", "H");
  s.getRange("A3:H29").values = [
    ["项目", "2023", "2024重述", "2025", "单位", "2023口径", "2024/2025口径", "证据"],
    ["资产总计", null, 47153259.85, 50565611.81, "万元", "不可比/未补全重述", "CONSOLIDATED/RESTATED", "SRC-AR-2025"],
    ["负债合计", null, null, 32944179.09, "万元", "不可比/未补全重述", "CONSOLIDATED/CURRENT", "SRC-AR-2025"],
    ["流动资产合计", null, 7271136.99, 7789145.50, "万元", "不可比/未补全重述", "CONSOLIDATED/RESTATED", "SRC-AR-2025"],
    ["流动负债合计", null, 8270005.68, 11776215.54, "万元", "不可比/未补全重述", "CONSOLIDATED/RESTATED", "SRC-AR-2025"],
    ["归母所有者权益", null, 12858513.07, 12318847.41, "万元", "不可比/未补全重述", "CONSOLIDATED/RESTATED", "SRC-AR-2025"],
    ["所有者权益合计", null, null, 17621432.72, "万元", "不可比/未补全重述", "CONSOLIDATED/CURRENT", "SRC-AR-2025"],
    ["货币资金", null, 1702629.62, 2082672.08, "万元", "不可比/未补全重述", "CONSOLIDATED/RESTATED", "SRC-AR-2025"],
    ["应收账款", null, 910706.99, 801224.72, "万元", "不可比/未补全重述", "CONSOLIDATED/RESTATED", "SRC-AR-2025"],
    ["预付款项", null, 2007754.94, 2049288.02, "万元", "不可比/未补全重述", "CONSOLIDATED/RESTATED", "SRC-AR-2025"],
    ["存货", null, 2035016.38, 2242189.15, "万元", "不可比/未补全重述", "CONSOLIDATED/RESTATED", "SRC-AR-2025"],
    ["固定资产", null, null, 25243303.06, "万元", "不可比/未补全重述", "CONSOLIDATED/CURRENT", "SRC-AR-2025"],
    ["在建工程", null, 8505150.57, 11393091.07, "万元", "不可比/未补全重述", "CONSOLIDATED/RESTATED", "SRC-AR-2025"],
    ["短期借款", null, null, 4215111.99, "万元", "不可比/未补全重述", "CONSOLIDATED/CURRENT", "SRC-AR-2025"],
    ["应付账款", null, 2060085.47, 2023660.11, "万元", "不可比/未补全重述", "CONSOLIDATED/RESTATED", "SRC-AR-2025"],
    ["合同负债", null, 558332.03, 639516.87, "万元", "不可比/未补全重述", "CONSOLIDATED/RESTATED", "SRC-AR-2025"],
    ["营业收入", 8254864.32, 7894466.96, 7569655.90, "万元", "AS_REPORTED", "CONSOLIDATED/RESTATED", "SRC-AR-2023; SRC-AR-2025"],
    ["营业成本", 5285762.31, 4939583.61, 5147896.37, "万元", "AS_REPORTED", "CONSOLIDATED/RESTATED", "SRC-AR-2023; SRC-AR-2025"],
    ["税金及附加", 87527.03, 91507.43, 90184.70, "万元", "AS_REPORTED", "CONSOLIDATED/RESTATED", "SRC-AR-2023; SRC-AR-2025"],
    ["利息费用", 575995.42, 552469.19, 480174.42, "万元", "AS_REPORTED", "CONSOLIDATED/RESTATED", "SRC-AR-2023; SRC-AR-2025"],
    ["利润总额", 2053056.32, 2162761.68, 1860271.52, "万元", "AS_REPORTED", "CONSOLIDATED/RESTATED", "SRC-AR-2023; SRC-AR-2025"],
    ["净利润", 1704577.16, 1746813.06, 1473114.42, "万元", "AS_REPORTED", "CONSOLIDATED/RESTATED", "SRC-AR-2023; SRC-AR-2025"],
    ["归母净利润", 1072457.01, 1083812.04, 976535.90, "万元", "AS_REPORTED", "CONSOLIDATED/RESTATED", "SRC-AR-2023; SRC-AR-2025"],
    ["经营活动现金流量净额", 3311989.43, 3750572.80, 2997052.94, "万元", "AS_REPORTED", "CONSOLIDATED/RESTATED", "SRC-AR-2023; SRC-AR-2025"],
    ["投资活动现金流量净额", -1251261.37, -3244829.33, -3233554.86, "万元", "AS_REPORTED", "CONSOLIDATED/RESTATED", "SRC-AR-2023; SRC-AR-2025"],
    ["筹资活动现金流量净额", -1908823.80, -665643.42, 667689.47, "万元", "AS_REPORTED", "CONSOLIDATED/RESTATED", "SRC-AR-2023; SRC-AR-2025"]
  ];
  header(s, "A3:H3");
  body(s, "A4:H29");
  s.getRange("B4:D29").format.numberFormat = "#,##0.00;[Red]-#,##0.00";
  s.freezePanes.freezeRows(3);
  s.freezePanes.freezeColumns(1);
}

// 6. 指标与规则
{
  const s = addSheet("指标与规则", [30, 46, 22, 20, 20, 46]);
  title(s, "确定性 Metric、资金需求与 Rule 结果", "F");
  s.getRange("A3:F24").values = [
    ["Metric/Rule", "公式/口径", "2025结果", "展示单位", "状态", "解释边界"],
    ["资产负债率", "负债合计/资产总计", null, "%", "ATTENTION", "较高仅形成关注，不自动拒绝"],
    ["流动比率", "流动资产/流动负债", null, "倍", "ATTENTION", "低于1仅形成关注"],
    ["EBIT/利息", "(利润总额+利息费用)/利息费用", null, "倍", "PASS", "确定性计算"],
    ["主营业务利润率", "(营业收入-营业成本-税金及附加)/营业收入", null, "%", "PASS", "确定性计算"],
    ["总资产报酬率", "(利润总额+利息费用)/平均总资产", null, "%", "PASS", "确定性计算"],
    ["净资产收益率", "归母净利润/平均归母权益", null, "%", "PASS", "确定性计算"],
    ["存货周转率", "营业成本/平均存货", null, "次", "PASS", "确定性计算"],
    ["应收账款周转率", "营业收入/平均应收账款", null, "次", "PASS", "确定性计算"],
    ["总资产周转率", "营业收入/平均总资产", null, "次", "PASS", "确定性计算"],
    ["流动资产周转率", "营业收入/平均流动资产", null, "次", "PASS", "确定性计算"],
    ["总资产增长率", "本期总资产/重述上期总资产-1", null, "%", "PASS", "确定性计算"],
    ["净资产增长率", "本期归母权益/重述上期归母权益-1", null, "%", "ATTENTION", "下降仅形成关注"],
    ["净利润增长率", "本期净利润/重述上期净利润-1", null, "%", "ATTENTION", "下降仅形成关注"],
    ["销售收入增长率", "本期收入/重述上期收入-1", null, "%", "ATTENTION", "下降仅形成关注"],
    ["营运资金周转次数", "360/全精度营运资金周转天数", null, "次", "PASS", "中间过程不舍入"],
    ["营运资金量", "收入×(1-利润率)×(1+增长率)/周转次数", null, "万元", "PASS", "S004-FUNDING-V2-FULL-PRECISION"],
    ["新增流贷上限", "营运资金量-货币资金-现有流贷-其他渠道", null, "万元", "PASS", "现有流贷12亿元、其他渠道3亿元为模拟数据"],
    ["申请金额规则", "申请金额<=新增流贷上限", null, "布尔", "PASS", "通过不等于同意授信"],
    ["内部额度规则", "申请金额<=内部可用额度", null, "布尔", "PASS", "通过不等于同意授信"],
    ["成员资格规则", "memberStatus=ACTIVE", 1, "布尔", "PASS", "借款人限定集团成员单位"]
  ];
  header(s, "A3:F3");
  body(s, "A4:F24");
  s.getRange("C4").formulas = [["='财务报表'!D5/'财务报表'!D4"]];
  s.getRange("C5").formulas = [["='财务报表'!D6/'财务报表'!D7"]];
  s.getRange("C6").formulas = [["=('财务报表'!D23+'财务报表'!D22)/'财务报表'!D22"]];
  s.getRange("C7").formulas = [["=('财务报表'!D19-'财务报表'!D20-'财务报表'!D21)/'财务报表'!D19"]];
  s.getRange("C8").formulas = [["=('财务报表'!D23+'财务报表'!D22)/AVERAGE('财务报表'!C4:'财务报表'!D4)"]];
  s.getRange("C9").formulas = [["='财务报表'!D25/AVERAGE('财务报表'!C8:'财务报表'!D8)"]];
  s.getRange("C10").formulas = [["='财务报表'!D20/AVERAGE('财务报表'!C13:'财务报表'!D13)"]];
  s.getRange("C11").formulas = [["='财务报表'!D19/AVERAGE('财务报表'!C11:'财务报表'!D11)"]];
  s.getRange("C12").formulas = [["='财务报表'!D19/AVERAGE('财务报表'!C4:'财务报表'!D4)"]];
  s.getRange("C13").formulas = [["='财务报表'!D19/AVERAGE('财务报表'!C6:'财务报表'!D6)"]];
  s.getRange("C14").formulas = [["='财务报表'!D4/'财务报表'!C4-1"]];
  s.getRange("C15").formulas = [["='财务报表'!D8/'财务报表'!C8-1"]];
  s.getRange("C16").formulas = [["='财务报表'!D24/'财务报表'!C24-1"]];
  s.getRange("C17").formulas = [["='财务报表'!D19/'财务报表'!C19-1"]];
  s.getRange("C18").formulas = [["=360/(360/C10+360/C11-360/('财务报表'!D20/AVERAGE('财务报表'!C17:'财务报表'!D17))+360/('财务报表'!D20/AVERAGE('财务报表'!C12:'财务报表'!D12))-360/('财务报表'!D19/AVERAGE('财务报表'!C18:'财务报表'!D18)))"]];
  s.getRange("C19").formulas = [["='财务报表'!D19*(1-C7)/C18"]];
  s.getRange("C20").formulas = [["=C19-'财务报表'!D10-120000-30000"]];
  s.getRange("C21").formulas = [["=100000<=C20"]];
  s.getRange("C22").formulas = [["=100000<=180000"]];
  s.getRange("C4:C5").format.numberFormat = "0.00%";
  s.getRange("C6").format.numberFormat = "0.00";
  s.getRange("C7:C9").format.numberFormat = "0.00%";
  s.getRange("C10:C13").format.numberFormat = "0.00";
  s.getRange("C14:C17").format.numberFormat = "0.00%";
  s.getRange("C18").format.numberFormat = "0.0000";
  s.getRange("C19:C20").format.numberFormat = "#,##0.00";
  addStatusFormatting(s, "E4:E24");
  s.freezePanes.freezeRows(3);
}

// 7. 股权关系
{
  const s = addSheet("股权关系", [29, 39, 20, 20, 23, 48]);
  title(s, "股权关系与控制链", "F");
  s.getRange("A3:F9").values = [
    ["主体", "关系方", "关系", "比例", "来源", "核验说明"],
    ["中国广核电力股份有限公司", "中国广核集团有限公司", "控股股东", 0.5889, "SRC-AR-2025", "控股关系明确"],
    ["中国广核电力股份有限公司", "国务院国资委", "实际控制", null, "SRC-AR-2025", "最终控制人为国务院国资委"],
    ["中国广核电力股份有限公司", "广东恒健投资控股有限公司", "主要股东", 0.0679, "SRC-AR-2025", "公开披露"],
    ["中国广核电力股份有限公司", "香港中央结算有限公司", "主要股东", 0.1415, "SRC-AR-2025", "公开披露"],
    ["中国广核电力股份有限公司", "集团财务公司（演示）", "集团成员服务关系", null, "SIM_MEMBER_REGISTRY", "仅用于财务公司成员资格核验"]
  ];
  header(s, "A3:F3");
  body(s, "A4:F9");
  s.getRange("D4:D7").format.numberFormat = "0.00%";
}

// 8. 内部授信与融资
{
  const s = addSheet("内部授信与融资", [28, 22, 18, 18, 24, 58]);
  title(s, "内部授信、用信与历史融资（模拟）", "F");
  s.getRange("A3:F11").values = [
    ["项目", "金额", "单位", "时点", "来源节点", "说明"],
    ["内部批准额度", 300000, "万元", "2026-08-15", "SIM_INTERNAL_CREDIT", "演示内部额度"],
    ["已用额度", 120000, "万元", "2026-08-15", "SIM_INTERNAL_CREDIT", "演示已用"],
    ["可用额度", 180000, "万元", "2026-08-15", "SIM_INTERNAL_CREDIT", "批准额度-已用额度"],
    ["现有流动资金贷款", 120000, "万元", "2026-08-14", "SIM_LOAN_LEDGER", "资金需求扣减项"],
    ["其他渠道营运资金", 30000, "万元", "2026-08-14", "SIM_LOAN_LEDGER", "资金需求扣减项"],
    ["本次申请", 100000, "万元", "2026-08-15", "SIM_LOAN_APPLICATION", "未审批"],
    ["人工批准金额", 50000, "万元", "2026-08-15", "HUMAN_CREDIT_DECISION", "演示有权审批人确认；非Agent结论"]
  ];
  header(s, "A3:F3");
  body(s, "A4:F11");
  s.getRange("B4:B11").format.numberFormat = "#,##0.00";
}

// 9. 征信与评级
{
  const s = addSheet("征信与评级", [28, 28, 20, 24, 58]);
  title(s, "征信摘要与内部评级（模拟）", "E");
  s.getRange("A3:E11").values = [
    ["项目", "值", "时点/有效期", "来源节点", "核验说明"],
    ["征信截至日", "2026-08-14", "截至日", "SIM_CREDIT_BUREAU", "模拟征信摘要"],
    ["当前逾期金额", 0, "万元", "SIM_CREDIT_BUREAU", "未见当前逾期"],
    ["24个月90天以上逾期次数", 0, "次", "SIM_CREDIT_BUREAU", "模拟值"],
    ["重大不良记录", "NONE_REPORTED", "截至2026-08-14", "SIM_CREDIT_BUREAU", "需以真实征信替换后方可用于生产"],
    ["内部评级", "AA+", "2026-07-01至2027-06-30", "SIM_INTERNAL_RATING", "模拟评级"],
    ["内部评分", 86, "分", "SIM_INTERNAL_RATING", "模拟评分"],
    ["评级状态", "VALID", "截至2026-08-15", "SIM_INTERNAL_RATING", "未过期"]
  ];
  header(s, "A3:E3");
  body(s, "A4:E11");
}

// 10. 用途合同与还款
{
  const s = addSheet("用途合同与还款", [29, 36, 22, 28, 58]);
  title(s, "用途合同、还款计划与资金闭环（模拟）", "E");
  s.getRange("A3:E13").values = [
    ["项目", "值", "单位/方式", "来源节点", "核验说明"],
    ["合格用途合同金额", 120000, "万元", "SIM_PURPOSE_CONTRACT", "覆盖申请金额"],
    ["合同用途", "核燃料、备品备件及运维服务采购", "文本", "SIM_PURPOSE_CONTRACT", "与贷款用途一致"],
    ["付款对象", "经财务公司白名单核验的供应商", "规则", "SIM_PURPOSE_CONTRACT", "支付前再核验"],
    ["本金偿还", "到期一次还本", "BULLET_AT_MATURITY", "SIM_REPAYMENT_PLAN", "期限12个月"],
    ["付息频率", "按季付息", "QUARTERLY", "SIM_REPAYMENT_PLAN", "演示条件"],
    ["主要还款来源", "核电运营收入和经营活动现金流", "文本", "SIM_REPAYMENT_PLAN", "2025经营现金流299.71亿元"],
    ["辅助还款来源", "自有货币资金及授信项下可调度资金", "文本", "SIM_REPAYMENT_PLAN", "不得自动推断为充分"],
    ["保证人", "NOT_APPLICABLE", "枚举", "SIM_LOAN_APPLICATION", "信用贷款"],
    ["抵质押物", "NOT_APPLICABLE", "枚举", "SIM_LOAN_APPLICATION", "信用贷款"]
  ];
  header(s, "A3:E3");
  body(s, "A4:E13");
  s.getRange("B4").format.numberFormat = "#,##0.00";
}

// 11. 现场调查
{
  const s = addSheet("现场调查", [26, 46, 24, 26, 58]);
  title(s, "现场调查与资料核对（模拟）", "E");
  s.getRange("A3:E12").values = [
    ["调查项", "结果", "状态", "来源节点", "人工边界"],
    ["调查日期", "2026-08-12", "COMPLETED", "SIM_SITE_SURVEY", "调查经办确认"],
    ["调查地点", "深圳总部（演示）", "COMPLETED", "SIM_SITE_SURVEY", "模拟资料"],
    ["经营连续性", "主营业务持续运营，未发现与年报披露明显冲突", "NO_CONFLICT_FOUND", "SIM_SITE_SURVEY", "需真实现场资料替换后用于生产"],
    ["用途合同", "合同金额和用途覆盖本次申请", "VERIFIED", "SIM_SITE_SURVEY", "支付前需复核"],
    ["征信与评级", "截至时点有效，未见当前逾期", "VERIFIED", "SIM_SITE_SURVEY", "模拟资料"],
    ["担保/抵质押", "NOT_APPLICABLE", "N/A", "SIM_SITE_SURVEY", "不得生成担保物评价"],
    ["资料差异", "2023/2024跨期重述口径存在可比性限制", "WARNING", "DATA_QUALITY", "数据/口径批准人确认"],
    ["调查意见状态", "HUMAN_CONFIRMED", "CONFIRMED", "HUMAN_INVESTIGATION_OPINION", "不得由Agent替代"]
  ];
  header(s, "A3:E3");
  body(s, "A4:E12");
  addStatusFormatting(s, "C4:C12");
}

// 12. 人工意见
{
  const s = addSheet("人工意见", [24, 28, 62, 22, 28]);
  title(s, "人工调查、口径批准、复核发布与最终授信决定", "E");
  s.getRange("A3:E9").values = [
    ["责任角色", "确认状态", "确认内容", "确认日期", "证据ID"],
    ["调查经办", "CONFIRMED", "成员资格、贷款用途、征信和现场资料已按演示夹具核对；建议提交人工审批。", "2026-08-15", "HUM-INV-001"],
    ["数据/口径批准", "CONFIRMED", "采用2025年报及2024重述比较期；2023趋势标记可比性受限；资金需求按全精度V2。", "2026-08-15", "HUM-DATA-001"],
    ["报告复核发布", "CONFIRMED", "HTML/PDF同源，事实锚点、证据包和确定性核验一致；演示发布允许。", "2026-08-15", "HUM-RVW-001"],
    ["最终有权审批人", "CONFIRMED", "同意演示授信50,000万元，12个月，固定年利率2.35%，信用方式；附用途与监测条件。", "2026-08-15", "HUM-APR-001"],
    ["Agent", "NOT_AUTHORIZED", "仅组织固定证据包中的分析文字，不决定额度、利率、风险可控性或发布。", "2026-08-15", "BOUNDARY-M05"],
    ["报告助手", "NOT_AUTHORIZED", "不得发布报告、修改本体、切换T019、执行Action或创建待办。", "2026-08-15", "BOUNDARY-M06"]
  ];
  header(s, "A3:E3");
  body(s, "A4:E9");
}

// 13. 数据质量
{
  const s = addSheet("数据质量", [30, 18, 54, 58, 38]);
  title(s, "数据质量、缺失、冲突、过期与不可核验状态", "E");
  s.getRange("A3:E11").values = [
    ["质量代码", "严重度", "问题", "处置", "发布影响"],
    ["MIXED_RESTATEMENT_SCOPE", "HIGH", "样本三年表混用了2023原始口径与2024重述口径，不能直接形成一致趋势。", "正式计算仅使用2025及2024重述数据；2023标记可比性受限。", "人工口径确认后允许演示发布"],
    ["FUNDING_INTERMEDIATE_ROUNDING", "MEDIUM", "样本以展示值中间舍入，营运资金量与全精度结果相差约221.03万元。", "锁定S004-FUNDING-V2-FULL-PRECISION，中间过程不舍入。", "已解决"],
    ["SYNTHETIC_INTERNAL_DATA", "HIGH", "成员、内部授信、征信、评级、用途合同、还款计划和现场调查为演示合成。", "全量标记synthetic-demo；生产前必须替换。", "仅允许演示发布"],
    ["NO_DUPLICATE_FINANCIAL_UPLOAD", "PASS", "年报已有财务事实不再创建上传型模拟财务报表。", "使用共享公开资料来源节点及哈希。", "通过"],
    ["GUARANTEE_COLLATERAL_NA", "PASS", "本案例为信用贷款，无保证、抵押或质押。", "保证和抵质押显式NOT_APPLICABLE。", "通过"],
    ["REPORT_STRUCTURE_ONLY", "PASS", "历史输出报告仅用于正式章节结构。", "不继承其中的历史授信结论和风险定性。", "通过"],
    ["DATA_CUTOFF", "PASS", "财务截至2025-12-31；内部资料截至2026-08-15。", "报告逐项展示时点。", "通过"]
  ];
  header(s, "A3:E3");
  body(s, "A4:E11");
  addStatusFormatting(s, "B4:B11");
}

// 14. Checks
{
  const s = addSheet("Checks", [36, 18, 24, 62]);
  title(s, "MODEL STATUS 与发布前控制检查", "D");
  s.getRange("A3:D15").values = [
    ["检查", "结果", "差异/值", "修复位置或说明"],
    ["MODEL STATUS", null, null, "仅表示工作簿内部控制，不代表场景验收"],
    ["申请金额不超过资金需求上限", null, null, "指标与规则!C20:C21"],
    ["申请金额不超过内部可用额度", null, null, "内部授信与融资"],
    ["借款人为ACTIVE集团成员", "PASS", "MEM-CGN-003816", "借款人与成员"],
    ["币种/期限/产品符合一期范围", "PASS", "CNY / 12M / WORKING_CAPITAL", "贷款申请"],
    ["保证与抵质押显式N/A", "PASS", "NOT_APPLICABLE", "贷款申请"],
    ["年报事实未重复模拟上传", "PASS", "共享来源节点", "来源与版本"],
    ["重述范围冲突显式披露", "PASS", "MIXED_RESTATEMENT_SCOPE", "数据质量"],
    ["资金需求采用全精度V2", "PASS", "S004-FUNDING-V2-FULL-PRECISION", "指标与规则"],
    ["最终授信结论来自人工确认", "PASS", "HUM-APR-001", "人工意见"],
    ["DOCX/签章/外报未纳入一期", "PASS", "范围边界", "说明与索引"],
    ["演示材料敏感性标记", "PASS", "synthetic-demo", "来源与版本"]
  ];
  header(s, "A3:D3");
  body(s, "A4:D15");
  s.getRange("B4").formulas = [["=IF(AND(B5=\"PASS\",B6=\"PASS\",COUNTIF(B7:B15,\"FAIL\")=0),\"PASS\",\"FAIL\")"]];
  s.getRange("B5").formulas = [["=IF('指标与规则'!C21=TRUE,\"PASS\",\"FAIL\")"]];
  s.getRange("C5").formulas = [["='指标与规则'!C20-100000"]];
  s.getRange("B6").formulas = [["=IF('指标与规则'!C22=TRUE,\"PASS\",\"FAIL\")"]];
  s.getRange("C6").formulas = [["=180000-100000"]];
  s.getRange("C5:C6").format.numberFormat = "#,##0.00";
  addStatusFormatting(s, "B4:B15");
  s.freezePanes.freezeRows(3);
}

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

const sheetNames = workbook.worksheets.items.map((sheet) => sheet.name);
for (const sheetName of sheetNames) {
  const preview = await workbook.render({
    sheetName,
    autoCrop: "all",
    scale: 1,
    format: "png"
  });
  const safeName = sheetName.replaceAll("/", "-");
  await fs.writeFile(
    path.join(previewDir, `${String(sheetNames.indexOf(sheetName) + 1).padStart(2, "0")}-${safeName}.png`),
    new Uint8Array(await preview.arrayBuffer())
  );
}

const keyRanges = [
  ["贷款申请", "A3:E16"],
  ["财务报表", "A3:H29"],
  ["指标与规则", "A3:F24"],
  ["Checks", "A3:D15"]
];

for (const [sheetName, range] of keyRanges) {
  const inspected = await workbook.inspect({
    kind: "table",
    range: `${sheetName}!${range}`,
    include: "values,formulas",
    tableMaxRows: 40,
    tableMaxCols: 10
  });
  await fs.writeFile(
    path.join(previewDir, `${sheetName}-inspect.ndjson`),
    inspected.ndjson,
    "utf8"
  );
}

const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "S004 final formula error scan"
});
await fs.writeFile(path.join(previewDir, "formula-errors.ndjson"), formulaErrors.ndjson, "utf8");

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);

console.log(JSON.stringify({ outputPath, previewDir, sheetNames, formulaErrors: formulaErrors.ndjson }, null, 2));
