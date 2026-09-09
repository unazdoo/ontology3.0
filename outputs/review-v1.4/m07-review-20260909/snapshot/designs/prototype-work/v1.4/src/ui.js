import {
  createIcons,
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BadgeCheck,
  Baseline,
  BellRing,
  Bookmark,
  Bot,
  Box,
  BoxSelect,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  Database,
  Download,
  Ellipsis,
  ExternalLink,
  Eye,
  Factory,
  FileChartColumn,
  FilePenLine,
  FilePlus2,
  FileText,
  Files,
  Filter,
  Fingerprint,
  GitCompareArrows,
  Globe2,
  History,
  Info,
  Landmark,
  Layers2,
  LayoutDashboard,
  Link2,
  ListChecks,
  ListPlus,
  ListRestart,
  Map,
  MessagesSquare,
  Minus,
  Network,
  Plus,
  RefreshCw,
  Route,
  Save,
  Scan,
  ScanLine,
  ScanSearch,
  ScatterChart,
  Search,
  SearchX,
  Share2,
  Sparkles,
  Square,
  Trash2,
  Undo,
  Undo2,
  UserRoundPen,
  View,
  WalletCards,
  Workflow,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide";
const icons = {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BadgeCheck,
  Baseline,
  BellRing,
  Bookmark,
  Bot,
  Box,
  BoxSelect,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  Database,
  Download,
  Ellipsis,
  ExternalLink,
  Eye,
  Factory,
  FileChartColumn,
  FilePenLine,
  FilePlus2,
  FileText,
  Files,
  Filter,
  Fingerprint,
  GitCompareArrows,
  Globe2,
  History,
  Info,
  Landmark,
  Layers2,
  LayoutDashboard,
  Link2,
  ListChecks,
  ListPlus,
  ListRestart,
  Map,
  MessagesSquare,
  Minus,
  Network,
  Plus,
  RefreshCw,
  Route,
  Save,
  Scan,
  ScanLine,
  ScanSearch,
  ScatterChart,
  Search,
  SearchX,
  Share2,
  Sparkles,
  Square,
  Trash2,
  Undo,
  Undo2,
  UserRoundPen,
  View,
  WalletCards,
  Workflow,
  X,
  ZoomIn,
  ZoomOut,
};
import { amount, fmt, percent, taskLabels } from "./domain.js";
export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
export const icon = (name) =>
  `<i data-lucide="${name}" aria-hidden="true"></i>`;
export const refreshIcons = () =>
  createIcons({ icons, attrs: { "stroke-width": 1.7 } });
export const tool = (action, glyph, label, extra = "") =>
  `<button class="icon-button" type="button" data-action="${action}" title="${esc(label)}" aria-label="${esc(label)}" ${extra}>${icon(glyph)}</button>`;
export const button = (action, text, glyph = "", primary = false, extra = "") =>
  `<button type="button" class="button${primary ? " primary" : ""}" data-action="${action}" title="${esc(text)}" ${extra}>${glyph ? icon(glyph) : ""}${esc(text)}</button>`;
export const badge = (text, tone = "") =>
  `<span class="badge ${tone}">${esc(text)}</span>`;
export const tierTone = (tier) =>
  ({ 红灯: "red", 黄灯: "amber", 绿灯: "green", 黑灯: "dark" })[tier] || "";
export const empty = (title, text = "") =>
  `<div class="empty-state">${icon("search-x")}<strong>${esc(title)}</strong>${text ? `<p>${esc(text)}</p>` : ""}</div>`;
export function facts(rows) {
  return `<dl class="facts">${rows.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${value}</dd></div>`).join("")}</dl>`;
}
export function objectButton(type, id, title, description = "", value = "") {
  return `<button class="linked-row" type="button" data-object-type="${type}" data-object-id="${esc(id)}"><span class="object-icon">${icon({ enterprise: "building-2", loan: "file-text", bank: "landmark", facility: "wallet-cards", guarantee: "link-2", project: "factory", event: "bell-ring", definition: "workflow" }[type] || "box")}</span><span><strong>${esc(title)}</strong>${description ? `<small>${esc(description)}</small>` : ""}</span><span class="row-value">${esc(value)}</span>${icon("chevron-right")}</button>`;
}
export function sourceDetails(evidence, data, title = "来源与口径") {
  return `<details class="evidence"><summary>${icon("fingerprint")}${title}</summary>${facts(
    [
      ["数据截至", esc(evidence.asOf || data.asOf)],
      [
        "数据版本",
        `<code>${esc(evidence.dataVersion || data.dataVersion)}</code>`,
      ],
      [
        "语义版本",
        `<code>${esc(evidence.ontologyVersion || data.ontologyVersion)}</code>`,
      ],
      ["展望窗口", evidence.horizon ? `${evidence.horizon}天` : "当前分析窗口"],
      [
        "对象范围",
        evidence.objectIds
          ? `${evidence.objectIds.length}家企业`
          : "当前分析对象",
      ],
      ["方案身份", `<code>${esc(evidence.planId || "基准")}</code>`],
      ...(evidence.rule
        ? [
            [
              "规则条件",
              esc(
                evidence.rule.condition ||
                  `成本偏离 > ${evidence.rule.premiumThreshold}bp`,
              ),
            ],
            ["规则身份", `<code>${esc(evidence.rule.id)}</code>`],
            ...(evidence.rule.ontologyId
              ? [
                  ["所属本体", `<code>${esc(evidence.rule.ontologyId)}</code>`],
                  ["修订草稿", `<code>${esc(evidence.rule.draftId)}</code>`],
                ]
              : []),
          ]
        : []),
      [
        "结果身份",
        esc(
          evidence.resultKind === "SIMULATION"
            ? "独立方案模拟"
            : "演示融资基准 / 历史风险评分",
        ),
      ],
      [
        "输入指纹",
        `<code>${esc((evidence.dataDigest || data.digest).slice(0, 20))}</code>`,
      ],
    ],
  )}<p>融资明细与位置为演示数据；历史风险评分单独引用，不由方案重算。</p></details>`;
}
export function reportHtml(report) {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(report.title)}</title><style>body{font:15px/1.7 system-ui,sans-serif;color:#243b36;max-width:1000px;margin:36px auto;padding:0 24px}h1{font-size:28px}h2{font-size:19px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px;border-bottom:1px solid #dce4de}th{background:#f1f5f2}p{white-space:pre-wrap}code{overflow-wrap:anywhere}small{color:#536d62}</style><h1>${esc(report.title)}</h1><small>${report.status === "REVIEWED" ? "已复核本地记录" : "待复核草稿"} · v${report.version || 1} · ${esc(report.createdAt)} · ${report.evidence.resultKind === "SIMULATION" ? "方案模拟" : "演示基准"}</small><p>${esc(report.notes)}</p><h2>当前范围</h2><p>${report.rows.length} 家企业 · 数据截至 ${esc(report.evidence.asOf)} · 展望 ${report.evidence.horizon} 天</p><table><thead><tr><th>企业</th><th>融资余额</th><th>融资成本</th><th>到期本金</th><th>测算缺口</th><th>历史风险</th></tr></thead><tbody>${report.rows.map((row) => `<tr><td>${esc(row.name)}</td><td>${amount(row.balance)}</td><td>${percent(row.cost)}</td><td>${amount(row.due)}</td><td>${amount(row.gap)}</td><td>${esc(row.riskTier)} / ${fmt(row.riskScore)}分</td></tr>`).join("")}</tbody></table><h2>合计</h2><p>融资余额 ${amount(report.totals.balance)}；余额加权成本 ${fmt(report.totals.cost)}%；到期本金 ${amount(report.totals.due)}；测算缺口 ${amount(report.totals.gap)}。</p>${report.plan ? `<h2>方案假设</h2><p>${esc(JSON.stringify(report.plan.parameters))}</p>` : ""}${report.review ? `<h2>复核记录</h2><p>${esc(report.review.reviewer)} · ${esc(report.review.at)}<br>${esc(report.review.note)}</p>` : ""}${report.evidence.rule ? `<h2>语义规则</h2><p>${esc(report.evidence.rule.condition || `成本偏离 > ${report.evidence.rule.premiumThreshold} bp`)} · ${esc(report.evidence.rule.id)}${report.evidence.rule.ontologyId ? `<br>所属本体 ${esc(report.evidence.rule.ontologyId)}<br>修订草稿 ${esc(report.evidence.rule.draftId)}` : ""}</p>` : ""}${(report.loans || []).length ? `<details><summary>固定借款快照 · ${report.loans.length} 笔 · ${report.plan ? "已应用方案参数" : "基准"}</summary><table><thead><tr><th>借款ID</th><th>企业ID</th><th>银行ID</th><th>本金</th><th>年利率</th><th>到期日</th></tr></thead><tbody>${report.loans.map((loan) => `<tr><td>${esc(loan.id)}</td><td>${esc(loan.enterpriseId)}</td><td>${esc(loan.bankId)}</td><td>${amount(loan.principal)}</td><td>${fmt(loan.rate, 4)}%</td><td>${esc(loan.maturityDate)}</td></tr>`).join("")}</tbody></table></details>` : ""}<h2>固定来源</h2><p>数据版本 ${esc(report.evidence.dataVersion)}<br>语义版本 ${esc(report.evidence.ontologyVersion)}<br>输入指纹 <code>${esc(report.evidence.dataDigest)}</code></p><p>融资明细、授信、担保与位置均为演示数据；三个主体融资总额与成本对齐既有快照。风险评分是独立历史引用。模拟、年化成本估计和事项状态均不代表银行批准、实际收益或正式风险变化。</p></html>`;
}
export function download(name, content, mime = "text/html;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
export function resultCsv(result) {
  const quote = (value) => {
    let text = String(value ?? "");
    if (/^[=+@\t\r-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return (
    "\uFEFF" +
    [
      [
        "企业ID",
        "企业",
        "融资余额(百万元)",
        "加权成本(%)",
        "到期本金(百万元)",
        "测算缺口(百万元)",
        "历史评分",
        "历史分档",
        "数据版本",
        "结果身份",
      ],
      ...result.rows.map((row) => [
        row.id,
        row.name,
        row.balance,
        row.cost,
        row.due,
        row.gap,
        row.riskScore,
        row.riskTier,
        result.dataVersion,
        result.resultKind,
      ]),
    ]
      .map((row) => row.map(quote).join(","))
      .join("\r\n")
  );
}
