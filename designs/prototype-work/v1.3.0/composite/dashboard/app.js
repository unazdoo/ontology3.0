(function () {
  "use strict";

  const DATA = window.DASHBOARD_DATA;
  const BASELINE_ROOT = "../../../../prototype-releases/v1.1.0";
  const API_BASE = new URLSearchParams(location.search).get("apiBase") || (() => { try { return new URLSearchParams(window.parent.location.search).get("m08ApiBase"); } catch (_) { return null; } })() || "http://127.0.0.1:4363";
  const app = document.getElementById("app");
  const toastRoot = document.getElementById("toast-root");
  if (!DATA) throw new Error("仪表盘数据未加载");

  const DEFAULT_STATE = {
    financeScopeType: "group",
    financeScopeId: "集团",
    financeCompare: ["单位553", "单位465", "单位561"],
    budgetScope: "全部单位",
    budgetExpanded: "",
    riskTier: "全部",
    riskSector: "全部产业",
    riskSort: "risk",
    riskSearch: "",
    riskModelingView: "formal",
    riskModelingSelection: {
      modelVersionId: "",
      asOf: "2025-12-31",
      dataVersionId: "S003-T007-FORMAL-CANDIDATE-20251231-v1",
      enterpriseScope: "ALL",
      useKind: "SHADOW",
    },
    riskActionStates: {},
    drawer: null,
  };
  const state = { ...DEFAULT_STATE };
  const S005_CONTEXT_FIELDS = ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"];
  const S005_DOMAIN_DEFINITIONS = Object.freeze([
    {
      id: "product-performance",
      sourceKey: "productPerformance",
      label: "产品自身表现",
      icon: "chart-no-axes-combined",
      metrics: [
        { key: "twr", label: "TWR", aliases: ["timeWeightedReturn"] },
        { key: "sharpe", label: "Sharpe", aliases: ["sharpeRatio"] },
        { key: "sortino", label: "Sortino", aliases: ["sortinoRatio"] },
        { key: "calmar", label: "Calmar", aliases: ["calmarRatio"] },
        { key: "information-ratio", label: "信息比率", aliases: ["informationRatio"] },
        { key: "volatility", label: "波动", aliases: ["annualizedVolatility"] },
        { key: "max-drawdown", label: "最大回撤", aliases: ["maxDrawdown"] },
        { key: "drawdown-recovery", label: "回撤恢复", aliases: ["drawdownRecovery"] },
      ],
    },
    {
      id: "actual-investment-result",
      sourceKey: "actualInvestorResult",
      label: "财务公司实际投资结果",
      icon: "landmark",
      metrics: [
        { key: "actual-twr", label: "实际投资 TWR", aliases: ["actualTwr"] },
        { key: "mwr-xirr", label: "MWR / XIRR", aliases: ["mwrXirr", "mwr", "xirr", "moneyWeightedReturn"] },
        { key: "realized-return", label: "已实现收益", aliases: ["realizedReturn", "realizedPnl"] },
        { key: "unrealized-return", label: "未实现收益", aliases: ["unrealizedReturn", "unrealizedPnl"] },
        { key: "cash-flow", label: "现金流", aliases: ["cashFlow", "cashFlows"] },
        { key: "fees", label: "费用", aliases: ["fee", "totalFees"] },
      ],
    },
    {
      id: "fixed-income-risk",
      sourceKey: "fixedIncomeRisk",
      label: "固定收益风险",
      icon: "shield-alert",
      metrics: [
        { key: "duration", label: "久期", aliases: ["modifiedDuration"] },
        { key: "rating-migration", label: "评级迁移", aliases: ["ratingMigration"] },
        { key: "concentration", label: "集中度", aliases: ["portfolioConcentration"] },
        { key: "liquidity", label: "流动性", aliases: ["liquidityRisk"] },
        { key: "carry-attribution", label: "Carry 归因", aliases: ["carry", "carryAttribution"] },
        { key: "roll-down-attribution", label: "Roll-down 归因", aliases: ["rollDown", "rollDownAttribution"] },
        { key: "curve-attribution", label: "曲线归因", aliases: ["curve", "curveAttribution"] },
        { key: "credit-attribution", label: "信用归因", aliases: ["credit", "creditAttribution"] },
      ],
    },
    {
      id: "management-operation-quality",
      sourceKey: "managementOperationsQuality",
      label: "管理与运行质量",
      icon: "settings-2",
      metrics: [
        { key: "nav-publication-timeliness", label: "NAV 发布及时性", aliases: ["navPublicationTimeliness"] },
        { key: "valuation-exception-count", label: "估值异常", aliases: ["valuationExceptionCount"] },
        { key: "operation-incident-count", label: "运行事件", aliases: ["operationIncidentCount"] },
      ],
    },
    {
      id: "continuous-admission-compliance",
      sourceKey: "continuingEligibilityCompliance",
      label: "持续准入合规",
      icon: "badge-check",
      metrics: [
        { key: "continuing-eligibility", label: "持续准入", aliases: ["continuingEligibility"] },
        { key: "compliance-exceptions", label: "合规例外", aliases: ["complianceExceptions"] },
        { key: "classification-confidence", label: "分类置信度", aliases: ["classificationConfidence"] },
      ],
    },
    {
      id: "selection-execution",
      sourceKey: "selectionExecution",
      label: "选择与执行",
      icon: "route",
      metrics: [
        { key: "selection-attribution", label: "选择归因", aliases: ["selection", "selectionAttribution"] },
        { key: "timing-attribution", label: "择时归因", aliases: ["timing", "timingAttribution"] },
        { key: "next-available-nav", label: "下一可得 NAV", aliases: ["nextAvailableNav"] },
        { key: "actual-nav", label: "实际 NAV", aliases: ["actualNav"] },
        { key: "slippage", label: "滑点", aliases: ["executionSlippage"] },
        { key: "settlement-status", label: "结算状态", aliases: ["settlementStatus"] },
      ],
    },
  ]);
  const s005Evaluation = {
    scenarioContext: null,
    evaluationRun: null,
    evaluationResult: null,
    receivedAt: "",
    contractError: "",
  };
  const S003_MODELING_SCHEMA = DATA.consumerSchemas?.s003Modeling;
  if (!S003_MODELING_SCHEMA) throw new Error("S003 Modeling 消费 schema 未加载");
  const s003Modeling = {
    workspace: null,
    formalResult: null,
    candidateResult: null,
    shadowResult: null,
    simulationResult: null,
    receivedAt: "",
    requestState: "idle",
    contractError: "",
    focusRequested: false,
  };
  const dashboardFocusRequests = new Set();
  try {
    const current = localStorage.getItem("ofw.dashboard.workspace.v13");
    Object.assign(state, JSON.parse(current || "{}"));
    if (!current) Object.assign(state, { riskActionStates: {} });
    state.drawer = null;
  } catch (_) {}

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  async function modelingApi(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body) headers["content-type"] = "application/json";
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers, cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body.message || `模型服务返回 ${response.status}`), { code: body.code || "MODELING_API_ERROR" });
    return body;
  }
  if (!state.riskActionStates || typeof state.riskActionStates !== "object") state.riskActionStates = {};
  if (!S003_MODELING_SCHEMA.views.some((item) => item.id === state.riskModelingView)) state.riskModelingView = "formal";
  state.riskModelingSelection = { ...DEFAULT_STATE.riskModelingSelection, ...(objectRecord(state.riskModelingSelection) || {}) };

  function persist() {
    const copy = { ...state, drawer: null };
    localStorage.setItem("ofw.dashboard.workspace.v13", JSON.stringify(copy));
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }
  function attr(value) { return esc(value); }
  function fmt(value, digits = 2) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "—";
  }
  function icon(name, size = "") { return `<span class="icon ${size}"><i data-lucide="${name}"></i></span>`; }
  function badge(label, tone = "plain") { return `<span class="badge ${tone}">${esc(label)}</span>`; }
  function refreshIcons() { window.lucide?.createIcons({ attrs: { "stroke-width": 1.8 } }); }
  function toneFor(value) {
    if (/红灯|异常|高关注|超支|负余额/.test(value)) return "danger";
    if (/黄灯|关注|接近|偏低|偏慢|执行中|待人工确认|跟踪中|需复核|部分/.test(value)) return "warning";
    if (/已完成|已形成|正常|绿灯|通过/.test(value)) return "success";
    return "plain";
  }
  function toast(message) {
    toastRoot.innerHTML = `<div class="toast">${icon("circle-check", "sm")}<strong>${esc(message)}</strong></div>`;
    refreshIcons();
    window.setTimeout(() => { toastRoot.innerHTML = ""; }, 2200);
  }
  function byId(id) { return DATA.dashboards.find((item) => item.id === id); }
  function route() {
    const raw = (location.hash || "#/dashboards").replace(/^#/, "");
    const clean = raw.split("?")[0];
    const parts = clean.split("/").filter(Boolean);
    return parts[0] === "view" ? { type: "view", id: parts[1], tab: parts[2] || "overview" } : { type: "directory" };
  }
  function dashboardHref(id, tab = "overview") { return `#/view/${id}/${tab}`; }
  function displayAsOf(value) {
    const text = String(value ?? "");
    const year = text.match(/^(\d{4})\s*年度$/);
    return year ? `${year[1]}-12-31（年度）` : text;
  }

  function localDateTime(date = new Date()) {
    const part = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())} ${part(date.getHours())}:${part(date.getMinutes())}:${part(date.getSeconds())}`;
  }

  function firstDefined(...values) {
    return values.find((value) => value !== undefined && value !== null && value !== "");
  }

  function objectRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  }

  function s005StatusMeta(value, hasValue = false) {
    const normalized = String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
    const entries = {
      COMPLETE: { label: "完整评价", valueLabel: "已评价", tone: "success" },
      COMPLETED: { label: "完整评价", valueLabel: "已评价", tone: "success" },
      AVAILABLE: { label: "完整评价", valueLabel: "已评价", tone: "success" },
      EVALUATED: { label: "完整评价", valueLabel: "已评价", tone: "success" },
      SUCCESS: { label: "完整评价", valueLabel: "已评价", tone: "success" },
      PARTIAL: { label: "部分评价", valueLabel: "部分评价", tone: "warning" },
      PARTIALLY_EVALUATED: { label: "部分评价", valueLabel: "部分评价", tone: "warning" },
      INSUFFICIENT_HISTORY: { label: "观察期不足", valueLabel: "观察期不足", tone: "plain" },
      OBSERVATION_PERIOD_INSUFFICIENT: { label: "观察期不足", valueLabel: "观察期不足", tone: "plain" },
      UNAVAILABLE: { label: "无法评价", valueLabel: "无法评价", tone: "plain" },
      NOT_EVALUABLE: { label: "无法评价", valueLabel: "无法评价", tone: "plain" },
      MISSING: { label: "无法评价", valueLabel: "无法评价", tone: "plain" },
      NOT_APPLICABLE: { label: "不适用", valueLabel: "不适用", tone: "plain" },
      READ_ONLY: { label: "只读", valueLabel: "只读", tone: "plain" },
      PENDING: { label: "等待评价", valueLabel: "等待评价", tone: "plain" },
      RUNNING: { label: "评价中", valueLabel: "评价中", tone: "warning" },
      FAILED: { label: "无法评价", valueLabel: "无法评价", tone: "danger" },
    };
    if (entries[normalized]) return entries[normalized];
    if (hasValue) return entries.COMPLETE;
    return entries.UNAVAILABLE;
  }

  function s005Coverage(value, fallback = 0) {
    if (typeof value === "string" && value.trim().endsWith("%")) {
      const parsed = Number(value.replace("%", ""));
      if (Number.isFinite(parsed)) return Math.max(0, Math.min(100, parsed));
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return Math.max(0, Math.min(100, fallback));
    return Math.max(0, Math.min(100, parsed <= 1 ? parsed * 100 : parsed));
  }

  function s005Confidence(value) {
    if (value === undefined || value === null || value === "") return "无法评价";
    if (objectRecord(value)) {
      const score = firstDefined(value.score, value.value);
      const level = firstDefined(value.level, value.label, "");
      const levelLabel = ({ high: "高", medium: "中", low: "低", very_low: "很低" })[String(level).toLowerCase()] || level;
      return `${score === undefined ? "无法评价" : `${s005Coverage(score).toFixed(1)}%`}${levelLabel ? ` · ${levelLabel}` : ""}`;
    }
    if (typeof value === "string" && !Number.isFinite(Number(value))) return String(value);
    return `${s005Coverage(value).toFixed(1)}%`;
  }

  function s005DisplayValue(metric, statusMeta) {
    const explicit = firstDefined(metric?.display, metric?.formattedValue, metric?.formatted, metric?.value);
    if (explicit === undefined) return statusMeta.valueLabel;
    if (objectRecord(explicit)) {
      const eligible = firstDefined(explicit.eligible, explicit.admitted);
      const reviewRequired = firstDefined(explicit.reviewRequired, explicit.pendingReview);
      const unknown = firstDefined(explicit.unknown, explicit.unclassified);
      const displayed = firstDefined(explicit.displayedProducts, explicit.displayed);
      const total = firstDefined(explicit.candidateCount, explicit.total);
      if ([eligible, reviewRequired, unknown, displayed, total].some((value) => value !== undefined)) {
        const parts = [];
        if (eligible !== undefined) parts.push(`准入 ${eligible}`);
        if (reviewRequired !== undefined) parts.push(`需复核 ${reviewRequired}`);
        if (unknown !== undefined) parts.push(`未知 ${unknown}`);
        if (displayed !== undefined || total !== undefined) parts.push(`已列示 ${displayed ?? "—"}/${total ?? "—"}`);
        return parts.join(" · ");
      }
      return statusMeta.valueLabel;
    }
    const rawUnit = firstDefined(metric?.unit, metric?.valueUnit, "");
    const unit = ({ pct: "%", ratio: "", currency: "金额", years: "年", days: "天", count: "项", state: "", nav: "NAV" })[rawUnit] ?? rawUnit;
    if (typeof explicit === "number") return `${explicit.toLocaleString("zh-CN", { maximumFractionDigits: 6 })}${unit ? ` ${unit}` : ""}`;
    return `${String(explicit)}${unit && !String(explicit).includes(unit) ? ` ${unit}` : ""}`;
  }

  function s005DomainSource(result, definition) {
    const domains = result?.domains || result?.evaluationDomains || result?.domainResults || result?.sixDomains;
    if (Array.isArray(domains)) {
      return domains.find((item) => [item?.id, item?.domainId, item?.key, item?.name, item?.label, item?.title].includes(definition.id)
        || [item?.id, item?.domainId, item?.key, item?.name, item?.label, item?.title].includes(definition.sourceKey)
        || [item?.id, item?.domainId, item?.key, item?.name, item?.label, item?.title].includes(definition.label)) || null;
    }
    if (objectRecord(domains)) return domains[definition.id] || domains[definition.sourceKey] || domains[definition.label] || null;
    return null;
  }

  function s005MetricSource(domain, result, definition) {
    const names = [definition.key, definition.label, ...(definition.aliases || [])];
    const metricCollections = [domain?.metrics, domain?.metricResults, result?.metrics];
    for (const metrics of metricCollections) {
      if (Array.isArray(metrics)) {
        const match = metrics.find((item) => names.includes(item?.key) || names.includes(item?.metricId) || names.includes(item?.id) || names.includes(item?.name) || names.includes(item?.label));
        if (match) return match;
      } else if (objectRecord(metrics)) {
        for (const name of names) if (Object.hasOwn(metrics, name)) {
          const value = metrics[name];
          return objectRecord(value) || { value };
        }
      }
    }
    return null;
  }

  function s005MissingReasons(value) {
    const list = Array.isArray(value) ? value : value ? [value] : [];
    return list.map((item) => typeof item === "string" ? item : firstDefined(item?.reason, item?.message, item?.label)).filter(Boolean).map(String);
  }

  function s005EvidenceItems(value) {
    const list = Array.isArray(value) ? value : value ? [value] : [];
    return list.filter((item) => item !== undefined && item !== null).map((item) => {
      if (typeof item === "string") return { label: item, ref: item };
      return {
        label: firstDefined(item.label, item.title, item.evidenceType, item.type, "证据引用"),
        ref: firstDefined(item.ref, item.id, item.evidenceRef, item.uri, item.sourceRef, "未提供引用"),
        asOf: firstDefined(item.asOf, item.dataAsOf, item.eventReadAt, ""),
        status: firstDefined(item.status, item.state, ""),
      };
    });
  }

  function normalizedS005Domains() {
    const result = s005Evaluation.evaluationResult;
    return S005_DOMAIN_DEFINITIONS.map((definition) => {
      const source = s005DomainSource(result, definition);
      const metrics = definition.metrics.map((metricDefinition) => {
        const metric = s005MetricSource(source, result, metricDefinition);
        const explicitValue = firstDefined(metric?.display, metric?.formattedValue, metric?.formatted, metric?.value);
        const hasValue = explicitValue !== undefined;
        const status = s005StatusMeta(firstDefined(metric?.status, metric?.evaluationStatus, metric?.state), hasValue);
        const missingReasons = s005MissingReasons(firstDefined(metric?.missingReasons, metric?.missingReason, metric?.reason));
        if (!hasValue && !missingReasons.length) missingReasons.push(result ? "当前评价结果未提供该指标所需数据。" : "尚未收到当前评价轮次的可验证结果。");
        return {
          ...metricDefinition,
          status,
          display: s005DisplayValue(metric, result ? status : s005StatusMeta("PENDING")),
          hasValue,
          missingReasons,
          evidence: s005EvidenceItems(firstDefined(metric?.evidence, metric?.evidenceRefs, metric?.evidences)),
          formula: firstDefined(metric?.formula, metric?.formulaRef, ""),
          observation: firstDefined(metric?.observationPeriod, metric?.window, ""),
        };
      });
      const valued = metrics.filter((metric) => metric.hasValue).length;
      const computedCoverage = metrics.length ? (valued / metrics.length) * 100 : 0;
      const coverage = s005Coverage(firstDefined(source?.coverage, source?.scored_coverage, source?.scoredCoverage), computedCoverage);
      const sourceStatus = firstDefined(source?.status, source?.evaluationStatus);
      const status = result
        ? sourceStatus
          ? s005StatusMeta(sourceStatus, valued === metrics.length && metrics.length > 0)
          : s005StatusMeta(valued === metrics.length && metrics.length > 0 ? "COMPLETE" : valued > 0 ? "PARTIAL" : "UNAVAILABLE")
        : s005StatusMeta("PENDING");
      const missingReasons = s005MissingReasons(firstDefined(source?.missingReasons, source?.missingReason, source?.reason));
      if (coverage < 100 && !missingReasons.length) {
        const metricReasons = [...new Set(metrics.flatMap((metric) => metric.missingReasons))];
        missingReasons.push(...metricReasons.slice(0, 3));
      }
      return {
        ...definition,
        status,
        coverage,
        conclusion: firstDefined(source?.conclusion, source?.summary, result ? (coverage ? "仅对已覆盖指标形成部分结论。" : "当前证据不足，无法形成该域结论。") : "等待当前评价轮次产生该域结果。"),
        missingReasons,
        evidence: s005EvidenceItems(firstDefined(source?.evidence, source?.evidenceRefs, source?.evidences)),
        metrics,
      };
    });
  }

  function validS005ScenarioContext(context) {
    return objectRecord(context)
      && S005_CONTEXT_FIELDS.every((field) => typeof context[field] === "string" && context[field].trim())
      && context.scenarioId === "S005"
      && context.scenarioVersion === "S005-v1";
  }

  function s005ContextRunId(value) {
    return firstDefined(value?.scenarioRunId, value?.scenarioContext?.scenarioRunId, value?.context?.scenarioRunId);
  }

  function sameS005Identity(left, right) {
    return validS005ScenarioContext(left) && validS005ScenarioContext(right)
      && S005_CONTEXT_FIELDS.every((field) => left[field] === right[field]);
  }

  function acceptS005EvaluationContext(payload) {
    const context = payload?.scenarioContext;
    const hasEvaluationRun = objectRecord(payload) && Object.hasOwn(payload, "evaluationRun");
    const hasEvaluationResult = objectRecord(payload) && Object.hasOwn(payload, "evaluationResult");
    const rawEvaluationRun = payload?.evaluationRun;
    const rawEvaluationResult = payload?.evaluationResult;
    const evaluationRun = rawEvaluationRun === null ? null : objectRecord(rawEvaluationRun);
    const evaluationResult = rawEvaluationResult === null ? null : objectRecord(rawEvaluationResult);
    const contextRunId = context?.scenarioRunId;
    const runScenarioId = s005ContextRunId(evaluationRun);
    const resultScenarioId = s005ContextRunId(evaluationResult);
    const evaluationRunId = firstDefined(evaluationRun?.evaluationRunId, evaluationRun?.runId, evaluationRun?.id);
    const resultRunId = firstDefined(evaluationResult?.evaluationRunId, evaluationResult?.runId);
    if (!validS005ScenarioContext(context)) return "消息缺少当前 S005 五字段身份。";
    if (!hasEvaluationRun || !hasEvaluationResult) return "消息缺少 evaluation run/result 字段。";
    if (rawEvaluationRun !== null && !evaluationRun) return "evaluation run 格式无效。";
    if (rawEvaluationResult !== null && !evaluationResult) return "evaluation result 格式无效。";
    if (!evaluationRun && evaluationResult) return "尚未建立 evaluation run 时不能提供 evaluation result。";
    if (!evaluationRun) {
      s005Evaluation.scenarioContext = { ...context };
      s005Evaluation.evaluationRun = null;
      s005Evaluation.evaluationResult = null;
      s005Evaluation.receivedAt = localDateTime();
      s005Evaluation.contractError = "";
      return "";
    }
    if (!sameS005Identity(evaluationRun.scenarioContext, context)) return "evaluation run 的五字段场景身份不一致。";
    if (typeof evaluationRunId !== "string" || !evaluationRunId.trim()) return "evaluation run 缺少可验证标识。";
    if (runScenarioId && runScenarioId !== contextRunId) return "evaluation run 与当前 scenarioRunId 不一致。";
    if (evaluationResult && !sameS005Identity(evaluationResult.scenarioContext, context)) return "evaluation result 的五字段场景身份不一致。";
    if (evaluationResult && (typeof evaluationResult.evaluationResultId !== "string" || !evaluationResult.evaluationResultId.trim())) return "evaluation result 缺少可验证标识。";
    if (evaluationResult && resultScenarioId !== contextRunId) return "evaluation result 与当前 scenarioRunId 不一致。";
    if (evaluationResult && resultRunId !== evaluationRunId) return "evaluation run/result 标识不一致。";
    s005Evaluation.scenarioContext = { ...context };
    s005Evaluation.evaluationRun = evaluationRun;
    s005Evaluation.evaluationResult = evaluationResult;
    s005Evaluation.receivedAt = localDateTime();
    s005Evaluation.contractError = "";
    return "";
  }

  function requestS005Evaluation() {
    const targetOrigin = location.origin && location.origin !== "null" ? location.origin : "*";
    window.parent.postMessage({
      type: "OFW_S005_EVALUATION_REQUEST",
      scenarioId: "S005",
      scenarioVersion: "S005-v1",
      requestedAt: new Date().toISOString(),
    }, targetOrigin);
  }

  function shell(content) {
    app.className = "dash-app";
    app.innerHTML = `
      <header class="module-bar">
        <div class="module-title"><span class="mark">${icon("chart-no-axes-combined", "sm")}</span><div><strong>仪表盘</strong><small>经营分析与管理驾驶舱</small></div></div>
        <div class="module-actions"><a class="btn" href="#/dashboards">${icon("layout-dashboard", "sm")}<span>仪表盘目录</span></a><button class="btn" type="button" data-action="refresh">${icon("refresh-cw", "sm")}<span>重新读取</span></button></div>
      </header>
      ${content}
      ${state.drawer ? renderDrawer() : ""}
    `;
    refreshIcons();
  }

  function s005RunValue(...keys) {
    const run = s005Evaluation.evaluationRun || {};
    const result = s005Evaluation.evaluationResult || {};
    return firstDefined(...keys.flatMap((key) => [result[key], run[key]]));
  }

  function s005OverallStatus() {
    if (s005Evaluation.contractError) return { label: "读取失败", tone: "danger" };
    if (!s005Evaluation.evaluationRun) return { label: "等待评价", tone: "plain" };
    return s005StatusMeta(s005RunValue("evaluationStatus", "status"), Boolean(s005Evaluation.evaluationResult));
  }

  function s005DirectoryMetrics() {
    const context = s005Evaluation.scenarioContext;
    const domains = normalizedS005Domains();
    const coveredDomains = domains.filter((domain) => domain.coverage > 0).length;
    const scoredCoverage = s005Coverage(s005RunValue("scored_coverage", "scoredCoverage"), 0);
    return [
      { label: "当前轮次", display: context?.scenarioRunId || "等待当前轮次", unit: "" },
      { label: "评价域覆盖", display: `${coveredDomains} / 6`, unit: "域" },
      { label: "scored_coverage", display: `${scoredCoverage.toFixed(1)}%`, unit: "" },
      { label: "置信度", display: s005Confidence(s005RunValue("confidence", "confidenceScore")), unit: "" },
    ];
  }

  function s005DataAsOf() {
    const run = s005Evaluation.evaluationRun || {};
    const result = s005Evaluation.evaluationResult || {};
    return firstDefined(result.statusBar?.dataAsOf, result.dataAsOf, result.sourceAudit?.asOf, run.sourceAudit?.asOf, "等待当前轮次");
  }

  function renderDirectory() {
    const previews = {
      financing: `<div class="directory-capability"><strong>7 项核心指标</strong><span>单位比较 · 六类结构 · 三条规则</span></div>`,
      budget: `<div class="directory-capability"><strong>6 个监督专题</strong><span>预算执行 · 项目 · 差旅 · 计提 · 占用 · 供应商</span></div>`,
      risk: `<div class="mini-risk-bars"><i style="--w:76%;--c:#16806a"></i><i style="--w:19%;--c:#d39a2c"></i><i style="--w:5%;--c:#c84a43"></i></div>`,
      preloan: `<div class="directory-capability"><strong>4 家借款主体</strong><span>资料 · 财务 · 关系 · 模型差异 · 人工复核</span></div>`,
      "post-investment": `<div class="directory-capability"><strong>6 个评价域</strong><span>表现 · 投资结果 · 固收风险 · 运行质量 · 合规 · 选择执行</span></div>`,
    };
    shell(`
      <main class="page directory-page" data-screen-label="仪表盘目录">
        <header class="page-head directory-head"><div><span class="eyebrow">经营分析</span><h1>仪表盘</h1><p>选择驾驶舱查看指标、专题、业务状态和证据。</p></div>${badge("5 个驾驶舱", "plain")}</header>
        <section class="directory-grid">
          ${DATA.dashboards.map((dash) => {
            const isS005 = dash.id === "post-investment";
            const directoryStatus = isS005 ? s005OverallStatus() : { label: dash.status || "当前正式使用", tone: dash.status ? "warning" : "success" };
            const directoryMetrics = isS005 ? s005DirectoryMetrics() : dash.metrics;
            const directoryPeriod = isS005 ? s005DataAsOf() : displayAsOf(dash.period);
            return `
            <article class="directory-card ${dash.id}">
              <header class="directory-card-head"><span class="dash-symbol">${icon(dash.id === "financing" ? "landmark" : dash.id === "budget" ? "circle-dollar-sign" : dash.id === "risk" ? "shield-alert" : dash.id === "preloan" ? "clipboard-check" : "chart-spline", "lg")}</span><div>${badge(directoryStatus.label, directoryStatus.tone)}</div></header>
              <div><h2>${esc(dash.name)}</h2><p>${esc(dash.description)}</p></div>
              <div class="directory-visual">${previews[dash.id]}</div>
              <div class="directory-metrics">${directoryMetrics.slice(0, 4).map((item) => `<div><span>${esc(item.label)}</span><strong>${esc(item.display)} <small>${esc(item.unit)}</small></strong></div>`).join("")}</div>
              <footer class="directory-foot"><div><small>数据截至</small><strong>${esc(directoryPeriod)}</strong></div><a class="btn primary" href="${dashboardHref(dash.id)}">打开驾驶舱${icon("arrow-right", "sm")}</a></footer>
            </article>
          `; }).join("")}
        </section>
      </main>
    `);
  }

  function metricsGrid(metrics, options = {}) {
    return `<section class="metrics-grid ${options.compact ? "compact" : ""}">${metrics.map((item) => `
      <button class="metric" type="button" data-action="metric-detail" data-dashboard="${attr(options.dashboard || "")}" data-key="${attr(item.key)}">
        <span>${esc(item.label)}</span><div class="metric-value"><strong>${esc(item.display)}</strong><em>${esc(item.unit)}</em></div>
        <div class="metric-footline"><span class="metric-change ${esc(item.trend || "flat")}">${icon(item.trend === "up" ? "trending-up" : item.trend === "down" ? "trending-down" : "minus", "sm")}${esc(item.change || "")}</span><span class="metric-evidence">查看口径 ${icon("chevron-right", "sm")}</span></div>
      </button>
    `).join("")}</section>`;
  }

  function lineChart(points, unit = "%", currentLabel = "当前值") {
    const width = 820;
    const height = 250;
    const padX = 48;
    const padY = 34;
    const values = points.map((item) => Number(item[1]));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = max - min || 1;
    const plotted = points.map((item, index) => ({
      label: item[0], value: Number(item[1]),
      x: padX + index * ((width - padX * 2) / Math.max(1, points.length - 1)),
      y: height - padY - ((Number(item[1]) - min) / spread) * (height - padY * 2),
    }));
    const path = plotted.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
    const area = `${path} L${width - padX} ${height - padY} L${padX} ${height - padY} Z`;
    const gradientId = `area-${Math.random().toString(36).slice(2, 8)}`;
    return `<div class="chart"><div class="chart-summary"><strong>${fmt(values.at(-1), unit === "%" ? 3 : 2)}${unit}</strong><span>${esc(currentLabel)}</span></div><svg class="line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="趋势图"><defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d7aa6" stop-opacity=".32"></stop><stop offset="1" stop-color="#3d7aa6" stop-opacity=".02"></stop></linearGradient></defs>${[0, 1, 2, 3].map((index) => `<line class="grid-line" x1="${padX}" y1="${padY + index * ((height - padY * 2) / 3)}" x2="${width - padX}" y2="${padY + index * ((height - padY * 2) / 3)}"></line>`).join("")}<path class="trend-area" d="${area}" fill="url(#${gradientId})"></path><path class="trend-line" d="${path}"></path>${plotted.map((point, index) => `<g class="chart-point"><circle cx="${point.x}" cy="${point.y}" r="4"><title>${esc(point.label)} ${fmt(point.value, 3)}${esc(unit)}</title></circle>${index % Math.ceil(points.length / 6) === 0 || index === points.length - 1 ? `<text class="axis-label" x="${point.x}" y="${height - 8}" text-anchor="middle">${esc(point.label.replace(/^\d{4}-/, ""))}</text>` : ""}</g>`).join("")}</svg></div>`;
  }

  function comparisonLineChart(labels, series, options = {}) {
    const width = 820;
    const height = 270;
    const pad = { top: 24, right: 24, bottom: 38, left: 52 };
    const values = series.flatMap((item) => item.values.map(Number));
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const margin = Math.max((rawMax - rawMin) * 0.12, 0.08);
    const min = rawMin - margin;
    const max = rawMax + margin;
    const spread = max - min || 1;
    const xFor = (index) => pad.left + index * ((width - pad.left - pad.right) / Math.max(1, labels.length - 1));
    const yFor = (value) => height - pad.bottom - ((Number(value) - min) / spread) * (height - pad.top - pad.bottom);
    const grid = [0, 1, 2, 3].map((index) => {
      const y = pad.top + index * ((height - pad.top - pad.bottom) / 3);
      const value = max - index * (spread / 3);
      return `<line class="grid-line" x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}"></line><text class="chart-y-label" x="${pad.left - 8}" y="${y + 4}" text-anchor="end">${fmt(value, 2)}</text>`;
    }).join("");
    const paths = series.map((item) => {
      const points = item.values.map((value, index) => ({ x: xFor(index), y: yFor(value), value: Number(value), label: labels[index] }));
      const path = points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
      return `<path class="comparison-line" d="${path}" stroke="${attr(item.color)}"></path>${points.map((point) => `<circle class="comparison-point" cx="${point.x}" cy="${point.y}" r="3.5" stroke="${attr(item.color)}"><title>${esc(item.label)} · ${esc(point.label)} · ${fmt(point.value, 2)}</title></circle>`).join("")}`;
    }).join("");
    const axes = labels.map((label, index) => `<text class="axis-label" x="${xFor(index)}" y="${height - 10}" text-anchor="middle">${esc(String(label).replace(/^\d{4}-/, ""))}</text>`).join("");
    return `<div class="comparison-chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${attr(options.ariaLabel || "比较趋势图")}">${grid}${paths}${axes}</svg><div class="series-legend">${series.map((item) => `<span><i style="--series-color:${attr(item.color)}"></i>${esc(item.label)}<strong>${fmt(item.values.at(-1), 2)}</strong></span>`).join("")}</div></div>`;
  }

  function panel(title, subtitle, body, tools = "", className = "") {
    return `<section class="panel ${className}"><header class="panel-head"><div><h2>${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ""}</div>${tools}</header><div class="panel-body">${body}</div></section>`;
  }

  function dashboardHeader(dash, options = {}) {
    return `<header class="page-head dashboard-page-head"><div class="dashboard-title"><a class="icon-btn" href="#/dashboards" aria-label="返回仪表盘目录">${icon("arrow-left", "sm")}</a><div><span class="eyebrow">管理驾驶舱</span><h1>${esc(dash.name)}</h1><p>${esc(dash.description)}</p></div></div><div class="head-actions">${options.actions || ""}</div></header>`;
  }

  function infoStrip(dash) {
    return `<section class="authority-strip"><div>${icon("database", "sm")}<span>数据范围</span><strong>${esc(dash.dataLabel)}</strong></div><div>${icon("network", "sm")}<span>业务定义</span><strong>${esc(dash.semanticLabel)}</strong></div><div>${icon("calendar-clock", "sm")}<span>数据截至</span><strong>${esc(displayAsOf(dash.period))}</strong></div><div>${icon(dash.status ? "circle-dashed" : "shield-check", "sm")}<span>业务状态</span><strong>${esc(dash.status || "当前正式使用")}</strong></div></section>`;
  }

  function tabs(items, active, dashboard) {
    return `<nav class="tabs" aria-label="驾驶舱视图">${items.map((item) => `<a class="tab ${item.id === active ? "active" : ""}" href="${dashboardHref(dashboard, item.id)}">${item.icon ? icon(item.icon, "sm") : ""}<span>${esc(item.label)}</span></a>`).join("")}</nav>`;
  }

  function financeScopedMetrics(dash) {
    if (state.financeScopeType === "group") return dash.metrics;
    const source = state.financeScopeType === "board" ? dash.boards.find((item) => item.name === state.financeScopeId) : dash.units.find((item) => item.name === state.financeScopeId);
    if (!source) return dash.metrics;
    const digits = { balance: 3, cost: 6, floating: 2, shortTerm: 2, foreign: 2, highCost: 2, credit: 2 };
    return dash.metrics.map((metric) => {
      const value = Number(source[metric.key]);
      return { ...metric, value, display: fmt(value, digits[metric.key] ?? 2), change: state.financeScopeId, trend: "flat" };
    });
  }

  function financeToolbar(dash) {
    const options = state.financeScopeType === "board" ? dash.boards : state.financeScopeType === "unit" ? dash.units : [];
    return `<section class="dashboard-toolbar"><div class="toolbar-group"><span class="toolbar-label">分析范围</span><div class="segmented"><button class="${state.financeScopeType === "group" ? "active" : ""}" type="button" data-action="finance-scope" data-type="group">集团</button><button class="${state.financeScopeType === "board" ? "active" : ""}" type="button" data-action="finance-scope" data-type="board">板块</button><button class="${state.financeScopeType === "unit" ? "active" : ""}" type="button" data-action="finance-scope" data-type="unit">单位</button></div>${options.length ? `<select class="select" data-change="finance-scope-id">${options.map((item) => `<option ${item.name === state.financeScopeId ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select>` : `<strong class="current-scope">集团</strong>`}</div><div class="inline-actions"><span>更新时间 ${esc(dash.updatedAt)}</span>${badge("数据已更新", "success")}</div></section>`;
  }

  function structureCard(item, compact = false) {
    const colors = ["#24618f", "#7fa7c3", "#d4a347", "#8794a2"];
    return `<button class="structure-card ${compact ? "compact" : ""}" type="button" data-action="structure-detail" data-id="${attr(item.id)}"><header><strong>${esc(item.name)}</strong>${icon("chevron-right", "sm")}</header><div class="stacked-bar">${item.items.map((part, index) => `<i style="width:${part[1]}%;background:${colors[index % colors.length]}" title="${attr(part[0])} ${fmt(part[1], 2)}%"></i>`).join("")}</div><div class="structure-legend">${item.items.map((part, index) => `<span><i style="background:${colors[index % colors.length]}"></i>${esc(part[0])}<strong>${fmt(part[1], 2)}%</strong></span>`).join("")}</div></button>`;
  }

  function financeOverview(dash) {
    const scopedMetrics = financeScopedMetrics(dash);
    const cost = scopedMetrics.find((item) => item.key === "cost");
    const unitRows = dash.units.map((item, index) => `<tr><td><button class="table-link" type="button" data-action="finance-unit-detail" data-index="${index}">${esc(item.name)}</button><small class="cell-note">${esc(item.board)}</small></td><td class="num">${fmt(item.balance, 3)}</td><td class="num">${fmt(item.cost, 6)}%</td><td class="num">${fmt(item.floating, 2)}%</td><td>${badge(item.finding, item.tone)}</td><td><button class="text-btn" type="button" data-action="finance-unit-detail" data-index="${index}">查看详情</button></td></tr>`).join("");
    return `${metricsGrid(scopedMetrics, { dashboard: "financing" })}<section class="grid-main wide">${panel("融资成本快照", "当前已发布数据只提供本期结果，不展示无历史依据的趋势序列", `<div class="snapshot-hero"><strong>${fmt(cost?.value, 6)}%</strong><span>余额加权融资成本 · 数据截至 ${esc(displayAsOf(dash.period))}</span><p>趋势分析需要连续历史版本；当前工作台仅呈现本期确定性结果。</p></div>`, `<button class="text-btn" type="button" data-action="metric-detail" data-dashboard="financing" data-key="cost">查看口径 ${icon("chevron-right", "sm")}</button>`, "snapshot-panel")}${panel("债务结构", "当前融资余额结构", `<div class="structure-preview">${dash.structures.slice(0, 2).map((item) => structureCard(item, true)).join("")}</div>`, `<a class="text-btn" href="${dashboardHref("financing", "structure")}">查看全部 ${icon("chevron-right", "sm")}</a>`)}</section><section class="grid-main">${panel("重点单位", "成本、结构和规则发现使用同一业务范围", `<div class="table-wrap"><table class="data-table"><thead><tr><th>单位 / 板块</th><th class="num">余额（亿元）</th><th class="num">加权成本</th><th class="num">浮动利率</th><th>主要发现</th><th></th></tr></thead><tbody>${unitRows}</tbody></table></div>`, "", "flush-body")}${panel("经营解读", "基于当前业务事实形成", `<div class="brief-list"><article><span class="brief-index">01</span><div><strong>本期融资成本</strong><p>当前余额加权融资成本为 ${fmt(cost?.value, 6)}%，只引用本期正式结果。</p></div></article><article><span class="brief-index warning">02</span><div><strong>浮动利率暴露较高</strong><p>浮动利率余额占比 95.15%，需持续关注市场利率变化。</p></div></article><article><span class="brief-index danger">03</span><div><strong>单位差异需要分层处理</strong><p>单位553、单位465、单位561分别命中成本、利率和期限规则。</p></div></article></div><div class="query-links"><a class="btn" href="${BASELINE_ROOT}/intelligent-query-prototype/review-next/conversation-workspace/index.html#/ask">${icon("message-square-text", "sm")}继续问数</a><a class="btn" href="${dashboardHref("financing", "rules")}">${icon("list-checks", "sm")}查看规则与行动</a></div>`)} </section>`;
  }

  function financeCompare(dash) {
    const selected = state.financeCompare;
    const rows = dash.units.filter((item) => selected.includes(item.name));
    const balance = rows.reduce((sum, item) => sum + item.balance, 0);
    const weightedCost = balance ? rows.reduce((sum, item) => sum + item.balance * item.cost, 0) / balance : 0;
    const chartMax = Math.max(...dash.units.map((item) => item.cost), 1);
    return `<section class="panel"><header class="panel-head"><div><h2>单位比较</h2><p>选择 2—3 家单位，组合值按所选单位融资余额加权。</p></div>${badge(`已选 ${selected.length} 家`, selected.length >= 2 ? "success" : "warning")}</header><div class="panel-body"><div class="unit-chips">${dash.units.map((item) => `<button class="unit-chip ${selected.includes(item.name) ? "active" : ""}" type="button" data-action="toggle-finance-unit" data-unit="${attr(item.name)}">${icon(selected.includes(item.name) ? "check" : "plus", "sm")}${esc(item.name)}</button>`).join("")}</div>${selected.length < 2 ? `<div class="empty-inline">至少选择 2 家单位后查看组合指标。</div>` : `<div class="comparison-summary"><div><span>组合融资余额</span><strong>${fmt(balance, 3)} 亿元</strong></div><div><span>组合加权融资成本</span><strong>${fmt(weightedCost, 6)}%</strong></div><div><span>与集团基准差异</span><strong class="${weightedCost > dash.metrics[1].value ? "text-danger" : "text-success"}">${weightedCost > dash.metrics[1].value ? "+" : ""}${fmt(weightedCost - dash.metrics[1].value, 6)} 个百分点</strong></div></div><div class="compare-layout"><div class="compare-bars">${rows.map((item) => `<div class="compare-bar-row"><span>${esc(item.name)}</span><div><i style="width:${item.cost / chartMax * 100}%"></i></div><strong>${fmt(item.cost, 4)}%</strong></div>`).join("")}</div><div class="table-wrap"><table class="data-table"><thead><tr><th>单位</th><th class="num">余额</th><th class="num">加权成本</th><th class="num">浮动利率</th><th class="num">短期债务</th><th>主要发现</th></tr></thead><tbody>${rows.map((item) => `<tr><td><strong>${esc(item.name)}</strong><small class="cell-note">${esc(item.board)}</small></td><td class="num">${fmt(item.balance, 3)}</td><td class="num">${fmt(item.cost, 6)}%</td><td class="num">${fmt(item.floating, 2)}%</td><td class="num">${fmt(item.shortTerm, 2)}%</td><td>${badge(item.finding, item.tone)}</td></tr>`).join("")}</tbody></table></div></div>`}</div></section>`;
  }

  function financeStructure(dash) {
    const maxShare = Math.max(...dash.institutions.map((item) => item.share));
    const institutionRows = dash.institutions.map((item, index) => `<tr><td><strong>${esc(item.name)}</strong><small class="cell-note">银行</small></td><td class="num">${fmt(item.balance, 3)}</td><td><div class="table-bar"><i style="width:${item.share / maxShare * 100}%"></i><span>${fmt(item.share, 2)}%</span></div></td><td class="num">${fmt(item.cost, 6)}%</td><td class="num">${item.count}</td><td><button class="text-btn" type="button" data-action="institution-detail" data-index="${index}">查看详情</button></td></tr>`).join("");
    return `<section class="structure-grid">${dash.structures.map((item) => structureCard(item)).join("")}</section>${panel("主要融资机构", "按集团融资余额排序，查看机构贡献与成本", `<div class="table-wrap"><table class="data-table"><thead><tr><th>融资机构</th><th class="num">融资余额（亿元）</th><th>余额占比</th><th class="num">加权成本</th><th class="num">借据数</th><th></th></tr></thead><tbody>${institutionRows}</tbody></table></div>`, "", "flush-body")}`;
  }

  function financeRules(dash) {
    return `<section class="rule-grid">${dash.rules.map((rule, index) => `<article class="rule-card"><header><div>${badge(rule.result, "warning")}<span class="rule-code">${esc(rule.code)}</span></div><button class="icon-btn" type="button" data-action="rule-detail" data-index="${index}" aria-label="查看规则详情">${icon("search", "sm")}</button></header><h2>${esc(rule.unit)} · ${esc(rule.title)}</h2><p>${esc(rule.branch)}</p><dl><div><dt>当前值</dt><dd>${esc(rule.observed)}</dd></div><div><dt>阈值</dt><dd>${esc(rule.threshold)}</dd></div><div><dt>优先机构</dt><dd>${esc(rule.institution)}</dd></div><div><dt>评估时间</dt><dd>${esc(rule.evaluatedAt)}</dd></div></dl></article>`).join("")}</section>${panel("行动协同", "行动状态由决策中心维护，仪表盘只读展示进展", `<div class="action-table">${dash.actions.map((item, index) => `<article><div><strong>${esc(item.title)}</strong><p>${esc(item.owner)} · ${esc(item.basis)}</p></div><div>${badge(item.status, toneFor(item.status))}<button class="text-btn" type="button" data-action="finance-action-detail" data-index="${index}">查看详情</button></div></article>`).join("")}</div>`, `<a class="btn" href="${BASELINE_ROOT}/decision-center-prototype/index.html#/workbench">${icon("external-link", "sm")}查看决策进展</a>`, "flush-body")}`;
  }

  function renderFinancing(tab) {
    focusDashboardScenario("S001");
    const dash = byId("financing");
    const valid = ["overview", "compare", "structure", "rules"].includes(tab) ? tab : "overview";
    const tabItems = [{ id: "overview", label: "经营概览", icon: "layout-dashboard" }, { id: "compare", label: "单位比较", icon: "git-compare-arrows" }, { id: "structure", label: "结构与机构", icon: "chart-pie" }, { id: "rules", label: "规则与行动", icon: "list-checks" }];
    const content = valid === "overview" ? financeOverview(dash) : valid === "compare" ? financeCompare(dash) : valid === "structure" ? financeStructure(dash) : financeRules(dash);
    shell(`<main class="page dashboard-page financing-page" data-screen-label="集团融资驾驶舱">${dashboardHeader(dash, { actions: `<a class="btn" href="${BASELINE_ROOT}/report-center/review-lifecycle/index.html#/report/RPT-FIN-20260814-001">${icon("file-text", "sm")}查看融资报告</a><button class="btn primary" type="button" data-action="save-view">${icon("bookmark", "sm")}保存当前视图</button>` })}${infoStrip(dash)}${financeToolbar(dash)}${tabs(tabItems, valid, "financing")}<div class="dashboard-content">${content}</div></main>`);
  }

  function budgetScopedMetrics(dash) {
    if (state.budgetScope === "全部单位") return dash.metrics;
    const unit = dash.units.find((item) => item.name === state.budgetScope);
    if (!unit) return dash.metrics;
    const map = { approved: unit.budget, actual: unit.actual, execution: unit.execution, available: unit.available, inTransit: unit.inTransit };
    return dash.metrics.map((metric) => map[metric.key] == null ? metric : { ...metric, value: map[metric.key], display: fmt(map[metric.key], metric.key === "execution" ? 2 : 2), change: unit.name, trend: "flat" });
  }

  function budgetToolbar(dash) {
    return `<section class="dashboard-toolbar"><div class="toolbar-group"><span class="toolbar-label">分析范围</span><select class="select" data-change="budget-scope"><option>全部单位</option>${dash.units.map((item) => `<option ${item.name === state.budgetScope ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select><span class="toolbar-note">筛选只改变当前专题的指标和明细</span></div><div class="inline-actions"><span>更新时间 ${esc(dash.updatedAt)}</span>${badge("专题数据已更新", "success")}</div></section>`;
  }

  function sum(rows, key) { return rows.reduce((total, item) => total + Number(item[key] || 0), 0); }
  function max(rows, key) { return Math.max(0, ...rows.map((item) => Number(item[key] || 0))); }
  function filteredBudgetRows(dash, tab) {
    const rows = dash.details[tab] || [];
    if (state.budgetScope === "全部单位") return rows;
    return rows.filter((item) => item.group === state.budgetScope || item.department === state.budgetScope);
  }
  function stat(label, value, note, tone = "plain") { return `<div class="topic-stat ${tone}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></div>`; }

  function budgetTopicStats(tab, rows) {
    if (tab === "cost") return `${stat("最终批准费用预算", `${fmt(sum(rows, "budget"), 2)} 万元`, "当前范围")}${stat("实际费用", `${fmt(sum(rows, "actual"), 2)} 万元`, "不含税")}${stat("加权执行率", `${fmt(sum(rows, "actual") / Math.max(.01, sum(rows, "budget")) * 100, 2)}%`, "实际 ÷ 最终批准")}${stat("关注单位", `${rows.filter((item) => item.status !== "正常").length} 个`, "执行偏低或接近上限", "warning")}`;
    if (tab === "project") return `${stat("项目明细", `${rows.length} 项`, "立项与占用同口径")}${stat("批准金额", `${fmt(sum(rows, "approved"), 2)} 万元`, "当前筛选范围")}${stat("可用余额", `${fmt(sum(rows, "available"), 2)} 万元`, "扣除实际、占用与计划")}${stat("高关注项目", `${rows.filter((item) => item.status === "高关注").length} 项`, "可用余额为负", "danger")}`;
    if (tab === "travel") return `${stat("2025 实际差旅", `${fmt(sum(rows, "actual2025"), 2)} 万元`, "当前范围")}${stat("2026 初始申报", `${fmt(sum(rows, "application2026"), 2)} 万元`, "不代表最终批准")}${stat("申报增量", `${fmt(sum(rows, "delta"), 2)} 万元`, "同口径比较")}${stat("关注事项", `${rows.filter((item) => item.status !== "正常").length} 项`, "同比增幅达到关注线", "warning")}`;
    if (tab === "accrual") return `${stat("配对记录", `${rows.length} 笔`, "预估与结算已配对")}${stat("差异记录", `${rows.filter((item) => Math.abs(item.delta) > 0).length} 笔`, "结算不等于预估")}${stat("差异金额", `${fmt(rows.reduce((total, item) => total + Math.abs(item.delta), 0), 2)} 万元`, "绝对差异合计")}${stat("最高差异率", `${fmt(max(rows, "rate"), 2)}%`, "逐项目比较", "warning")}`;
    if (tab === "concentration") return `${stat("全年正向采购发起", `${fmt(sum(rows, "annualPr"), 2)} 万元`, "全年正向采购")}${stat("最高 12 月采购占比", `${fmt(max(rows, "prRate"), 2)}%`, "分量一", "warning")}${stat("最高 12 月在途占比", `${fmt(max(rows, "transitRate"), 2)}%`, "分量二", "warning")}${stat("高关注项目", `${rows.filter((item) => item.status === "高关注").length} 项`, "任一分量达到 15%", "danger")}`;
    return `${stat("供应商可比组", `${new Set(rows.map((item) => item.group)).size} 组`, "同供应商同级别")}${stat("明细记录", `${rows.length} 条`, "部门与项目明细")}${stat("最高倍率", `${fmt(max(rows, "ratio"), 2)} 倍`, "最高人月成本 ÷ 最低人月成本", "warning")}${stat("异常组", `${new Set(rows.filter((item) => item.status === "异常").map((item) => item.group)).size} 组`, "倍率严格大于 1.20", "danger")}`;
  }

  function budgetDetailTable(tab, rows) {
    const configs = {
      project: { headers: ["项目", "批准金额", "实际", "采购占用", "计提", "剩余计划", "可用余额", "判定"], cells: (item) => [`<strong>${esc(item.name)}</strong><small class="cell-note">${esc(item.code)}</small>`, fmt(item.approved), fmt(item.actual), fmt(item.occupied), fmt(item.accrual), fmt(item.remaining), fmt(item.available), badge(item.status, toneFor(item.status))] },
      travel: { headers: ["费用事项", "2025 实际", "2026 初始申报", "变动", "同比", "判定"], cells: (item) => [`<strong>${esc(item.name)}</strong><small class="cell-note">${esc(item.code)}</small>`, fmt(item.actual2025), fmt(item.application2026), fmt(item.delta), `${fmt(item.rate)}%`, badge(item.status, toneFor(item.status))] },
      accrual: { headers: ["项目", "预估计提", "结算金额", "差异", "差异率", "判定"], cells: (item) => [`<strong>${esc(item.name)}</strong><small class="cell-note">${esc(item.code)}</small>`, fmt(item.estimated), fmt(item.settled), fmt(item.delta), `${fmt(item.rate)}%`, badge(item.status, toneFor(item.status))] },
      concentration: { headers: ["项目", "全年正向采购", "12 月采购", "采购占比", "全年净在途", "12 月净在途", "在途占比", "判定"], cells: (item) => [`<strong>${esc(item.name)}</strong><small class="cell-note">${esc(item.code)}</small>`, fmt(item.annualPr), fmt(item.decemberPr), `${fmt(item.prRate)}%`, fmt(item.annualTransit), fmt(item.decemberTransit), `${fmt(item.transitRate)}%`, badge(item.status, toneFor(item.status))] },
      supplier: { headers: ["供应商 / 级别", "部门", "净额", "服务人月", "人月成本", "组内倍率", "判定"], cells: (item) => [`<strong>${esc(item.name)}</strong><small class="cell-note">${esc(item.code)}</small>`, esc(item.department), fmt(item.net), fmt(item.months, 0), `${fmt(item.monthly, 0)} 元`, `${fmt(item.ratio)} 倍`, badge(item.status, toneFor(item.status))] },
    };
    const config = configs[tab];
    return `<div class="table-wrap"><table class="data-table compact"><thead><tr>${config.headers.map((item, index) => `<th class="${index ? "num" : ""}">${esc(item)}</th>`).join("")}</tr></thead><tbody>${rows.map((item) => `<tr>${config.cells(item).map((cell, index) => `<td class="${index ? "num" : ""}">${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function budgetGroupedTable(tab, rows) {
    if (tab === "cost") return `<div class="table-wrap"><table class="data-table"><thead><tr><th>单位 / 板块</th><th class="num">最终批准预算</th><th class="num">实际费用</th><th class="num">执行率</th><th class="num">成本占收比</th><th class="num">预算差异</th><th>判定</th><th></th></tr></thead><tbody>${rows.map((item, index) => `<tr><td><strong>${esc(item.name)}</strong></td><td class="num">${fmt(item.budget)}</td><td class="num">${fmt(item.actual)}</td><td class="num">${fmt(item.execution)}%</td><td class="num">${fmt(item.costToRevenue)}%</td><td class="num">${fmt(item.delta)}</td><td>${badge(item.status, toneFor(item.status))}</td><td><button class="text-btn" type="button" data-action="budget-record-detail" data-tab="cost" data-index="${index}">查看详情</button></td></tr>`).join("")}</tbody></table></div>`;
    const groups = rows.reduce((result, item) => { (result[item.group] ||= []).push(item); return result; }, {});
    return `<div class="group-list">${Object.entries(groups).map(([group, items]) => {
      const open = state.budgetExpanded === `${tab}:${group}`;
      const attention = items.filter((item) => item.status !== "正常").length;
      const summary = tab === "project" ? `${items.length} 个项目 · 可用余额 ${fmt(sum(items, "available"))} 万元` : tab === "travel" ? `${items.length} 项费用 · 申报变动 ${fmt(sum(items, "delta"))} 万元` : tab === "accrual" ? `${items.length} 笔配对 · 差异 ${fmt(items.reduce((total, item) => total + Math.abs(item.delta), 0))} 万元` : tab === "concentration" ? `${items.length} 个项目 · 最高占比 ${fmt(Math.max(max(items, "prRate"), max(items, "transitRate")))}%` : `${items.length} 条记录 · 最高倍率 ${fmt(max(items, "ratio"))} 倍`;
      return `<article class="group-row ${open ? "open" : ""}"><button class="group-summary" type="button" data-action="budget-expand" data-key="${attr(tab)}:${attr(group)}"><span class="expand-icon">${icon(open ? "chevron-down" : "chevron-right", "sm")}</span><span><strong>${esc(group)}</strong><small>${esc(summary)}</small></span>${badge(attention ? `${attention} 项关注` : "状态正常", attention ? "warning" : "success")}</button>${open ? `<div class="group-details">${budgetDetailTable(tab, items)}</div>` : ""}</article>`;
    }).join("")}</div>`;
  }

  function budgetTopicContent(dash, tab) {
    const topic = dash.topics.find((item) => item.id === tab) || dash.topics[0];
    const rows = filteredBudgetRows(dash, topic.id);
    const chart = topic.id === "cost" ? `<section class="grid-main wide">${panel("跨年预算执行", "实际费用 ÷ 当年最终批准费用预算", lineChart(dash.annualTrend, "%", "2025 年执行率"), "", "trend-panel")}${panel("部门执行情况", "按当前批准预算口径", `<div class="compare-bars">${dash.units.map((item) => `<div class="compare-bar-row"><span>${esc(item.name)}</span><div><i style="width:${Math.min(100, item.execution)}%"></i></div><strong>${fmt(item.execution)}%</strong></div>`).join("")}</div>`)}</section>` : "";
    const supervision = topic.id === "cost" ? `<section class="supervision-list">${dash.supervision.map((item) => `<article><div>${icon("clipboard-check", "sm")}<span><strong>${esc(item.title)}</strong><small>${esc(item.owner)} · ${esc(item.basis)}</small></span></div>${badge(item.status, toneFor(item.status))}</article>`).join("")}</section>` : "";
    return `${topic.id === "cost" ? metricsGrid(budgetScopedMetrics(dash), { dashboard: "budget" }) : ""}<section class="topic-intro"><div><span class="topic-icon">${icon(topic.icon, "lg")}</span><div><span class="eyebrow">预算监督专题</span><h2>${esc(topic.label)}</h2><p>${esc(topic.description)}</p></div></div><div class="rule-legend"><span>判定口径</span><strong>${esc(topic.rule)}</strong></div></section><section class="topic-stats">${budgetTopicStats(topic.id, rows)}</section>${chart}${panel(`${topic.label}明细`, "先看汇总，再展开到部门、项目或供应商记录", budgetGroupedTable(topic.id, rows), "", "flush-body")}${supervision}`;
  }

  function renderBudget(tab) {
    focusDashboardScenario("S002");
    const dash = byId("budget");
    const valid = dash.topics.some((item) => item.id === tab) ? tab : "cost";
    shell(`<main class="page dashboard-page budget-page" data-screen-label="预算监督管理驾驶舱">${dashboardHeader(dash, { actions: `<a class="btn" href="${BASELINE_ROOT}/report-center/review-lifecycle/index.html#/report/RPT-S002-BUDGET-20260815-001">${icon("file-text", "sm")}查看预算报告</a><a class="btn primary" href="${BASELINE_ROOT}/report-center/review-lifecycle/index.html#/create?definition=RD-BUDGET-001">${icon("file-plus-2", "sm")}生成新内容版本</a>` })}${infoStrip(dash)}${budgetToolbar(dash)}${tabs(dash.topics, valid, "budget")}<div class="dashboard-content">${budgetTopicContent(dash, valid)}</div></main>`);
  }

  function riskSectors(dash) {
    const groups = dash.companies.reduce((result, item) => {
      const key = riskIndustry(item);
      result[key] ||= { name: key, companies: [], counts: { "绿灯": 0, "黄灯": 0, "红灯": 0, "黑灯": 0 } };
      result[key].companies.push(item);
      result[key].counts[item.riskTier] += 1;
      return result;
    }, {});
    return Object.values(groups).map((item) => ({ ...item, average: item.companies.reduce((sumValue, company) => sumValue + company.finalScore, 0) / item.companies.length }));
  }

  function riskIndustry(item) {
    return item.category === "在建企业" ? "新能源产业-风电" : item.category;
  }

  function riskOperatingStage(item) {
    return item.category === "在建企业" ? "建设阶段" : "运营阶段";
  }

  function riskDonut(dash) {
    const total = dash.thresholds.reduce((totalValue, item) => totalValue + item.count, 0) || 1;
    let angle = 0;
    const stops = dash.thresholds.map((item) => { const start = angle; angle += item.count / total * 360; return `${item.color} ${start}deg ${angle}deg`; }).join(",");
    return `<div class="risk-distribution"><div class="risk-donut" style="background:conic-gradient(${stops})"><div><strong>${total}</strong><span>家企业</span></div></div><div class="risk-legend">${dash.thresholds.map((item) => `<button type="button" data-action="risk-tier-jump" data-tier="${attr(item.name)}"><i style="background:${item.color}"></i><span><strong>${esc(item.name)}</strong><small>${esc(item.range)}</small></span><b>${item.count} 家</b></button>`).join("")}</div></div>`;
  }

  function sectorCards(dash) {
    const colors = { "绿灯": "#16806a", "黄灯": "#d39a2c", "红灯": "#c84a43", "黑灯": "#344256" };
    return `<div class="sector-grid">${riskSectors(dash).map((sector) => `<button class="sector-card" type="button" data-action="risk-sector-detail" data-sector="${attr(sector.name)}"><header><span><strong>${esc(sector.name)}</strong><small>${sector.companies.length} 家企业</small></span><b>${fmt(sector.average, 2)} 分均值</b></header><div class="sector-bars">${["绿灯", "黄灯", "红灯", "黑灯"].map((tier) => `<i style="width:${Math.max(sector.counts[tier] ? 3 : 0, sector.counts[tier] / sector.companies.length * 100)}%;background:${colors[tier]}" title="${tier} ${sector.counts[tier]} 家"></i>`).join("")}</div><footer><span>绿 ${sector.counts["绿灯"]}</span><span>黄 ${sector.counts["黄灯"]}</span><span>红 ${sector.counts["红灯"]}</span><span>黑 ${sector.counts["黑灯"]}</span><strong>查看构成 ${icon("chevron-right", "sm")}</strong></footer></button>`).join("")}</div>`;
  }

  function filteredRiskCompanies(dash) {
    const search = state.riskSearch.trim().toLowerCase();
    const list = dash.companies.filter((item) => {
      if (state.riskTier !== "全部" && item.riskTier !== state.riskTier) return false;
      if (state.riskSector !== "全部产业" && riskIndustry(item) !== state.riskSector) return false;
      if (search && !`${item.enterpriseName} ${item.enterpriseId} ${item.category} ${item.focus}`.toLowerCase().includes(search)) return false;
      return true;
    });
    return list.sort((left, right) => state.riskSort === "score-desc" ? right.finalScore - left.finalScore : state.riskSort === "name" ? left.enterpriseName.localeCompare(right.enterpriseName, "zh-CN") : left.finalScore - right.finalScore);
  }

  function riskReportHref(item) {
    return `${BASELINE_ROOT}/report-center/review-lifecycle/index.html?scenarioId=S003&scenarioVersion=S003-v1&scenarioRunId=S003-RUN-20260817163000000-c02200000001&formedAt=2026-08-17T16:30:00.000Z&status=active#/reports/view?reportId=${encodeURIComponent(item.reportId || item.enterpriseId)}`;
  }

  function riskTable(rows, limit = 0) {
    const visible = limit ? rows.slice(0, limit) : rows;
    return `<div class="table-wrap"><table class="data-table risk-table"><thead><tr><th>企业</th><th>产业 / 经营阶段</th><th>重点关注</th><th class="num">综合评分</th><th>风险等级</th><th>报告</th></tr></thead><tbody>${visible.map((item) => `<tr><td><strong>${esc(item.enterpriseName)}</strong><small class="cell-note">${esc(item.enterpriseId)}</small></td><td><strong>${esc(riskIndustry(item))}</strong><small class="cell-note">${esc(riskOperatingStage(item))}</small></td><td>${esc(item.focus)}</td><td class="num"><strong class="risk-score ${toneFor(item.riskTier)}">${fmt(item.finalScore, 2)}</strong></td><td>${badge(item.riskTier, toneFor(item.riskTier))}</td><td><a class="text-btn" href="${attr(riskReportHref(item))}">查看报告</a></td></tr>`).join("")}</tbody></table></div>`;
  }

  function riskOverview(dash) {
    const topRisk = [...dash.companies].sort((left, right) => left.finalScore - right.finalScore).slice(0, 5);
    return `<section class="risk-hero"><div><span class="eyebrow">集团债务风险监测</span><h2>风险结果可解释、可穿透</h2><p>覆盖 ${dash.companies.length} 家企业，全部评分、分档、企业报告和处置状态来自同一正式评估轮次。</p><div class="hero-meta"><span>${icon("calendar-check", "sm")}评估时点 ${esc(displayAsOf(dash.period))}</span><span>${icon("shield-check", "sm")}数据质量通过</span><span>${icon("file-check-2", "sm")}21 份企业报告</span></div></div><div class="hero-score"><span>本轮评估</span><strong>已完成</strong><small>${esc(dash.updatedAt)}</small></div></section>${metricsGrid(dash.metrics, { dashboard: "risk" })}<section class="grid-main risk-overview-grid">${panel("四档风险分布", "当前正式评分结果", riskDonut(dash))}${panel("产业板块监测", "在建状态单独按经营阶段分析，不作为产业板块", sectorCards(dash), `<a class="text-btn" href="${dashboardHref("risk", "analysis")}">产业与薄弱项 ${icon("chevron-right", "sm")}</a>`)}</section><section class="grid-main">${panel("需要优先关注", "按综合评分从低到高排序", `<div class="risk-list">${topRisk.map((item) => `<article><span>${badge(item.riskTier, toneFor(item.riskTier))}</span><div><strong>${esc(item.enterpriseName)}</strong><small>${esc(riskIndustry(item))} · ${esc(item.focus)}</small></div><b>${fmt(item.finalScore, 2)}<small>综合分</small></b><a class="icon-btn" href="${attr(riskReportHref(item))}" aria-label="查看${attr(item.enterpriseName)}报告">${icon("chevron-right", "sm")}</a></article>`).join("")}</div>`, `<a class="text-btn" href="${dashboardHref("risk", "analysis")}">查看风险分布 ${icon("chevron-right", "sm")}</a>`, "flush-body")}${panel("风险触发与行动", "五条亮灯预警逐项核对后提交决策中心", `<div class="risk-action-list">${dash.actions.map((item) => `<article><div><strong>${esc(item.enterprise)}</strong><small>${esc(item.focus)} · ${esc(item.recipient)}</small></div><span><b>${fmt(item.score, 2)}</b>${badge(riskActionStageMeta(riskActionRecord(item)).label, riskActionStageMeta(riskActionRecord(item)).tone)}</span></article>`).join("")}</div>`, `<a class="text-btn" href="${dashboardHref("risk", "actions")}">进入风险处置 ${icon("chevron-right", "sm")}</a>`, "flush-body")}</section>${panel("企业评分明细", `全部 ${dash.companies.length} 家企业`, riskTable([...dash.companies].sort((left, right) => left.finalScore - right.finalScore), 8), `<a class="text-btn" href="${dashboardHref("risk", "analysis")}">查看产业分析 ${icon("chevron-right", "sm")}</a>`, "flush-body")}`;
  }

  function riskStageSummary(dash) {
    const stages = ["运营阶段", "建设阶段"].map((name) => {
      const companies = dash.companies.filter((item) => riskOperatingStage(item) === name);
      return {
        name,
        companies,
        alertCount: companies.filter((item) => item.riskTier !== "绿灯").length,
        average: companies.reduce((sum, item) => sum + item.finalScore, 0) / Math.max(companies.length, 1),
      };
    });
    return `<div class="stage-topic-grid">${stages.map((stage) => `<article class="stage-topic-card"><span class="stage-icon">${icon(stage.name === "建设阶段" ? "hard-hat" : "factory", "lg")}</span><div><strong>${esc(stage.name)}</strong><p>${stage.name === "建设阶段" ? "3 家在建企业作为经营阶段专题观察，产业归属仍为新能源产业-风电。" : "按正式经营企业口径观察财务指标、调节因子与风险分档。"}</p></div><dl><div><dt>企业</dt><dd>${stage.companies.length} 家</dd></div><div><dt>平均分</dt><dd>${fmt(stage.average, 2)}</dd></div><div><dt>需处置</dt><dd>${stage.alertCount} 家</dd></div></dl></article>`).join("")}</div>`;
  }

  function riskAnalysis(dash) {
    const weak = Object.entries(dash.companies.reduce((map, item) => { map[item.focus] = (map[item.focus] || 0) + 1; return map; }, {})).sort((a, b) => b[1] - a[1]);
    return `<section class="panel analysis-sector-panel"><div class="panel-head"><div><h2>产业板块监测</h2><p>仅按真实产业归属汇总；建设状态不再单列为产业。</p></div>${badge("3 个产业板块", "plain")}</div><div class="panel-body">${sectorCards(dash)}</div></section><section class="analysis-insight-grid">${panel("经营阶段专题", "在建与运营是经营阶段，不是产业分类", riskStageSummary(dash), "", "stage-topic-panel")}${panel("薄弱项分布", "当前正式结果中出现频次最高的重点关注指标", `<div class="weak-item-list">${weak.slice(0, 8).map(([name, count], index) => `<article><span class="weak-rank">${String(index + 1).padStart(2, "0")}</span><div><strong>${esc(name)}</strong><small>${count} 家企业列为重点关注</small></div><b>${count} 家</b></article>`).join("")}</div>`, "", "weak-topic-panel")}</section>`;
  }

  const RISK_CONTEXT = Object.freeze({
    scenarioId: "S003",
    scenarioVersion: "S003-v1",
    scenarioRunId: "S003-RUN-20260817163000000-c02200000001",
    formedAt: "2026-08-17T16:30:00.000Z",
    status: "active",
  });
  const S003_MODELING_CONTEXT = Object.freeze({ ...RISK_CONTEXT, status: "completed" });
  const C011_LEGACY_KEY = "ontology3.decision-center.c011.inbox.v1";
  const C011_LOGICAL_KEY = "decision-center.c011.inbox.v3";

  function riskActionRecord(item) {
    const current = state.riskActionStates[item.enterpriseId];
    if (current) return current;
    if (item.decisionStatus === "已形成负责人待办") return { stage: "handled", evidenceViewed: true, confirmedAt: "", submittedAt: "2026-08-17 16:36:00", requestId: riskActionRequestId(item), error: "", attempts: 1 };
    if (item.decisionStatus === "待接口人确认") return { stage: "submitted", evidenceViewed: true, confirmedAt: "", submittedAt: "2026-08-17 16:36:00", requestId: riskActionRequestId(item), error: "", attempts: 1 };
    return { stage: "pending", evidenceViewed: false, confirmedAt: "", submittedAt: "", requestId: "", error: "", attempts: 0 };
  }

  function setRiskActionRecord(item, patch) {
    state.riskActionStates = {
      ...state.riskActionStates,
      [item.enterpriseId]: { ...riskActionRecord(item), ...patch },
    };
    persist();
  }

  function riskActionStageMeta(record) {
    return {
      pending: { label: "待处理", tone: "plain", icon: "circle-dashed" },
      confirmed: { label: "已确认待提交", tone: "warning", icon: "badge-check" },
      submitting: { label: "提交中", tone: "warning", icon: "loader-circle" },
      submitted: { label: "已提交", tone: "success", icon: "circle-check" },
      handled: { label: "已形成待办", tone: "success", icon: "circle-check" },
      failed: { label: "提交失败", tone: "danger", icon: "circle-alert" },
    }[record.stage] || { label: "待处理", tone: "plain", icon: "circle-dashed" };
  }

  function riskActionRequestId(item) {
    return `AR-S003-CAND-${RISK_CONTEXT.scenarioRunId}-${item.enterpriseId}-${item.actionTypeId}-2025-12-31-1.1.0`;
  }

  function buildRiskActionRequest(item, now = new Date()) {
    const iso = now.toISOString();
    const displayTime = localDateTime(now);
    const requestId = riskActionRequestId(item);
    const snapshotId = `S003-C035-${RISK_CONTEXT.scenarioRunId}-${item.enterpriseId}`;
    return {
      schemaVersion: "ofw.s003.c011.action-request.v2",
      id: requestId,
      requestId,
      candidateId: requestId.replace(/^AR-/, ""),
      sourceCandidateId: requestId.replace(/^AR-/, ""),
      scenarioContext: clone(RISK_CONTEXT),
      scenarioIdentity: clone(RISK_CONTEXT),
      scenario: "债务风险监测",
      sourceType: "report",
      sourceRef: `债务风险驾驶舱 · ${snapshotId}`,
      requester: "集团债务风险管理人员",
      submittedBy: "集团债务风险管理人员",
      requestTime: displayTime,
      generatedTime: displayTime,
      subjectId: item.enterpriseId,
      subjectName: item.enterprise,
      singleBusinessSubjectId: item.enterpriseId,
      singleBusinessSubjectName: item.enterprise,
      actionType: {
        id: item.actionTypeId,
        name: item.actionTypeName,
        description: `${item.tier}企业按当前亮灯形成一条风险行动申请，由成员单位接口人确认后再分办。`,
        version: item.actionTypeVersion,
        status: "已发布",
      },
      rule: null,
      ruleApplicability: `不适用；本次为驾驶舱人工确认后提交的${item.tier}风险行动`,
      metric: {
        id: "MET-S003-FINAL-RISK-SCORE",
        name: "企业最终风险评分",
        value: `${fmt(item.score, 2)} 分`,
        explanation: item.basis,
        evaluatedAt: "2025-12-31",
        scope: `${item.enterprise} · ${item.category}`,
      },
      owner: null,
      ownerId: null,
      recommendedTaskOwner: item.recommendedOwner,
      recommendation: item.recommendation,
      decisionRecipient: {
        enterpriseId: item.enterpriseId,
        memberUnitId: item.memberUnitId,
        memberUnitName: item.enterprise,
        recipientId: item.recipientId,
        recipientName: item.recipient,
        role: "成员单位债务风险接口人",
      },
      routingTarget: { type: "member-unit-decision-center", organizationId: item.memberUnitId, organizationName: item.enterprise },
      recipientRole: "成员单位债务风险接口人",
      evidence: {
        semanticVersion: `S003-M01-DEBT-RISK-PKG ${initialRiskConfig.publishedVersion}`,
        dataVersion: "S003-T007-DEBT-RISK-20251231-v1",
        dataAssetId: "S003-T007-DEBT-RISK-20251231-v1",
        resultVersion: "1.1.0",
        cutoff: "2025-12-31",
        quality: "允许推进",
        availability: "完整可用",
        ready: "C017 接收安全门待决策中心重读",
        snapshotId,
        freshness: "固定运行证据",
        reportId: `S003-RPT-${RISK_CONTEXT.scenarioRunId}-${item.enterpriseId}`,
        reportRoute: `#/reports/view?enterpriseId=${encodeURIComponent(item.enterpriseId)}&runId=${encodeURIComponent(RISK_CONTEXT.scenarioRunId)}`,
      },
      sourceEvents: [{ type: "驾驶舱人工提交", time: displayTime, reason: "集团债务风险管理人员逐户核对固定证据后提交标准 Action Request" }],
      automatic: false,
      clientWorkspaceVersion: "ofw.dashboard.workspace.v7",
      actionRequestImmutable: false,
      taskId: null,
      decision: null,
      idempotencyKey: `${RISK_CONTEXT.scenarioRunId}|${item.enterpriseId}|${item.actionTypeId}|2025-12-31|1.1.0`,
      submittedAt: iso,
    };
  }

  function parseStoredJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (_) { return null; }
  }

  function writeRiskActionRequest(request) {
    const physicalKey = `ofw:v1.1.0:${RISK_CONTEXT.scenarioId}:${RISK_CONTEXT.scenarioVersion}:${RISK_CONTEXT.scenarioRunId}:m04:${encodeURIComponent(C011_LOGICAL_KEY)}`;
    const existingEnvelope = parseStoredJson(physicalKey);
    const currentPayload = existingEnvelope?.payload?.contractCode === "C011" ? existingEnvelope.payload : null;
    const requests = new Map((currentPayload?.requests || []).map((item) => [item.id || item.requestId, item]));
    requests.set(request.id, request);
    const payload = {
      schemaVersion: "ofw.s003.c011.dashboard-inbox.v2",
      contractCode: "C011",
      sourceModule: "报告中心仪表盘",
      consumer: "决策中心",
      scenarioContext: clone(RISK_CONTEXT),
      formedAt: request.submittedAt,
      requests: [...requests.values()],
    };
    localStorage.setItem(physicalKey, JSON.stringify({ schemaVersion: "ofw.namespaced-storage.v1", scenarioContext: clone(RISK_CONTEXT), savedAt: request.submittedAt, payload }));
    return request.id;
  }

  async function submitRiskAction(item) {
    const current = riskActionRecord(item);
    if (current.stage === "submitting") return;
    if (current.stage === "submitted") return toast("该风险已按同一行动申请标识提交，未重复创建");
    if (current.stage !== "confirmed" && current.stage !== "failed") return toast("请先查看依据并确认风险");
    setRiskActionRecord(item, { stage: "submitting", error: "", attempts: Number(current.attempts || 0) + 1 });
    render();
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 720));
      const request = buildRiskActionRequest(item);
      const requestId = writeRiskActionRequest(request);
      setRiskActionRecord(item, { stage: "submitted", requestId, submittedAt: localDateTime(), error: "" });
      render(); toast(`${item.enterprise}的行动申请已提交，等待决策中心人工确认`);
    } catch (error) {
      setRiskActionRecord(item, { stage: "failed", error: error?.message || "行动申请未送达，确认结果和固定证据均已保留" });
      render(); toast("行动申请未送达，可重新提交");
    }
  }

  function riskActionCard(item) {
    const record = riskActionRecord(item);
    const stage = riskActionStageMeta(record);
    const submitted = record.stage === "submitted";
    const failed = record.stage === "failed";
    return `<article class="risk-candidate-card ${attr(record.stage)}" data-enterprise-id="${attr(item.enterpriseId)}">
      <header class="risk-candidate-heading"><div class="risk-candidate-score">${badge(item.tier, toneFor(item.tier))}<strong>${fmt(item.score, 2)}</strong><span>综合分</span></div><div><h3>${esc(item.enterprise)}</h3><p>${esc(riskIndustry(item))} · ${esc(item.enterpriseId)}</p></div>${badge(stage.label, stage.tone)}</header>
      <div class="risk-candidate-main"><section class="risk-disposal-reason"><span class="candidate-label">为何需要处置</span><strong>${esc(item.focus)}</strong><p>${esc(item.basis)}</p></section><section class="risk-disposal-plan"><span class="candidate-label">建议处置安排</span><p>${esc(item.recommendation)}</p></section><div class="candidate-facts"><span><b>行动类型</b>${esc(item.actionTypeName)}</span><span><b>接收接口人</b>${esc(item.recipient)}</span><span><b>建议负责人</b>${esc(item.recommendedOwner)}</span><span><b>决策进展</b>${esc(item.decisionStatus)}</span></div>${record.error ? `<div class="inline-failure">${icon("circle-alert", "sm")}<span>${esc(record.error)}</span></div>` : ""}${submitted ? `<div class="inline-success">${icon("circle-check", "sm")}<span>行动申请已进入决策中心收件，等待接口人复核；尚未形成负责人待办。</span></div>` : ""}</div>
      <div class="risk-candidate-actions"><button class="btn" type="button" data-action="risk-action-evidence" data-enterprise-id="${attr(item.enterpriseId)}">${icon("file-search", "sm")}查看处置依据</button>${record.stage === "pending" ? `<button class="btn primary" type="button" data-action="risk-action-confirm" data-enterprise-id="${attr(item.enterpriseId)}" ${record.evidenceViewed ? "" : "disabled"}>${icon("badge-check", "sm")}确认需要处置</button>` : record.stage === "confirmed" ? `<button class="btn" type="button" data-action="risk-action-unconfirm" data-enterprise-id="${attr(item.enterpriseId)}">${icon("undo-2", "sm")}撤销确认</button><button class="btn primary" type="button" data-action="risk-action-submit" data-enterprise-id="${attr(item.enterpriseId)}">${icon("send", "sm")}发起处置行动</button>` : record.stage === "submitting" ? `<button class="btn primary" type="button" disabled>${icon("loader-circle", "sm")}正在提交</button>` : failed ? `<button class="btn primary" type="button" data-action="risk-action-submit" data-enterprise-id="${attr(item.enterpriseId)}">${icon("refresh-cw", "sm")}重新提交</button>` : `<a class="btn primary" href="${BASELINE_ROOT}/decision-center-prototype/index.html#/operations/intake">${icon("external-link", "sm")}查看决策进展</a>`}<small>${record.stage === "pending" && !record.evidenceViewed ? "核对评分、数据版本与处置建议后方可确认" : record.stage === "handled" ? "负责人待办及后续状态由决策中心维护" : submitted ? "重复提交会沿用同一行动申请，不会新增待办" : "确认只针对本条预警，不影响其他企业"}</small></div>
    </article>`;
  }

  function riskActions(dash) {
    const counts = dash.actions.reduce((result, item) => {
      const stage = riskActionRecord(item).stage;
      result[stage] = (result[stage] || 0) + 1;
      return result;
    }, {});
    return `<section class="risk-action-workspace"><header class="risk-action-summary"><div><span class="eyebrow">风险处置工作区</span><h2>风险处置行动</h2><p>这里只呈现五条已触发预警、需要人工判断的事项，不混入正常企业明细。</p></div><div class="action-summary-counts"><span><b>${dash.actions.length}</b>预警事项</span><span><b>${counts.pending || 0}</b>待处理</span><span><b>${counts.confirmed || 0}</b>待发起</span><span><b>${(counts.submitted || 0) + (counts.handled || 0)}</b>已送达</span></div></header><div class="disposal-guidance"><span>${icon("route", "sm")}</span><div><strong>每条事项按同一顺序处理</strong><p>查看处置依据 → 确认需要处置 → 发起标准行动申请 → 到决策中心跟踪确认与负责人待办。</p></div></div><div class="risk-candidate-list">${dash.actions.map(riskActionCard).join("")}</div><footer class="risk-action-boundary">${icon("shield-check", "sm")}发起成功只表示行动申请已送达决策中心；接口人确认后才可形成负责人待办，本页不直接执行处置。</footer></section>`;
  }

  function sameS003Identity(value) {
    const context = objectRecord(value);
    return context && ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"]
      .every((field) => typeof context[field] === "string" && context[field] === S003_MODELING_CONTEXT[field]);
  }

  function s003PostMessage(type, detail = {}) {
    const targetOrigin = location.origin && location.origin !== "null" ? location.origin : "*";
    window.parent.postMessage({
      type,
      scenarioId: S003_MODELING_CONTEXT.scenarioId,
      scenarioVersion: S003_MODELING_CONTEXT.scenarioVersion,
      scenarioRunId: S003_MODELING_CONTEXT.scenarioRunId,
      formedAt: S003_MODELING_CONTEXT.formedAt,
      status: S003_MODELING_CONTEXT.status,
      scenarioContext: clone(S003_MODELING_CONTEXT),
      objectiveId: S003_MODELING_SCHEMA.objective.objectiveId,
      consumerId: S003_MODELING_SCHEMA.consumerId,
      ...detail,
    }, targetOrigin);
  }

  async function requestS003ModelingContext() {
    if (s003Modeling.requestState === "requesting") return;
    s003Modeling.requestState = "requesting";
    s003Modeling.contractError = "";
    const current = route();
    if (current.type === "view" && current.id === "risk" && current.tab === "operations") render();
    try {
      const workspace = await modelingApi("/v1/s003/workspace");
      s003Modeling.workspace = workspace;
      const requests = [
        ["candidateResult", { resultKind: "PREDICTION", usageIntent: "WHAT_IF" }],
        ["shadowResult", { resultKind: "SHADOW", usageIntent: "SHADOW" }],
        ["simulationResult", { resultKind: "SIMULATION", useKind: "STRESS" }]
      ];
      await Promise.all(requests.map(async ([field, body]) => {
        try {
          const response = await modelingApi("/v1/s003/results/recalculate", { method: "POST", body: JSON.stringify({ scenarioContext: S003_MODELING_CONTEXT, ...body }) });
          s003Modeling[field] = response.resultEnvelope;
        } catch (_) {
          s003Modeling[field] = null;
        }
      }));
      const candidates = s003CandidateCatalog();
      if (!state.riskModelingSelection.modelVersionId && candidates.length) state.riskModelingSelection.modelVersionId = candidates.at(-1).modelVersionId;
      const dataVersion = firstDefined(s003Modeling.candidateResult?.inputSnapshot?.dataVersionId, workspace.report?.fixedContext?.outcomeDataVersion);
      if (dataVersion) state.riskModelingSelection.dataVersionId = dataVersion;
      s003Modeling.receivedAt = localDateTime();
      s003Modeling.requestState = "complete";
    } catch (error) {
      s003Modeling.requestState = "failed";
      s003Modeling.contractError = `${error.code || "MODELING_CONTEXT_FAILED"} · ${error.message}`;
    }
    if (current.type === "view" && current.id === "risk" && current.tab === "operations") render();
  }

  function focusS003Scenario() {
    if (s003Modeling.focusRequested) return;
    s003Modeling.focusRequested = true;
    s003PostMessage(S003_MODELING_SCHEMA.messages.scenarioFocus, { requestedAt: new Date().toISOString() });
  }

  function focusDashboardScenario(scenarioId) {
    if (!scenarioId || dashboardFocusRequests.has(scenarioId)) return;
    dashboardFocusRequests.add(scenarioId);
    const targetOrigin = location.origin && location.origin !== "null" ? location.origin : "*";
    window.parent.postMessage({ type: "OFW_DASHBOARD_SCENARIO_FOCUS", scenarioId, requestedAt: new Date().toISOString() }, targetOrigin);
  }

  function openS003Objective() {
    s003PostMessage(S003_MODELING_SCHEMA.messages.openObjective, {
      returnRoute: "#dashboard",
      returnDashboardRoute: "#/view/risk/operations",
      view: "consumption",
      requestedAt: new Date().toISOString(),
    });
  }

  function s003CandidateCatalog() {
    const workspace = s003Modeling.workspace || {};
    const source = firstDefined(workspace.candidates, workspace.candidateVersions, workspace.modelVersions, []);
    return (Array.isArray(source) ? source : []).map((item) => ({
      id: firstDefined(item.candidateId, item.id, item.modelVersionId, item.modelVersion?.modelVersionId),
      modelVersionId: firstDefined(item.modelVersionId, item.modelVersion?.modelVersionId, item.candidateId, item.id),
      label: firstDefined(item.displayName, item.name, item.label, item.modelVersion?.name, item.version, item.modelVersionId, item.candidateId, item.id),
      version: firstDefined(item.version, item.modelVersion?.modelVersion, item.modelVersionId, "候选"),
      status: ({ EVALUATED: "已评测", PENDING_EVALUATION: "尚未评测", EVALUATED_AWAITING_SHADOW: "已评测，可进入影子试运行", DATA_REQUIRED: "数据待补齐" })[String(firstDefined(item.status, item.evaluationStatus, ""))] || String(firstDefined(item.status, item.evaluationStatus, "尚未评测")),
      blockedReason: firstDefined(item.blockedReason, item.missingReason, item.reason, ""),
    })).filter((item) => item.id && item.modelVersionId);
  }

  function s003FormalEnvelope(dash) {
    if (s003Modeling.formalResult) return s003Modeling.formalResult;
    const binding = S003_MODELING_SCHEMA.formalBinding;
    return {
      schemaVersion: S003_MODELING_SCHEMA.resultEnvelope.schemaVersion,
      resultId: `S003-C035-${S003_MODELING_CONTEXT.scenarioRunId}`,
      resultKind: "FACT",
      useKind: "FORMAL",
      objectiveId: S003_MODELING_SCHEMA.objective.objectiveId,
      bindingRef: { bindingId: binding.bindingId, revision: binding.bindingRevision },
      releaseSelector: { modelVersionId: binding.modelVersionId },
      inputSnapshot: {
        scenarioContext: clone(S003_MODELING_CONTEXT),
        asOf: binding.assessmentAsOf,
        dataVersionId: binding.dataVersionId,
        ontologyVersionId: binding.ontologyVersionId,
      },
      outputs: dash.companies.map((item) => ({
        enterpriseId: item.enterpriseId,
        enterpriseName: item.enterpriseName,
        industry: riskIndustry(item),
        operatingStage: riskOperatingStage(item),
        riskScore: item.finalScore,
        riskIndex: item.finalScore,
        predictedRiskTier: item.riskTier,
        coverage: 1,
        topContributors: [{ name: item.focus, kind: "METRIC", value: null, contribution: null, evidenceStatus: "归档结果仅保留重点项" }],
        reportId: item.reportId,
        evidenceRefs: [item.reportId].filter(Boolean),
      })),
      coverage: 1,
      evidenceRefs: dash.companies.map((item) => item.reportId).filter(Boolean),
      formedAt: S003_MODELING_CONTEXT.formedAt,
      immutable: true,
    };
  }

  function s003TierLabel(value) {
    const normalized = String(value || "").trim().toUpperCase();
    return ({ GREEN: "绿灯", YELLOW: "黄灯", RED: "红灯", BLACK: "黑灯", "绿灯": "绿灯", "黄灯": "黄灯", "红灯": "红灯", "黑灯": "黑灯" })[normalized] || String(value || "未分档");
  }

  function s003EnvelopeOutputs(envelope) {
    for (const key of S003_MODELING_SCHEMA.resultEnvelope.subjectCollectionAliases) {
      if (Array.isArray(envelope?.[key])) return envelope[key];
    }
    return [];
  }

  function s003AliasValue(record, aliases) {
    for (const key of aliases) if (record?.[key] !== undefined && record?.[key] !== null && record?.[key] !== "") return record[key];
    return undefined;
  }

  function s003SubjectId(record) {
    return firstDefined(s003AliasValue(record, S003_MODELING_SCHEMA.resultEnvelope.subjectIdentityAliases), record?.objectRef?.id);
  }

  function s003SubjectContributors(record) {
    const aliases = S003_MODELING_SCHEMA.resultEnvelope.contributorCollectionAliases;
    const source = s003AliasValue(record, aliases);
    return (Array.isArray(source) ? source : []).map((item) => ({
      id: firstDefined(item.id, item.metricId, item.factorId, item.name, item.label, "contributor"),
      name: firstDefined(item.name, item.label, item.metricName, item.factorName, item.id, "未命名贡献项"),
      kind: String(firstDefined(item.kind, item.contributorKind, item.type, "METRIC")).toUpperCase(),
      value: firstDefined(item.value, item.observedValue),
      contribution: firstDefined(item.contribution, item.contributionValue, item.scoreContribution),
      baselineContribution: firstDefined(item.baselineContribution, item.previousContribution),
      delta: firstDefined(item.delta, item.contributionDelta),
      evidenceRef: firstDefined(item.evidenceRef, item.sourceRef, ""),
    }));
  }

  function s003NormalizedEnvelope(envelope, dash = byId("risk")) {
    const formal = envelope?.resultKind === "FACT" ? null : s003NormalizedEnvelope(s003FormalEnvelope(dash), dash);
    const baselineById = new Map((formal?.subjects || []).map((item) => [item.id, item]));
    const subjects = s003EnvelopeOutputs(envelope).map((item) => {
      const id = s003SubjectId(item);
      const baseline = objectRecord(item.baseline) || baselineById.get(id) || null;
      const score = s003AliasValue(item, S003_MODELING_SCHEMA.resultEnvelope.scoreAliases);
      const tier = s003TierLabel(s003AliasValue(item, S003_MODELING_SCHEMA.resultEnvelope.tierAliases));
      return {
        id,
        name: firstDefined(item.enterpriseName, item.objectName, item.subjectName, item.objectRef?.title, item.objectRef?.name, id),
        industry: firstDefined(item.industry, item.category, item.objectRef?.industry, baseline?.industry, "未提供产业"),
        operatingStage: firstDefined(item.operatingStage, item.stage, item.objectRef?.operatingStage, baseline?.operatingStage, "未提供经营阶段"),
        score: Number.isFinite(Number(score)) ? Number(score) : null,
        tier,
        riskIndex: firstDefined(item.riskIndex, score),
        coverage: firstDefined(item.coverage, envelope.coverage),
        probability30d: firstDefined(item.probability30d, item.horizons?.probability30d),
        probability90d: firstDefined(item.probability90d, item.horizons?.probability90d),
        probability180d: firstDefined(item.probability180d, item.horizons?.probability180d),
        survivalCurve: Array.isArray(firstDefined(item.survivalCurve, item.horizons?.survivalCurve)) ? firstDefined(item.survivalCurve, item.horizons?.survivalCurve) : [],
        expectedRiskWindow: firstDefined(item.expectedRiskWindow, item.riskWindow),
        mostLikelyEventType: firstDefined(item.mostLikelyEventType, item.eventType),
        mostLikelyEventProbability: firstDefined(item.mostLikelyEventProbability, item.eventTypeProbability),
        eventTypeProbabilities: objectRecord(firstDefined(item.eventTypeProbabilities, item.eventProbabilities)) || {},
        liquidityGap30d: firstDefined(item.liquidityGap30d, item.liquidity?.gap30dMillions),
        liquidityGap90d: firstDefined(item.liquidityGap90d, item.liquidity?.gap90dMillions),
        liquidityGap180d: firstDefined(item.liquidityGap180d, item.liquidity?.gap180dMillions),
        maturityWall: Array.isArray(firstDefined(item.maturityWall, item.liquidity?.maturityWall)) ? firstDefined(item.maturityWall, item.liquidity?.maturityWall) : [],
        refinancePressure: firstDefined(item.refinancePressure, item.liquidity?.refinancePressure),
        liquidityMissingReason: firstDefined(item.liquidityMissingReason, item.liquidity?.missingReason, ""),
        relationRiskScore: firstDefined(item.relationRiskScore, item.relation?.score),
        relationStatus: firstDefined(item.relationStatus, item.relation?.status),
        relationRiskPath: Array.isArray(firstDefined(item.relationRiskPath, item.riskPath, item.relation?.path)) ? firstDefined(item.relationRiskPath, item.riskPath, item.relation?.path) : [],
        relationMissingReason: firstDefined(item.relationMissingReason, item.relation?.missingReason, ""),
        anomalyScore: firstDefined(item.anomalyScore, item.anomaly?.score),
        anomalyStatus: firstDefined(item.anomalyStatus, item.anomaly?.status),
        anomalyEvents: Array.isArray(firstDefined(item.anomalyEvents, item.anomaly?.events)) ? firstDefined(item.anomalyEvents, item.anomaly?.events) : [],
        confidence: firstDefined(item.confidence?.status, item.confidenceStatus, item.confidence),
        confidenceScore: firstDefined(item.confidence?.score, item.coverage, envelope.coverage),
        confidenceMissingReasons: firstDefined(item.confidence?.missingReasons, item.missingReasons, []),
        contributors: s003SubjectContributors(item),
        evidenceRefs: Array.isArray(item.evidenceRefs) ? item.evidenceRefs : [item.reportId].filter(Boolean),
        baseline: baseline || item.baselineRiskScore !== undefined || item.baselineRiskTier !== undefined ? {
          score: Number(firstDefined(baseline?.riskScore, baseline?.finalScore, baseline?.score, item.baselineRiskScore)),
          tier: s003TierLabel(firstDefined(baseline?.predictedRiskTier, baseline?.riskTier, baseline?.tier, item.baselineRiskTier)),
        } : null,
        reportId: item.reportId,
      };
    }).filter((item) => item.id);
    const tiers = ["绿灯", "黄灯", "红灯", "黑灯"];
    const distribution = Object.fromEntries(tiers.map((tier) => [tier, subjects.filter((item) => item.tier === tier).length]));
    const slice = (field) => Object.values(subjects.reduce((result, item) => {
      const key = item[field];
      result[key] ||= { name: key, count: 0, scoreTotal: 0, scoreCount: 0, alerts: 0 };
      result[key].count += 1;
      if (item.score !== null) { result[key].scoreTotal += item.score; result[key].scoreCount += 1; }
      if (item.tier !== "绿灯") result[key].alerts += 1;
      return result;
    }, {})).map((item) => ({ ...item, average: item.scoreCount ? item.scoreTotal / item.scoreCount : null }));
    const migration = Object.fromEntries(tiers.map((from) => [from, Object.fromEntries(tiers.map((to) => [to, 0]))]));
    subjects.forEach((item) => { if (item.baseline && migration[item.baseline.tier]?.[item.tier] !== undefined) migration[item.baseline.tier][item.tier] += 1; });
    return {
      raw: envelope,
      resultKind: String(envelope?.resultKind || "").toUpperCase(),
      useKind: String(firstDefined(envelope?.useKind, envelope?.usageIntent, "FORMAL")).toUpperCase(),
      resultId: firstDefined(envelope?.resultId, envelope?.resultEnvelopeId, envelope?.id, "未提供"),
      runId: firstDefined(envelope?.runId, envelope?.modelRunId, "未提供"),
      modelId: firstDefined(envelope?.modelId, "未提供"),
      modelRole: firstDefined(envelope?.modelRole, envelope?.resultKind === "FACT" ? "FORMAL_BASELINE" : "MODEL_RESULT"),
      modelVersionId: firstDefined(envelope?.releaseSelector?.modelVersionId, envelope?.modelVersionId, envelope?.modelVersion, S003_MODELING_SCHEMA.formalBinding.modelVersionId),
      bindingId: firstDefined(envelope?.bindingRef?.bindingId, envelope?.bindingId, S003_MODELING_SCHEMA.formalBinding.bindingId),
      bindingRevision: firstDefined(envelope?.bindingRef?.revision, envelope?.bindingRevision, envelope?.bindingRevisionId, S003_MODELING_SCHEMA.formalBinding.bindingRevision),
      dataVersionId: firstDefined(envelope?.inputSnapshot?.dataVersionId, envelope?.dataVersionId, envelope?.dataVersion, S003_MODELING_SCHEMA.formalBinding.dataVersionId),
      semanticContractVersionId: firstDefined(envelope?.inputSnapshot?.ontologyVersionId, envelope?.semanticContractVersionId, envelope?.ontologyVersionId, S003_MODELING_SCHEMA.formalBinding.ontologyVersionId),
      asOf: firstDefined(envelope?.inputSnapshot?.asOf, envelope?.assessmentAsOf, envelope?.asOf, S003_MODELING_SCHEMA.formalBinding.assessmentAsOf),
      benchmark: firstDefined(envelope?.summaries?.benchmark, envelope?.benchmarkSummary, envelope?.benchmark, s003Modeling.workspace?.lastBenchmark, s003Modeling.workspace?.benchmarkReport, null),
      coverage: firstDefined(envelope?.coverage, null),
      subjects,
      distribution,
      industrySlices: slice("industry"),
      stageSlices: slice("operatingStage"),
      migration,
      evidenceRefs: Array.isArray(envelope?.evidenceRefs) ? envelope.evidenceRefs : [],
      formedAt: firstDefined(envelope?.formedAt, envelope?.completedAt, ""),
    };
  }

  function validateS003CandidateEnvelope(envelope) {
    if (!objectRecord(envelope)) return "消息缺少 Result Envelope。";
    if (!S003_MODELING_SCHEMA.resultEnvelope.acceptedSchemaVersions.includes(envelope.schemaVersion)) return "Result Envelope schemaVersion 不受支持。";
    const objectiveId = firstDefined(envelope.objectiveId, envelope.objectiveRevisionId);
    if (!String(objectiveId || "").startsWith(S003_MODELING_SCHEMA.objective.objectiveId)) return "Result Envelope Objective 不匹配。";
    if (String(envelope.resultKind).toUpperCase() !== "PREDICTION") return "候选试算必须返回 PREDICTION。";
    const useKind = String(firstDefined(envelope.useKind, envelope.usageIntent, "")).toUpperCase();
    if (!S003_MODELING_SCHEMA.resultEnvelope.acceptedCandidateUseKinds.includes(useKind)) return "候选试算用途必须为 WHAT_IF 或 SHADOW。";
    const factWriteAllowed = firstDefined(envelope.factWriteAllowed, envelope.permissions?.factWriteAllowed);
    const actionWriteAllowed = firstDefined(envelope.actionWriteAllowed, envelope.permissions?.actionWriteAllowed);
    const actionSourceAllowed = firstDefined(envelope.actionSourceAllowed, envelope.permissions?.actionSourceAllowed);
    if (factWriteAllowed !== false || actionWriteAllowed !== false || actionSourceAllowed !== false) return "候选结果未声明事实、行动和行动来源三重禁写。";
    const scenarioContext = [envelope.inputSnapshot, envelope.inputSnapshot?.scenarioContext, envelope.scenarioContext].find(sameS003Identity);
    if (!scenarioContext) return "Result Envelope 的五字段 S003 身份不匹配。";
    const outputs = s003EnvelopeOutputs(envelope);
    if (!outputs.length) return "Result Envelope 未提供企业级输出。";
    const missingRequired = outputs.some((item) => s003SubjectId(item) === undefined
      || s003AliasValue(item, S003_MODELING_SCHEMA.resultEnvelope.scoreAliases) === undefined
      || s003AliasValue(item, S003_MODELING_SCHEMA.resultEnvelope.tierAliases) === undefined);
    if (missingRequired) return "企业级输出缺少身份、评分或分档。";
    return "";
  }

  function acceptS003ModelingContext(payload) {
    if (!sameS003Identity(payload?.scenarioContext)) return "消息缺少匹配的 S003 五字段身份。";
    if (payload.objectiveId !== S003_MODELING_SCHEMA.objective.objectiveId) return "消息 Objective 不匹配。";
    if (objectRecord(payload.workspace)) s003Modeling.workspace = payload.workspace;
    const formal = firstDefined(payload.formalResult, payload.workspace?.formalResult);
    if (objectRecord(formal) && String(formal.resultKind).toUpperCase() === "FACT") s003Modeling.formalResult = formal;
    const candidate = firstDefined(payload.candidateResult, payload.resultEnvelope, payload.workspace?.resultEnvelope);
    if (candidate) {
      const error = validateS003CandidateEnvelope(candidate);
      if (error) return error;
      s003Modeling.candidateResult = candidate;
    }
    if (objectRecord(payload.shadowResult)) s003Modeling.shadowResult = payload.shadowResult;
    if (objectRecord(payload.simulationResult)) s003Modeling.simulationResult = payload.simulationResult;
    const candidates = s003CandidateCatalog();
    if (!state.riskModelingSelection.modelVersionId && candidates.length) state.riskModelingSelection.modelVersionId = candidates[0].modelVersionId;
    s003Modeling.receivedAt = localDateTime();
    s003Modeling.requestState = "idle";
    s003Modeling.contractError = "";
    return "";
  }

  function acceptS003ModelingResult(payload) {
    if (!sameS003Identity(payload?.scenarioContext)) return "消息缺少匹配的 S003 五字段身份。";
    if (payload.objectiveId !== S003_MODELING_SCHEMA.objective.objectiveId) return "消息 Objective 不匹配。";
    const envelope = firstDefined(payload.resultEnvelope, payload.result);
    const error = validateS003CandidateEnvelope(envelope);
    if (error) return error;
    if (objectRecord(payload.workspace)) s003Modeling.workspace = payload.workspace;
    s003Modeling.candidateResult = envelope;
    s003Modeling.receivedAt = localDateTime();
    s003Modeling.requestState = "complete";
    s003Modeling.contractError = "";
    state.riskModelingView = "candidate";
    persist();
    return "";
  }

  async function requestS003CandidateResult() {
    const selection = state.riskModelingSelection;
    const candidate = s003CandidateCatalog().find((item) => item.modelVersionId === selection.modelVersionId);
    if (!candidate) return toast("请先从模型优化中心选择可评测的候选版本");
    if (/DATA_REQUIRED|数据待补齐/i.test(candidate.status)) return toast(candidate.blockedReason || "该候选缺少语义或历史数据，不能形成试算结果");
    s003Modeling.requestState = "requesting";
    s003Modeling.contractError = "";
    render();
    try {
      if (selection.useKind === "STRESS") {
        await modelingApi("/v1/continuous/actions/run-stress", { method: "POST", body: JSON.stringify({ parameters: { interestRateBps: 150, creditSpreadBps: 200, liquidityHaircutPct: 12, refinanceShockPct: 18 } }) });
      }
      const requestedKind = selection.useKind === "STRESS" ? "SIMULATION" : selection.useKind === "SHADOW" ? "SHADOW" : "PREDICTION";
      const response = await modelingApi("/v1/s003/results/recalculate", { method: "POST", body: JSON.stringify({ scenarioContext: S003_MODELING_CONTEXT, candidateId: candidate.id, modelVersionId: candidate.modelVersionId, resultKind: requestedKind, usageIntent: selection.useKind === "SHADOW" ? "SHADOW" : selection.useKind === "STRESS" ? "WHAT_IF" : "WHAT_IF", useKind: selection.useKind, asOf: selection.asOf, dataVersionId: selection.dataVersionId, enterpriseScope: selection.enterpriseScope }) });
      if (requestedKind === "SIMULATION") s003Modeling.simulationResult = response.resultEnvelope;
      else if (requestedKind === "SHADOW") s003Modeling.shadowResult = response.resultEnvelope;
      else s003Modeling.candidateResult = response.resultEnvelope;
      s003Modeling.workspace = response.workspace || s003Modeling.workspace;
      s003Modeling.requestState = "complete";
      s003Modeling.receivedAt = localDateTime();
      s003Modeling.contractError = "";
      state.riskModelingView = selection.useKind === "STRESS" ? "simulation" : selection.useKind === "SHADOW" ? "shadow" : "candidate";
      persist();
    } catch (error) {
      s003Modeling.requestState = "failed";
      s003Modeling.contractError = `${error.code || "RECALCULATION_FAILED"} · ${error.message}`;
    }
    render();
  }

  function s003ResultRole(result) {
    if (result.resultKind === "FACT") return { label: "FACT · 正式只读", tone: "success" };
    if (result.resultKind === "SIMULATION") return { label: "SIMULATION · STRESS", tone: "warning" };
    return { label: `PREDICTION · ${result.useKind}`, tone: "warning" };
  }

  function s003Distribution(result) {
    const colors = { "绿灯": "#16806a", "黄灯": "#d39a2c", "红灯": "#c84a43", "黑灯": "#344256" };
    const total = result.subjects.length || 1;
    return `<div class="s003-distribution">${Object.entries(result.distribution).map(([tier, count]) => `<article><i style="--tier-color:${colors[tier]};--tier-width:${count / total * 100}%"></i><span>${esc(tier)}</span><strong>${count}</strong><small>${fmt(count / total * 100, 1)}%</small></article>`).join("")}</div>`;
  }

  function s003SliceTable(result) {
    const rows = [
      ...result.industrySlices.map((item) => ({ ...item, type: "产业" })),
      ...result.stageSlices.map((item) => ({ ...item, type: "经营阶段" })),
    ];
    return `<div class="table-wrap"><table class="data-table s003-slice-table"><thead><tr><th>切片</th><th>类型</th><th class="num">企业</th><th class="num">平均评分</th><th class="num">非绿灯</th></tr></thead><tbody>${rows.map((item) => `<tr><td><strong>${esc(item.name)}</strong></td><td>${esc(item.type)}</td><td class="num">${item.count}</td><td class="num">${item.average === null ? "无法评价" : fmt(item.average, 2)}</td><td class="num">${item.alerts}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function s003EnterpriseTable(result) {
    const candidate = result.resultKind !== "FACT";
    if (!candidate) {
      return `<div class="table-wrap"><table class="data-table s003-enterprise-table"><thead><tr><th>企业</th><th>产业 / 经营阶段</th><th class="num">风险评分</th><th>分档</th><th>主要贡献</th><th>证据</th></tr></thead><tbody>${[...result.subjects].sort((a, b) => (a.score ?? 101) - (b.score ?? 101)).map((item) => `<tr><td><strong>${esc(item.name)}</strong><small class="cell-note">${esc(item.id)}</small></td><td><strong>${esc(item.industry)}</strong><small class="cell-note">${esc(item.operatingStage)}</small></td><td class="num"><strong>${item.score === null ? "无法评价" : fmt(item.score, 2)}</strong></td><td>${badge(item.tier, toneFor(item.tier))}</td><td>${item.contributors.length ? item.contributors.slice(0, 2).map((entry) => `<span class="s003-contributor">${esc(entry.kind === "FACTOR" ? "因子" : "指标")} · ${esc(entry.name)}</span>`).join("") : "未提供贡献分解"}</td><td><button class="text-btn" type="button" data-action="s003-enterprise-detail" data-enterprise-id="${attr(item.id)}">查看详情</button><a class="text-btn" href="${attr(riskReportHref({ ...item, enterpriseId: item.id }))}">正式报告</a></td></tr>`).join("")}</tbody></table></div>`;
    }
    return `<div class="table-wrap"><table class="data-table s003-enterprise-table multi-model"><thead><tr><th>企业</th><th class="num">90天概率</th><th>风险事件 / 时间</th><th class="num">90天缺口</th><th>关系 / 异常</th><th>置信度</th><th>证据</th></tr></thead><tbody>${[...result.subjects].sort((a, b) => (Number(b.probability90d) || -1) - (Number(a.probability90d) || -1)).map((item) => `<tr><td data-label="企业"><strong>${esc(item.name)}</strong><small class="cell-note">${esc(item.industry)} · ${esc(item.tier)}</small></td><td class="num" data-label="90天概率"><strong>${item.probability90d == null ? "无法评价" : `${fmt(item.probability90d * 100, 1)}%`}</strong></td><td data-label="风险事件 / 时间"><strong>${esc(item.mostLikelyEventType || "无法评价")}</strong><small class="cell-note">${esc(item.expectedRiskWindow || "观察期不足")}</small></td><td class="num" data-label="90天缺口"><strong>${item.liquidityGap90d == null ? "无法评价" : `${fmt(item.liquidityGap90d, 1)} 百万元`}</strong></td><td data-label="关系 / 异常"><strong>关系 ${item.relationRiskScore == null ? "无法评价" : fmt(item.relationRiskScore, 1)}</strong><small class="cell-note">异常 ${item.anomalyScore == null ? "无法评价" : fmt(item.anomalyScore, 1)}</small></td><td data-label="置信度">${badge(item.confidence || "未提供", /HIGH/.test(item.confidence || "") ? "success" : /LOW|NOT/.test(item.confidence || "") ? "danger" : "warning")}</td><td data-label="证据"><button class="text-btn" type="button" data-action="s003-enterprise-detail" data-enterprise-id="${attr(item.id)}">查看</button></td></tr>`).join("")}</tbody></table></div>`;
  }

  function s003BenchmarkSummary(result) {
    const benchmark = objectRecord(result.benchmark);
    if (!benchmark) return `<div class="s003-empty"><strong>等待 Benchmark 结果</strong><p>Dashboard 不自行生成模型有效性结论；请在模型优化中心中使用成熟标签和锁定口径完成评测。</p></div>`;
    const entries = Object.entries(firstDefined(benchmark.metrics, benchmark.summary, benchmark)).filter(([, value]) => ["string", "number", "boolean"].includes(typeof value));
    return `<div class="s003-benchmark-grid">${entries.slice(0, 8).map(([key, value]) => `<div><span>${esc(key)}</span><strong>${typeof value === "number" ? fmt(value, 4) : esc(value)}</strong></div>`).join("")}</div>`;
  }

  function s003Difference(result) {
    const tiers = ["绿灯", "黄灯", "红灯", "黑灯"];
    const changed = result.subjects.filter((item) => item.baseline && (item.baseline.tier !== item.tier || item.baseline.score !== item.score));
    const contributorChanges = changed.flatMap((item) => item.contributors.filter((entry) => entry.delta !== undefined || entry.baselineContribution !== undefined).map((entry) => ({ enterprise: item.name, ...entry })));
    return `${panel("等级迁移矩阵", "行是当前正式分档，列是候选分档", `<div class="table-wrap"><table class="data-table migration-table"><thead><tr><th>正式 → 候选</th>${tiers.map((tier) => `<th class="num">${tier}</th>`).join("")}</tr></thead><tbody>${tiers.map((from) => `<tr><td><strong>${from}</strong></td>${tiers.map((to) => `<td class="num ${from === to ? "same" : "changed"}">${result.migration[from][to]}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`, "", "flush-body")}${panel("逐户升降与贡献变化", `${changed.length} 家企业评分或分档发生变化`, `<div class="table-wrap"><table class="data-table s003-diff-table"><thead><tr><th>企业</th><th>正式</th><th>候选</th><th class="num">评分变化</th><th>主要贡献变化</th></tr></thead><tbody>${changed.map((item) => { const contribution = item.contributors.find((entry) => entry.delta !== undefined || entry.baselineContribution !== undefined); return `<tr><td><strong>${esc(item.name)}</strong></td><td>${badge(item.baseline.tier, toneFor(item.baseline.tier))} ${fmt(item.baseline.score, 2)}</td><td>${badge(item.tier, toneFor(item.tier))} ${item.score === null ? "无法评价" : fmt(item.score, 2)}</td><td class="num">${item.score === null ? "—" : fmt(item.score - item.baseline.score, 2)}</td><td>${contribution ? `${esc(contribution.kind === "FACTOR" ? "因子" : "指标")} · ${esc(contribution.name)} ${contribution.delta === undefined ? "" : fmt(contribution.delta, 3)}` : "未提供可比较贡献"}</td></tr>`; }).join("") || `<tr><td colspan="5">候选与正式结果没有可验证差异，或 Envelope 未提供基线对照。</td></tr>`}</tbody></table></div>${contributorChanges.length ? `<small class="cell-note">已读取 ${contributorChanges.length} 条指标 / 因子贡献变化证据。</small>` : ""}`, "", "flush-body")}`;
  }

  function s003ModelingSelection() {
    const candidates = s003CandidateCatalog();
    const selection = state.riskModelingSelection;
    const pending = s003Modeling.requestState === "requesting";
    return `<section class="s003-trial-panel"><header><div><span class="eyebrow">固定输入候选试算</span><h2>选择候选模型结果</h2><p>固定数据版本和事实结果不变；计算、版本和运行身份均由模型优化中心维护。</p></div>${badge(candidates.length ? `${candidates.length} 个候选` : "模型状态未就绪", candidates.length ? "plain" : "warning")}</header><div class="s003-trial-fields"><label><span>Model Version</span><select data-change="s003-model-version" ${candidates.length ? "" : "disabled"}>${candidates.length ? candidates.map((item) => `<option value="${attr(item.modelVersionId)}" ${item.modelVersionId === selection.modelVersionId ? "selected" : ""}>${esc(item.label)} · ${esc(item.status)}</option>`).join("") : `<option>暂无可评测候选</option>`}</select></label><label><span>asOf</span><input type="date" value="${attr(selection.asOf)}" data-change="s003-as-of"></label><label><span>固定 DataVersion</span><input type="text" value="${attr(selection.dataVersionId)}" readonly aria-readonly="true"></label><label><span>企业范围</span><select data-change="s003-enterprise-scope"><option value="ALL">全部 21 家企业</option></select></label><label><span>试算用途</span><select data-change="s003-use-kind"><option value="BENCHMARK" ${selection.useKind === "BENCHMARK" ? "selected" : ""}>候选试算</option><option value="SHADOW" ${selection.useKind === "SHADOW" ? "selected" : ""}>Shadow Trial</option><option value="STRESS" ${selection.useKind === "STRESS" ? "selected" : ""}>压力模拟</option></select></label><button class="btn primary" type="button" data-action="s003-modeling-recalculate" ${candidates.length && !pending ? "" : "disabled"}>${icon(pending ? "loader-circle" : "play", "sm")}${pending ? "正在计算" : selection.useKind === "STRESS" ? "运行压力模拟" : "运行候选试算"}</button></div>${s003Modeling.contractError ? `<div class="model-validation danger">${icon("circle-alert", "sm")}<div><strong>候选结果未接入</strong><p>${esc(s003Modeling.contractError)}</p></div></div>` : ""}</section>`;
  }

  function riskModelingConsumer(dash) {
    const binding = S003_MODELING_SCHEMA.formalBinding;
    const workspace = s003Modeling.workspace || {};
    const formal = s003NormalizedEnvelope(s003FormalEnvelope(dash), dash);
    const candidate = s003Modeling.candidateResult ? s003NormalizedEnvelope(s003Modeling.candidateResult, dash) : null;
    const shadowResult = s003Modeling.shadowResult ? s003NormalizedEnvelope(s003Modeling.shadowResult, dash) : null;
    const simulation = s003Modeling.simulationResult ? s003NormalizedEnvelope(s003Modeling.simulationResult, dash) : null;
    const view = state.riskModelingView;
    const result = view === "formal" ? formal : view === "shadow" ? shadowResult : view === "simulation" ? simulation : candidate;
    const shadow = firstDefined(workspace.activeShadowTrial, workspace.shadowTrial, workspace.activeShadow, null);
    const benchmark = firstDefined(workspace.lastBenchmark, workspace.benchmarkReport, workspace.benchmarkRun, workspace.benchmark, null);
    const activeShadow = firstDefined(shadow?.name, shadow?.shadowTrialId, shadow?.shadowRunId, "暂无活动影子候选");
    const benchmarkStatus = firstDefined(benchmark?.status, S003_MODELING_SCHEMA.benchmark.status);
    const viewAvailability = { formal: formal, candidate, shadow: shadowResult, simulation, difference: candidate };
    const tabsHtml = S003_MODELING_SCHEMA.views.map((item) => `<button type="button" class="segmented-btn ${view === item.id ? "active" : ""}" data-action="s003-modeling-view" data-view="${attr(item.id)}" ${viewAvailability[item.id] ? "" : "disabled"}>${esc(item.label)}</button>`).join("");
    const resultBody = !result
      ? `<section class="s003-empty-state">${icon("chart-no-axes-combined", "lg")}<h2>等待对应 Result Envelope</h2><p>从模型优化中心完成候选试算、Shadow 或压力模拟后，这里才会显示对应结果。</p></section>`
      : view === "difference"
        ? s003Difference(result)
        : `${panel("四档风险分布", view === "formal" ? "当前归档正式 FACT" : "候选预测结果，不覆盖正式分档", s003Distribution(result))}<section class="grid-main">${panel("产业 / 经营阶段切片", "按 Result Envelope 企业输出实时汇总", s003SliceTable(result), "", "flush-body")}${panel("Benchmark 摘要", "评测结论由模型优化中心提供", s003BenchmarkSummary(result))}</section>${panel("企业评分与分档", `${result.subjects.length} 家企业 · ${s003ResultRole(result).label}`, s003EnterpriseTable(result), "", "flush-body")}`;
    return `<section class="s003-modeling-consumer"><header class="s003-modeling-hero"><div><span class="eyebrow">模型优化中心消费结果</span><h2>债务风险模型与运行</h2><p>查看当前正式结果，并对照候选、Shadow、压力模拟与差异。</p></div><button class="btn primary" type="button" data-action="s003-open-modeling-objective">${icon("external-link", "sm")}进入模型优化中心</button></header><section class="s003-modeling-status"><div><span>当前正式模型</span><strong>${esc(binding.modelVersion)}</strong><small>${esc(binding.modelVersionId)}</small></div><div><span>Binding</span><strong>${esc(workspace.binding?.bindingRevisionId || binding.bindingId)}</strong><small>${esc(workspace.binding?.status || `Revision ${binding.bindingRevision}`)}</small></div><div><span>DataVersion</span><strong>${esc(firstDefined(candidate?.dataVersionId, binding.dataVersionId))}</strong><small>asOf ${esc(binding.assessmentAsOf)}</small></div><div><span>最近 Benchmark</span><strong>${esc(benchmarkStatus)}</strong><small>${esc(firstDefined(benchmark?.benchmarkRunId, benchmark?.reportId, "未收到运行标识"))}</small></div><div><span>活动影子候选</span><strong>${esc(activeShadow)}</strong><small>${esc(firstDefined(shadow?.status, "只读跟踪"))}</small></div></section>${s003ModelingSelection()}<div class="s003-result-toolbar"><div class="segmented-control" aria-label="结果视图">${tabsHtml}</div>${result ? `<div class="s003-result-identity">${badge(s003ResultRole(result).label, s003ResultRole(result).tone)}<span>${esc(result.modelVersionId)}</span><span>${esc(result.dataVersionId)}</span></div>` : ""}</div><div class="s003-result-boundary">${icon("shield-check", "sm")}正式 FACT、候选 PREDICTION、影子 SHADOW 与 SIMULATION 严格分离；任何非正式结果均不写 C035、Published FACT、报告或处置状态。</div>${resultBody}${result ? `<details class="s003-evidence"><summary>查看 Result Envelope 与绑定证据</summary><dl><div><dt>resultId</dt><dd>${esc(result.resultId)}</dd></div><div><dt>Binding</dt><dd>${esc(result.bindingId)} · Revision ${esc(result.bindingRevision)}</dd></div><div><dt>Model Version</dt><dd>${esc(result.modelVersionId)}</dd></div><div><dt>DataVersion / asOf</dt><dd>${esc(result.dataVersionId)} · ${esc(result.asOf)}</dd></div><div><dt>formedAt</dt><dd>${esc(result.formedAt || "未提供")}</dd></div><div><dt>Evidence</dt><dd>${result.evidenceRefs.length ? result.evidenceRefs.map(esc).join(" · ") : "未提供独立证据引用"}</dd></div></dl></details>` : ""}</section>`;
  }

  function s003DetailBars(items, { labelKey, valueKey, formatter, percent = false }) {
    if (!items.length) return `<div class="s003-detail-empty">当前结果未提供该项数据。</div>`;
    const max = Math.max(...items.map((item) => Number(item[valueKey]) || 0), 1);
    return `<div class="s003-detail-bars">${items.map((item) => {
      const value = Number(item[valueKey]);
      const width = percent ? Math.max(0, Math.min(100, value * 100)) : Math.max(0, Math.min(100, value / max * 100));
      return `<div><span>${esc(item[labelKey])}</span><i><b style="width:${width}%"></b></i><strong>${esc(formatter(value))}</strong></div>`;
    }).join("")}</div>`;
  }

  function s003EnterpriseEvidenceHtml(item, result) {
    const eventItems = Object.entries(item.eventTypeProbabilities || {}).sort((left, right) => right[1] - left[1]).map(([label, value]) => ({ label, value }));
    const survivalItems = item.survivalCurve.map((entry) => ({ label: `${entry.day} 天`, value: entry.survival }));
    const maturityItems = item.maturityWall.map((entry) => ({ label: entry.bucket, value: entry.amountMillions }));
    const relationHtml = item.relationRiskPath.length
      ? `<ol class="s003-relation-path">${item.relationRiskPath.map((edge) => `<li><span>${esc(edge.from)}</span><b>${esc(edge.relation)}</b><span>${esc(edge.to)}</span><code>${esc(edge.evidenceRef || "未提供证据")}</code></li>`).join("")}</ol>`
      : `<div class="s003-detail-empty">${esc(item.relationMissingReason || "当前结果未形成可验证关系路径。")}</div>`;
    const anomalyHtml = item.anomalyEvents.length
      ? `<div class="s003-event-list">${item.anomalyEvents.map((event) => `<article><span>${badge(event.severity || "INFO", /HIGH/.test(event.severity || "") ? "danger" : "warning")}</span><div><strong>${esc(event.type)}</strong><p>${esc(event.label || "")}</p><code>${esc(event.evidenceRef || "未提供证据")}</code></div></article>`).join("")}</div>`
      : `<div class="s003-detail-empty">当前结果未检测到异常事件。</div>`;
    const contributorHtml = item.contributors.length
      ? `<div class="s003-contributor-list">${item.contributors.map((entry) => `<article><span>${esc(entry.kind === "FACTOR" ? "因子" : "指标")}</span><strong>${esc(entry.name)}</strong><small>${entry.score != null ? `评分 ${fmt(entry.score, 2)}` : entry.contribution != null ? `贡献 ${fmt(entry.contribution, 4)}` : "已纳入解释"}</small><code>${esc(entry.evidenceRef || "未提供证据")}</code></article>`).join("")}</div>`
      : `<div class="s003-detail-empty">当前 Result Envelope 未提供指标或因子贡献分解。</div>`;
    const evidenceRefs = [...new Set([...(item.evidenceRefs || []), ...(result.evidenceRefs || [])].filter(Boolean))];
    return `<section class="s003-detail-section"><h3>风险时间曲线</h3><p>数值表示该时点仍未发生目标风险事件的概率。</p>${s003DetailBars(survivalItems, { labelKey: "label", valueKey: "value", formatter: (value) => `${fmt(value * 100, 1)}%`, percent: true })}</section><section class="s003-detail-section"><h3>风险事件类型</h3><p>各事件类型独立展示，不合并为新的综合分。</p>${s003DetailBars(eventItems, { labelKey: "label", valueKey: "value", formatter: (value) => `${fmt(value * 100, 1)}%`, percent: true })}</section><section class="s003-detail-section"><h3>流动性缺口与债务到期墙</h3><div class="s003-detail-summary"><div><span>30 天缺口</span><strong>${item.liquidityGap30d == null ? "无法评价" : `${fmt(item.liquidityGap30d, 1)} 百万元`}</strong></div><div><span>90 天缺口</span><strong>${item.liquidityGap90d == null ? "无法评价" : `${fmt(item.liquidityGap90d, 1)} 百万元`}</strong></div><div><span>180 天缺口</span><strong>${item.liquidityGap180d == null ? "无法评价" : `${fmt(item.liquidityGap180d, 1)} 百万元`}</strong></div><div><span>再融资压力</span><strong>${item.refinancePressure == null ? "无法评价" : fmt(item.refinancePressure, 3)}</strong></div></div>${item.liquidityMissingReason ? `<div class="s003-missing-note">${esc(item.liquidityMissingReason)}</div>` : ""}${s003DetailBars(maturityItems, { labelKey: "label", valueKey: "value", formatter: (value) => `${fmt(value, 1)} 百万元` })}</section><section class="s003-detail-section"><h3>关系传染路径</h3><p>路径仅来自当前冻结关系数据，缺失关系不作事实推断。</p>${relationHtml}</section><section class="s003-detail-section"><h3>异常事件</h3>${anomalyHtml}</section><section class="s003-detail-section"><h3>指标与因子贡献</h3>${contributorHtml}</section><section class="s003-detail-section"><h3>模型、数据与证据</h3><dl class="s003-identity-list"><div><dt>结果身份</dt><dd>${esc(`${result.resultKind} · ${result.useKind}`)}</dd></div><div><dt>Model / Version</dt><dd>${esc(`${result.modelId} · ${result.modelVersionId}`)}</dd></div><div><dt>ModelRun</dt><dd>${esc(result.runId)}</dd></div><div><dt>DataVersion</dt><dd>${esc(result.dataVersionId)}</dd></div><div><dt>语义合同</dt><dd>${esc(result.semanticContractVersionId)}</dd></div><div><dt>Result ID</dt><dd>${esc(result.resultId)}</dd></div></dl>${evidenceRefs.length ? `<div class="s003-evidence-ref-list">${evidenceRefs.map((ref) => `<code>${esc(ref)}</code>`).join("")}</div>` : `<div class="s003-detail-empty">当前结果未提供证据引用。</div>`}</section>`;
  }

  function openS003EnterpriseDetail(enterpriseId) {
    const dash = byId("risk");
    const source = state.riskModelingView === "formal" ? s003FormalEnvelope(dash) : state.riskModelingView === "shadow" ? s003Modeling.shadowResult : state.riskModelingView === "simulation" ? s003Modeling.simulationResult : s003Modeling.candidateResult;
    if (!source) return toast("当前视图尚未形成企业级 Result Envelope");
    const result = s003NormalizedEnvelope(source, dash);
    const item = result.subjects.find((subject) => subject.id === enterpriseId);
    if (!item) return toast("未找到当前企业结果");
    const scoreLabel = result.resultKind === "FACT" ? "正式评分 / 分档" : "当前评分 / 分档";
    state.drawer = {
      eyebrow: `${s003ResultRole(result).label} · 企业详情`,
      title: item.name,
      subtitle: `${item.industry} · ${item.id}`,
      rows: [
        [scoreLabel, `${item.score == null ? "无法评价" : fmt(item.score, 2)} · ${item.tier}`],
        ["正式评分 / 分档", item.baseline ? `${fmt(item.baseline.score, 2)} · ${item.baseline.tier}` : result.resultKind === "FACT" ? `${fmt(item.score, 2)} · ${item.tier}` : "未提供"],
        ["30 / 90 / 180 天概率", `${item.probability30d == null ? "—" : `${fmt(item.probability30d * 100, 1)}%`} / ${item.probability90d == null ? "—" : `${fmt(item.probability90d * 100, 1)}%`} / ${item.probability180d == null ? "—" : `${fmt(item.probability180d * 100, 1)}%`}`],
        ["风险事件 / 时间窗口", `${item.mostLikelyEventType || "无法评价"} · ${item.expectedRiskWindow || "观察期不足"}`],
        ["30 / 90 / 180 天流动性缺口", `${item.liquidityGap30d == null ? "—" : fmt(item.liquidityGap30d, 1)} / ${item.liquidityGap90d == null ? "—" : fmt(item.liquidityGap90d, 1)} / ${item.liquidityGap180d == null ? "—" : fmt(item.liquidityGap180d, 1)} 百万元`],
        ["关系风险 / 异常分", `${item.relationRiskScore == null ? "无法评价" : fmt(item.relationRiskScore, 1)} / ${item.anomalyScore == null ? "无法评价" : fmt(item.anomalyScore, 1)}`],
        ["置信度", `${item.confidence || "未提供"}${item.confidenceScore == null ? "" : ` · ${fmt(item.confidenceScore * 100, 1)}%`}${item.confidenceMissingReasons?.length ? ` · ${item.confidenceMissingReasons.join("；")}` : ""}`],
        ["Model Version", result.modelVersionId],
        ["DataVersion", result.dataVersionId],
        ["Result ID", result.resultId]
      ],
      html: s003EnterpriseEvidenceHtml(item, result),
      note: "正式事实与当前非正式结果分别保留；详情不会创建报告、行动、审批、提醒、待办、通知或交易。"
    };
    render();
  }

  function renderRisk(tab) {
    focusS003Scenario();
    focusDashboardScenario("S003");
    const dash = byId("risk");
    const normalizedTab = tab === "enterprises" ? "actions" : tab;
    const valid = ["overview", "analysis", "actions", "operations"].includes(normalizedTab) ? normalizedTab : "overview";
    const tabItems = [
      { id: "overview", label: "风险总览", icon: "layout-dashboard" },
      { id: "analysis", label: "产业与薄弱项", icon: "chart-no-axes-combined" },
      { id: "actions", label: "风险处置行动", icon: "shield-check" },
      { id: "operations", label: "模型与运行", icon: "sliders-horizontal" }
    ];
    const actions = valid === "operations"
      ? `<button class="btn" type="button" data-action="s003-request-modeling-context">${icon("refresh-cw", "sm")}重新读取模型状态</button><button class="btn primary" type="button" data-action="s003-open-modeling-objective">${icon("external-link", "sm")}进入模型优化中心</button>`
      : `<a class="btn" href="${dashboardHref("risk", "operations")}">${icon("sliders-horizontal", "sm")}模型与重跑</a><a class="btn" href="${BASELINE_ROOT}/report-center/review-lifecycle/index.html?scenarioId=S003#/reports?tab=products">${icon("library", "sm")}报告目录</a>`;
    const content = valid === "overview"
      ? riskOverview(dash)
      : valid === "analysis"
        ? riskAnalysis(dash)
      : valid === "actions"
        ? riskActions(dash)
        : riskModelingConsumer(dash);
    shell(`<main class="page dashboard-page risk-page" data-screen-label="债务风险监测驾驶舱">${dashboardHeader(dash, { actions })}${infoStrip(dash)}${tabs(tabItems, valid, "risk")}<div class="dashboard-content">${content}</div></main>`);
  }

  function preloanApplicantRows(dash) {
    return dash.applicants.map((item) => `<tr><td data-label="借款主体"><button class="table-link" type="button" data-action="preloan-applicant-detail" data-applicant-id="${attr(item.id)}">${esc(item.name)}</button><small class="cell-note">${esc(item.id)}</small></td><td data-label="资料完整度" class="num">${fmt(item.completeness, 0)}%</td><td data-label="资产负债率" class="num">${item.debtRatio == null ? "无法评价" : `${fmt(item.debtRatio, 1)}%`}</td><td data-label="关系风险">${badge(item.relationRisk, toneFor(item.relationRisk))}</td><td data-label="复核优先级">${badge(item.reviewPriority, toneFor(item.reviewPriority))}</td><td data-label="评价状态">${badge(item.resultStatus, toneFor(item.resultStatus))}</td><td data-label="证据"><button class="text-btn" type="button" data-action="preloan-applicant-detail" data-applicant-id="${attr(item.id)}">查看证据</button></td></tr>`).join("");
  }

  function preloanOverview(dash) {
    const priorities = dash.applicants.filter((item) => item.reviewPriority === "优先复核");
    const priorityCards = priorities.map((item) => `<article class="preloan-priority-card"><header><div><span>${esc(item.id)}</span><h3>${esc(item.name)}</h3></div>${badge(item.resultStatus, toneFor(item.resultStatus))}</header><dl><div><dt>资料完整度</dt><dd>${fmt(item.completeness, 0)}%</dd></div><div><dt>资产负债率</dt><dd>${item.debtRatio == null ? "无法评价" : `${fmt(item.debtRatio, 1)}%`}</dd></div><div><dt>关系风险</dt><dd>${esc(item.relationRisk)}</dd></div><div><dt>候选置信度</dt><dd>${fmt(item.confidence * 100, 0)}%</dd></div></dl><p>${esc(item.missingReasons.join("；") || "关键证据已定位，仍需人工核对业务背景。")}</p><button class="text-btn" type="button" data-action="preloan-applicant-detail" data-applicant-id="${attr(item.id)}">查看主体与证据 ${icon("chevron-right", "sm")}</button></article>`).join("");
    const coverage = dash.applicants.map((item) => `<div class="preloan-coverage-row"><span>${esc(item.name)}</span><div><i style="width:${item.completeness}%"></i></div><strong>${fmt(item.completeness, 0)}%</strong><small>${esc(item.evidenceStatus)}</small></div>`).join("");
    return `${metricsGrid(dash.metrics, { dashboard: "preloan" })}<section class="grid-main preloan-overview-grid">${panel("优先人工复核", "排序只服务人工复核，不自动形成授信结论", `<div class="preloan-priority-list">${priorityCards}</div>`, "", "flush-body")}${panel("资料与证据覆盖", "缺失信息保持无法评价，不以默认值补齐", `<div class="preloan-coverage-list">${coverage}</div>`)}</section>${panel("借款主体概览", "正式结果、候选对照和证据状态分开展示", `<div class="table-wrap"><table class="data-table preloan-table"><thead><tr><th>借款主体</th><th class="num">资料完整度</th><th class="num">资产负债率</th><th>关系风险</th><th>复核优先级</th><th>评价状态</th><th></th></tr></thead><tbody>${preloanApplicantRows(dash)}</tbody></table></div>`, "", "flush-body")}`;
  }

  function preloanApplicants(dash) {
    return `<section class="preloan-scope-note">${icon("shield-check", "sm")}<div><strong>当前范围为 4 家脱敏借款主体</strong><p>正式调查轮次只读；候选模型结果用于影子比较，不能替代人工调查和授信审批。</p></div></section>${panel("全部借款主体", "按人工复核优先级和资料完整度查看", `<div class="table-wrap"><table class="data-table preloan-table"><thead><tr><th>借款主体</th><th class="num">资料完整度</th><th class="num">资产负债率</th><th>关系风险</th><th>复核优先级</th><th>评价状态</th><th></th></tr></thead><tbody>${preloanApplicantRows(dash)}</tbody></table></div>`, "", "flush-body")}`;
  }

  function preloanModelComparison(dash) {
    const rows = dash.applicants.map((item) => {
      const delta = item.candidateScore == null ? null : item.candidateScore - item.formalScore;
      return `<tr><td data-label="借款主体"><strong>${esc(item.name)}</strong><small class="cell-note">${esc(item.id)}</small></td><td data-label="正式结果" class="num">${fmt(item.formalScore, 1)}</td><td data-label="候选试算" class="num">${item.candidateScore == null ? "无法评价" : fmt(item.candidateScore, 1)}</td><td data-label="差异" class="num">${delta == null ? "—" : `${delta >= 0 ? "+" : ""}${fmt(delta, 1)}`}</td><td data-label="置信度">${fmt(item.confidence * 100, 0)}%</td><td data-label="说明">${esc(item.missingReasons.join("；") || "同一数据版本下的只读对照")}</td></tr>`;
    }).join("");
    return `<section class="preloan-result-identities"><article><span>正式结果</span><strong>FACT · 已归档只读</strong><small>S004-RUN-20260815233000000-7f3c8e42a1b6</small></article><article><span>候选试算</span><strong>PREDICTION · 脱敏评测</strong><small>不改变正式结果或授信结论</small></article><article><span>使用边界</span><strong>仅供人工复核排序</strong><small>外部副作用 0</small></article></section>${panel("正式与候选差异", "同一借款主体逐项比较，不合并为新综合分", `<div class="table-wrap"><table class="data-table preloan-table"><thead><tr><th>借款主体</th><th class="num">正式结果</th><th class="num">候选试算</th><th class="num">差异</th><th>置信度</th><th>说明</th></tr></thead><tbody>${rows}</tbody></table></div>`, `<button class="btn primary" type="button" data-ofw-native-action="dashboard-open">${icon("activity", "sm")}读取当前模型运行</button>`, "flush-body")}`;
  }

  function preloanEvidence(dash) {
    return `<section class="preloan-evidence-grid">${dash.evidence.map((item) => `<article><header><span>${icon(item.id === "S004-EV-DATA" ? "database" : item.id === "S004-EV-SEM" ? "network" : item.id === "S004-EV-RUN" ? "play" : "flask-conical", "sm")}</span>${badge(item.status, toneFor(item.status))}</header><h2>${esc(item.label)}</h2><code>${esc(item.ref)}</code><p>数据截至 ${esc(item.asOf)}，可从借款主体明细继续下钻到对象与事件证据。</p><button class="text-btn" type="button" data-action="preloan-evidence-detail" data-evidence-id="${attr(item.id)}">查看证据身份 ${icon("chevron-right", "sm")}</button></article>`).join("")}</section>`;
  }

  function renderPreloan(tab) {
    focusDashboardScenario("S004");
    const dash = byId("preloan");
    const valid = ["overview", "applicants", "models", "evidence"].includes(tab) ? tab : "overview";
    const tabItems = [
      { id: "overview", label: "贷前总览", icon: "layout-dashboard" },
      { id: "applicants", label: "借款主体", icon: "building-2" },
      { id: "models", label: "结果对比", icon: "git-compare-arrows" },
      { id: "evidence", label: "数据与证据", icon: "folder-search-2" }
    ];
    const content = valid === "overview" ? preloanOverview(dash) : valid === "applicants" ? preloanApplicants(dash) : valid === "models" ? preloanModelComparison(dash) : preloanEvidence(dash);
    const actions = `<button class="btn" type="button" data-action="preloan-open-m07">${icon("scan-search", "sm")}多视图探索</button><button class="btn primary" type="button" data-ofw-native-action="dashboard-open">${icon("activity", "sm")}当前模型结果</button>`;
    shell(`<main class="page dashboard-page preloan-page" data-screen-label="贷款贷前风险评估驾驶舱">${dashboardHeader(dash, { actions })}${infoStrip(dash)}${tabs(tabItems, valid, "preloan")}<div class="dashboard-content">${content}</div></main>`);
  }

  function openPreloanApplicant(applicantId) {
    const dash = byId("preloan");
    const item = dash.applicants.find((entry) => entry.id === applicantId);
    if (!item) return;
    state.drawer = {
      eyebrow: "贷前调查对象",
      title: item.name,
      subtitle: `${item.id} · ${item.resultStatus}`,
      rows: [["资料完整度", `${fmt(item.completeness, 0)}%`], ["资产负债率", item.debtRatio == null ? "无法评价" : `${fmt(item.debtRatio, 1)}%`], ["关系风险", item.relationRisk], ["人工复核优先级", item.reviewPriority], ["正式结果", `${fmt(item.formalScore, 1)} 分`], ["候选试算", item.candidateScore == null ? "无法评价" : `${fmt(item.candidateScore, 1)} 分`], ["置信度", `${fmt(item.confidence * 100, 0)}%`], ["缺失原因", item.missingReasons.join("；") || "无"]],
      html: `<section class="s005-evidence-list"><h3>证据引用</h3>${item.evidenceRefs.map((ref) => `<article><strong>${esc(item.name)}</strong><code>${esc(ref)}</code><small>数据截至 ${esc(dash.period)}</small></article>`).join("")}</section>`,
      note: "主体详情只用于贷前调查与人工复核；候选、影子或模拟结果不得直接创建授信审批、提醒、待办、通知或交易。"
    };
    render();
  }

  function openPreloanEvidence(evidenceId) {
    const dash = byId("preloan");
    const item = dash.evidence.find((entry) => entry.id === evidenceId);
    if (!item) return;
    state.drawer = { eyebrow: "数据与证据", title: item.label, subtitle: item.status, rows: [["稳定引用", item.ref], ["数据截至", item.asOf], ["数据版本", dash.dataLabel], ["语义版本", dash.semanticLabel]], note: "该引用与当前 S004 已归档运行身份绑定；候选模型使用的脱敏 synthetic 数据单独标识，不伪装成真实业务事实。" };
    render();
  }

  function s005IdentityStrip() {
    const context = s005Evaluation.scenarioContext;
    return `<section class="s005-identity-strip" aria-label="当前五字段场景身份">${S005_CONTEXT_FIELDS.map((field) => `<div><span>${esc(field)}</span><strong>${esc(context?.[field] || "等待当前轮次")}</strong></div>`).join("")}</section>`;
  }

  function s005StatusStrip() {
    const run = s005Evaluation.evaluationRun || {};
    const result = s005Evaluation.evaluationResult || {};
    const statusBar = result.statusBar || {};
    const sourceAudit = result.sourceAudit || run.sourceAudit || {};
    const versions = result.versions || run.versions || result.metadata?.versions || run.metadata?.versions || {};
    const overall = s005OverallStatus();
    const items = [
      ["评价日", firstDefined(statusBar.evaluationDate, result.evaluationDate, run.evaluationDate, "等待当前轮次")],
      ["数据截至", firstDefined(statusBar.dataAsOf, result.dataAsOf, result.dataAsOfDate, sourceAudit.asOf, "等待当前轮次")],
      ["Wind 批次", firstDefined(statusBar.windBatchId, result.windBatchId, sourceAudit.windBatchId, statusBar.windBatchMissingReason, sourceAudit.windBatchMissingReason, "等待当前轮次")],
      ["事件读取时间", firstDefined(statusBar.eventReadAt, result.eventReadAt, run.eventReadAt, sourceAudit.eventReadAt, "等待当前轮次")],
      ["公式 / 参数版本", `${firstDefined(statusBar.formulaVersion, result.formulaVersion, run.formulaVersion, versions.formulaVersion, "待定")} / ${firstDefined(statusBar.parameterVersion, result.parameterVersion, run.parameterVersion, versions.parameterVersion, "待定")}`],
      ["scored_coverage", `${s005Coverage(firstDefined(statusBar.scoredCoverage, result.scored_coverage, result.scoredCoverage, run.scored_coverage, run.scoredCoverage), 0).toFixed(1)}%`],
      ["置信度", s005Confidence(firstDefined(statusBar.confidence, result.confidence, result.confidenceScore, run.confidence, run.confidenceScore))],
      ["评价状态", overall.label],
    ];
    return `<section class="s005-evaluation-strip" aria-label="当前评价轮次状态">${items.map(([label, value]) => `<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join("")}</section>`;
  }

  function s005MetricRows(domain) {
    return `<div class="s005-metric-list" role="table" aria-label="${attr(domain.label)}指标"><div class="s005-metric-head" role="row"><span role="columnheader">指标</span><span role="columnheader">状态</span><span role="columnheader">当前结果</span><span role="columnheader">证据</span></div>${domain.metrics.map((metric) => `<div class="s005-metric-row" role="row"><strong role="cell">${esc(metric.label)}</strong><span role="cell">${badge(metric.status.valueLabel, metric.status.tone)}</span><span class="s005-metric-value" role="cell">${esc(metric.display)}</span><button class="icon-btn" type="button" data-action="s005-evidence-detail" data-domain-id="${attr(domain.id)}" data-metric-key="${attr(metric.key)}" aria-label="查看${attr(metric.label)}证据" title="查看证据">${icon("file-search-2", "sm")}</button></div>`).join("")}</div>`;
  }

  function s005DomainCard(domain, expanded = false) {
    const reasons = domain.missingReasons.length ? domain.missingReasons : ["当前域没有额外缺失原因。"];
    const evidenceCount = domain.evidence.length + domain.metrics.reduce((count, metric) => count + metric.evidence.length, 0);
    return `<article class="s005-domain-card ${expanded ? "expanded" : ""}" data-domain="${attr(domain.id)}"><header class="s005-domain-head"><span class="s005-domain-icon">${icon(domain.icon, "sm")}</span><div><h2>${esc(domain.label)}</h2><p>${badge(domain.status.label, domain.status.tone)}<span>覆盖率 ${domain.coverage.toFixed(1)}%</span></p></div><a class="icon-btn" href="${dashboardHref("post-investment", domain.id)}" aria-label="打开${attr(domain.label)}">${icon("arrow-up-right", "sm")}</a></header><div class="s005-coverage" aria-label="覆盖率 ${domain.coverage.toFixed(1)}%"><i style="--coverage:${domain.coverage}%"></i></div>${s005MetricRows(domain)}<section class="s005-domain-conclusion"><span>结论</span><p>${esc(domain.conclusion)}</p></section><section class="s005-domain-missing"><span>缺失原因</span><ul>${reasons.map((reason) => `<li>${esc(reason)}</li>`).join("")}</ul></section><footer><button class="text-btn" type="button" data-action="s005-evidence-detail" data-domain-id="${attr(domain.id)}">${icon("folder-search-2", "sm")}证据下钻 <strong>${evidenceCount}</strong>${icon("chevron-right", "sm")}</button></footer></article>`;
  }

  function s005PendingNotice() {
    const overall = s005OverallStatus();
    const message = s005Evaluation.contractError
      ? s005Evaluation.contractError
      : s005Evaluation.evaluationResult
        ? "仅汇总当前 scenarioRunId 对应的 evaluation run/result；缺失指标不补零。"
        : s005Evaluation.evaluationRun
          ? "当前 evaluation run 尚未返回可验证 result，所有未提供指标保持等待或无法评价。"
          : "尚未收到当前 S005 evaluation run/result，当前覆盖率为 0%。";
    return `<section class="s005-status-notice ${overall.tone}">${icon(overall.tone === "danger" ? "circle-alert" : "circle-dashed", "sm")}<div><strong>${esc(overall.label)}</strong><p>${esc(message)}</p></div>${badge(overall.label, overall.tone)}</section>`;
  }

  function renderPostInvestment(tab) {
    focusDashboardScenario("S005");
    const dash = byId("post-investment");
    const domains = normalizedS005Domains();
    const valid = ["overview", ...S005_DOMAIN_DEFINITIONS.map((domain) => domain.id)].includes(tab) ? tab : "overview";
    const tabItems = [
      { id: "overview", label: "六域总览", icon: "layout-dashboard" },
      ...S005_DOMAIN_DEFINITIONS.map((domain) => ({ id: domain.id, label: domain.label, icon: domain.icon })),
    ];
    const selectedDomain = domains.find((domain) => domain.id === valid);
    const content = selectedDomain
      ? `<section class="s005-domain-detail">${s005DomainCard(selectedDomain, true)}</section>`
      : `<section class="s005-domain-grid">${domains.map((domain) => s005DomainCard(domain)).join("")}</section>`;
    const actions = `<button class="btn" type="button" data-action="s005-request-evaluation">${icon("refresh-cw", "sm")}读取当前轮次</button>`;
    shell(`<main class="page dashboard-page post-investment-page" data-screen-label="金融产品投后评价六域驾驶舱">${dashboardHeader(dash, { actions })}${s005IdentityStrip()}${s005StatusStrip()}${s005PendingNotice()}${tabs(tabItems, valid, "post-investment")}<div class="dashboard-content">${content}<div class="s005-boundary-note">${icon("shield-alert", "sm")}<p>真实结果、预测结果和模拟结果严格隔离；当前页面不形成 Published 本体、Metric、Rule、T019、行动、审批、待办或交易。</p></div></div></main>`);
  }

  function openS005Evidence(domainId, metricKey = "") {
    const domain = normalizedS005Domains().find((item) => item.id === domainId);
    if (!domain) return;
    const metric = metricKey ? domain.metrics.find((item) => item.key === metricKey) : null;
    const evidence = metric
      ? metric.evidence
      : [...domain.evidence, ...domain.metrics.flatMap((item) => item.evidence.map((evidenceItem) => ({ ...evidenceItem, metricLabel: item.label })))];
    const missingReasons = metric ? metric.missingReasons : domain.missingReasons;
    const evidenceHtml = evidence.length
      ? `<section class="s005-evidence-list"><h3>证据引用</h3>${evidence.map((item) => `<article><strong>${esc(item.metricLabel || item.label)}</strong><code>${esc(item.ref)}</code>${item.asOf ? `<small>数据截至 ${esc(item.asOf)}</small>` : ""}${item.status ? badge(item.status, toneFor(item.status)) : ""}</article>`).join("")}</section>`
      : `<div class="drawer-note">${icon("circle-dashed", "sm")}<div><strong>没有可下钻证据</strong><p>当前 run 未回传该${metric ? "指标" : "评价域"}的证据引用，不以固定 fixture 或补零替代。</p></div></div>`;
    const missingHtml = missingReasons.length
      ? `<section class="s005-evidence-missing"><h3>缺失原因</h3><ul>${missingReasons.map((reason) => `<li>${esc(reason)}</li>`).join("")}</ul></section>`
      : "";
    state.drawer = {
      eyebrow: "S005 当前轮次证据",
      title: metric ? metric.label : domain.label,
      subtitle: `${domain.status.label} · 覆盖率 ${domain.coverage.toFixed(1)}%`,
      rows: [
        ["scenarioRunId", s005Evaluation.scenarioContext?.scenarioRunId || "等待当前轮次"],
        ["评价域", domain.label],
        ["当前结果", metric?.display || domain.conclusion],
        ["指标状态", metric?.status.valueLabel || domain.status.label],
        ["公式引用", metric?.formula || "未提供"],
        ["观察期", metric?.observation || "未提供"],
      ],
      html: `${evidenceHtml}${missingHtml}`,
      note: "证据只来自当前 scenarioRunId 对应的 evaluation result；预测或模拟输出不得替代真实评价事实。",
    };
    render();
  }

  function riskActionByEnterpriseId(enterpriseId) {
    return byId("risk").actions.find((item) => item.enterpriseId === enterpriseId) || null;
  }

  function openRiskActionEvidence(item) {
    if (!item) return;
    const current = riskActionRecord(item);
    if (!current.evidenceViewed) setRiskActionRecord(item, { evidenceViewed: true });
    const record = riskActionRecord(item);
    const stage = riskActionStageMeta(record);
    state.drawer = {
      eyebrow: "风险固定依据",
      title: item.enterprise,
      subtitle: `${item.category} · ${item.tier} · ${fmt(item.score, 2)} 分`,
      rows: [
        ["评估时点", "2025-12-31"],
        ["风险等级", item.tier],
        ["综合评分", `${fmt(item.score, 2)} 分`],
        ["重点关注", item.focus],
        ["识别依据", item.basis],
        ["已发布行动类型", `${item.actionTypeName} · ${item.actionTypeVersion}`],
        ["接收接口人", item.recipient],
        ["建议负责人", item.recommendedOwner],
        ["固定结果", `S003-C035-${RISK_CONTEXT.scenarioRunId}-${item.enterpriseId}`],
        ["正式数据", "S003-T007-DEBT-RISK-20251231-v1"],
        ["当前处理", stage.label],
      ],
      html: `<section class="evidence-explanation"><h3>为什么识别为风险</h3><p>${esc(item.basis)}</p><h3>建议如何处理</h3><p>${esc(item.recommendation)}</p><div class="decision-boundary-note">${icon("shield-check", "sm")}本页确认的是风险事实和提交意愿，不是决策中心的人工决定。提交后仍需成员单位接口人核实，才可能形成负责人待办。</div></section>`,
      footerHtml: record.stage === "pending"
        ? `<button class="btn primary" type="button" data-action="risk-action-confirm" data-enterprise-id="${attr(item.enterpriseId)}">${icon("badge-check", "sm")}确认风险事实</button>`
        : record.stage === "confirmed" || record.stage === "failed"
          ? `<button class="btn primary" type="button" data-action="risk-action-submit" data-enterprise-id="${attr(item.enterpriseId)}">${icon(record.stage === "failed" ? "rotate-ccw" : "send", "sm")}${record.stage === "failed" ? "重新提交" : "提交行动申请"}</button>`
          : ["submitted", "handled"].includes(record.stage)
            ? `<a class="btn primary" href="${BASELINE_ROOT}/decision-center-prototype/index.html#/operations/intake">${icon("external-link", "sm")}前往决策中心</a>`
            : `<button class="btn primary" type="button" disabled>${icon("loader-circle", "sm")}提交中</button>`,
    };
    render();
  }

  function openRiskSectorDetail(sectorName) {
    const companies = byId("risk").companies.filter((item) => riskIndustry(item) === sectorName);
    const alerts = companies.filter((item) => item.riskTier !== "绿灯");
    state.drawer = {
      eyebrow: "产业构成",
      title: sectorName,
      subtitle: `${companies.length} 家企业 · ${alerts.length} 家触发预警`,
      rows: [
        ["产业企业数", `${companies.length} 家`],
        ["运营阶段", `${companies.filter((item) => riskOperatingStage(item) === "运营阶段").length} 家`],
        ["建设阶段", `${companies.filter((item) => riskOperatingStage(item) === "建设阶段").length} 家`],
        ["平均评分", `${fmt(companies.reduce((sum, item) => sum + item.finalScore, 0) / Math.max(companies.length, 1), 2)} 分`],
        ["风险分布", `绿 ${companies.filter((item) => item.riskTier === "绿灯").length} / 黄 ${companies.filter((item) => item.riskTier === "黄灯").length} / 红 ${companies.filter((item) => item.riskTier === "红灯").length} / 黑 ${companies.filter((item) => item.riskTier === "黑灯").length}`],
      ],
      html: alerts.length ? `<section class="evidence-explanation"><h3>需要处置的企业</h3>${alerts.map((item) => `<p><strong>${esc(item.enterpriseName)}</strong> · ${esc(item.riskTier)} · ${esc(item.focus)} · ${fmt(item.finalScore, 2)} 分</p>`).join("")}</section>` : `<div class="drawer-note">${icon("circle-check", "sm")}<div><strong>当前无亮灯预警</strong><p>该产业企业仍按正式评估轮次持续监测。</p></div></div>`,
    };
    render();
  }

  function openRiskTierDetail(tierName) {
    const companies = byId("risk").companies.filter((item) => item.riskTier === tierName);
    state.drawer = {
      eyebrow: "风险分档",
      title: `${tierName}企业`,
      subtitle: `${companies.length} 家 · 当前正式评估轮次`,
      rows: companies.map((item) => [item.enterpriseName, `${fmt(item.finalScore, 2)} 分 · ${riskIndustry(item)} · ${item.focus}`]),
      note: tierName === "绿灯" ? "绿灯企业不进入风险处置行动页，继续按正式评估周期监测。" : "亮灯企业是否需要发起处置，仍须在风险处置行动页逐条核对固定依据。",
      link: tierName === "绿灯" ? null : { href: dashboardHref("risk", "actions"), label: "进入风险处置" },
    };
    render();
  }

  function renderDrawer() {
    const item = state.drawer;
    const rows = item.rows || [];
    return `<div class="drawer-backdrop" data-action="close-drawer"><aside class="drawer" role="dialog" aria-modal="true" aria-label="${attr(item.title)}"><header class="drawer-head"><div><span class="eyebrow">${esc(item.eyebrow || "查看详情")}</span><h2>${esc(item.title)}</h2><p>${esc(item.subtitle || "")}</p></div><button class="icon-btn" type="button" data-action="close-drawer" aria-label="关闭">${icon("x", "sm")}</button></header><div class="drawer-body">${rows.length ? `<dl class="detail-list">${rows.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>` : ""}${item.html || ""}${item.note ? `<div class="drawer-note">${icon("info", "sm")}<div><strong>业务说明</strong><p>${esc(item.note)}</p></div></div>` : ""}</div><footer class="drawer-foot"><button class="btn" type="button" data-action="close-drawer">关闭</button>${item.link ? `<a class="btn primary" href="${attr(item.link.href)}">${esc(item.link.label)}${icon("arrow-right", "sm")}</a>` : ""}${item.footerHtml || ""}</footer></aside></div>`;
  }

  function openMetric(dashboardId, key) {
    const dash = byId(dashboardId);
    const metric = (dashboardId === "financing" ? financeScopedMetrics(dash) : dashboardId === "budget" ? budgetScopedMetrics(dash) : dash.metrics).find((item) => item.key === key);
    if (!metric) return;
    const currentRange = dashboardId === "financing"
      ? state.financeScopeId
      : dashboardId === "budget"
        ? state.budgetScope
        : dashboardId === "preloan"
          ? "全部借款主体"
          : "全部企业";
    state.drawer = { eyebrow: "指标口径", title: metric.label, subtitle: `${metric.display} ${metric.unit}`, rows: [["当前范围", currentRange], ["数据截至", dash.period], ["业务定义", dash.semanticLabel], ["更新时间", dash.updatedAt]], note: metric.note };
    render();
  }

  function render() {
    const current = route();
    if (current.type === "directory") return renderDirectory();
    if (current.id === "financing") return renderFinancing(current.tab);
    if (current.id === "budget") return renderBudget(current.tab);
    if (current.id === "risk") return renderRisk(current.tab);
    if (current.id === "preloan") return renderPreloan(current.tab);
    if (current.id === "post-investment") return renderPostInvestment(current.tab);
    location.hash = "#/dashboards";
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "refresh") {
      if (route().id === "post-investment") {
        target.classList.add("is-reading");
        requestS005Evaluation();
        window.setTimeout(() => { target.classList.remove("is-reading"); toast("已请求读取当前 S005 评价轮次"); }, 320);
        return;
      }
      target.classList.add("is-reading");
      window.setTimeout(() => { target.classList.remove("is-reading"); toast("指标、专题和业务状态已重新读取"); }, 520);
      return;
    }
    if (action === "save-view") { persist(); toast("当前分析范围和视图已保存"); return; }
    if (action === "finance-scope") {
      state.financeScopeType = target.dataset.type;
      const dash = byId("financing");
      state.financeScopeId = state.financeScopeType === "group" ? "集团" : state.financeScopeType === "board" ? dash.boards[0].name : dash.units[0].name;
      persist(); render(); return;
    }
    if (action === "toggle-finance-unit") {
      const unit = target.dataset.unit;
      if (state.financeCompare.includes(unit)) {
        if (state.financeCompare.length === 1) return toast("至少保留 1 家单位");
        state.financeCompare = state.financeCompare.filter((item) => item !== unit);
      } else if (state.financeCompare.length < 3) state.financeCompare.push(unit);
      else return toast("最多同时比较 3 家单位");
      persist(); render(); return;
    }
    if (action === "metric-detail") { openMetric(target.dataset.dashboard, target.dataset.key); return; }
    if (action === "preloan-applicant-detail") { openPreloanApplicant(target.dataset.applicantId); return; }
    if (action === "preloan-evidence-detail") { openPreloanEvidence(target.dataset.evidenceId); return; }
    if (action === "preloan-open-m07") {
      if (window.parent !== window) window.parent.location.hash = "#module/m07";
      return;
    }
    if (action === "s005-request-evaluation") { requestS005Evaluation(); toast("已请求读取当前 S005 评价轮次"); return; }
    if (action === "s005-evidence-detail") { openS005Evidence(target.dataset.domainId, target.dataset.metricKey || ""); return; }
    if (action === "structure-detail") {
      const dash = byId("financing");
      const item = dash.structures.find((structure) => structure.id === target.dataset.id);
      state.drawer = { eyebrow: "结构分析", title: item.name, subtitle: "当前融资余额占比", rows: item.items.map((part) => [part[0], `${fmt(part[1], 2)}%`]), note: "结构项使用当前驾驶舱相同的数据范围和数据截至时间。" };
      render(); return;
    }
    if (action === "finance-unit-detail") {
      const item = byId("financing").units[Number(target.dataset.index)];
      state.drawer = { eyebrow: "单位分析", title: item.name, subtitle: item.board, rows: [["融资余额", `${fmt(item.balance, 3)} 亿元`], ["余额加权融资成本", `${fmt(item.cost, 6)}%`], ["浮动利率余额占比", `${fmt(item.floating, 2)}%`], ["短期债务余额占比", `${fmt(item.shortTerm, 2)}%`], ["高成本融资余额占比", `${fmt(item.highCost, 2)}%`], ["主要发现", item.finding]], note: "查看详情不会改变当前单位结果或行动状态。" };
      render(); return;
    }
    if (action === "institution-detail") {
      const item = byId("financing").institutions[Number(target.dataset.index)];
      state.drawer = { eyebrow: "融资机构", title: item.name, rows: [["集团融资余额", `${fmt(item.balance, 3)} 亿元`], ["余额占比", `${fmt(item.share, 3)}%`], ["加权融资成本", `${fmt(item.cost, 6)}%`], ["存续借据", `${item.count} 笔`], ["数据截至", byId("financing").period]], note: "机构分析用于协商准备，具体行动仍通过决策中心受控推进。" };
      render(); return;
    }
    if (action === "rule-detail") {
      const item = byId("financing").rules[Number(target.dataset.index)];
      state.drawer = { eyebrow: "规则结果", title: `${item.unit} · ${item.title}`, rows: [["结果", item.result], ["当前值", item.observed], ["命中阈值", item.threshold], ["触发分支", item.branch], ["优先机构", item.institution], ["评估时间", item.evaluatedAt]], note: "规则结果只作为行动申请的业务证据，不能绕过人工确认直接创建待办。" };
      render(); return;
    }
    if (action === "finance-action-detail") {
      const item = byId("financing").actions[Number(target.dataset.index)];
      state.drawer = { eyebrow: "行动进展", title: item.title, rows: [["负责人", item.owner], ["当前状态", item.status], ["业务依据", item.basis], ["最近更新", item.updatedAt]], note: "仪表盘只读展示决策运行摘要，确认、分配和待办更新在决策中心完成。", link: { href: `${BASELINE_ROOT}/decision-center-prototype/index.html#/workbench`, label: "查看决策进展" } };
      render(); return;
    }
    if (action === "budget-expand") { state.budgetExpanded = state.budgetExpanded === target.dataset.key ? "" : target.dataset.key; persist(); render(); return; }
    if (action === "budget-record-detail") {
      const item = filteredBudgetRows(byId("budget"), "cost")[Number(target.dataset.index)];
      state.drawer = { eyebrow: "预算执行", title: item.name, rows: [["最终批准费用预算", `${fmt(item.budget)} 万元`], ["实际费用", `${fmt(item.actual)} 万元`], ["预算执行率", `${fmt(item.execution)}%`], ["成本占收比", `${fmt(item.costToRevenue)}%`], ["预算差异", `${fmt(item.delta)} 万元`], ["当前判定", item.status]], note: "预算专题只用于监督分析和业务复核，不自动形成决策中心行动或待办。" };
      render(); return;
    }
    if (action === "risk-tier-jump") { openRiskTierDetail(target.dataset.tier); return; }
    if (action === "risk-sector-detail") { openRiskSectorDetail(target.dataset.sector); return; }
    if (action === "risk-search") { state.riskSearch = document.getElementById("risk-search")?.value || ""; persist(); render(); return; }
    if (action === "risk-filter-reset") { state.riskTier = "全部"; state.riskSector = "全部产业"; state.riskSort = "risk"; state.riskSearch = ""; persist(); render(); return; }
    if (action === "s003-request-modeling-context") { requestS003ModelingContext(); toast("已请求重新读取模型状态 工作区"); return; }
    if (action === "s003-open-modeling-objective") { openS003Objective(); return; }
    if (action === "s003-modeling-view") { state.riskModelingView = target.dataset.view || "formal"; persist(); render(); return; }
    if (action === "s003-modeling-recalculate") { requestS003CandidateResult(); return; }
    if (action === "s003-enterprise-detail") { openS003EnterpriseDetail(target.dataset.enterpriseId); return; }
    if (action === "risk-open-decision") { if (window.parent !== window) window.parent.location.hash = "#module/decision"; else location.href = `${BASELINE_ROOT}/decision-center-prototype/index.html#workbench`; return; }
    if (action === "risk-action-evidence") { openRiskActionEvidence(riskActionByEnterpriseId(target.dataset.enterpriseId)); return; }
    if (action === "risk-action-confirm") {
      const item = riskActionByEnterpriseId(target.dataset.enterpriseId);
      if (!item) return;
      const current = riskActionRecord(item);
      if (!current.evidenceViewed) return toast("请先查看并核对固定依据");
      if (current.stage !== "pending") return;
      setRiskActionRecord(item, { stage: "confirmed", confirmedAt: localDateTime(), error: "" });
      state.drawer = null; render(); toast(`${item.enterprise}的风险事实已确认，尚未提交行动申请`); return;
    }
    if (action === "risk-action-unconfirm") {
      const item = riskActionByEnterpriseId(target.dataset.enterpriseId);
      if (!item) return;
      const current = riskActionRecord(item);
      if (current.stage !== "confirmed") return;
      setRiskActionRecord(item, { stage: "pending", evidenceViewed: false, confirmedAt: "", error: "" });
      render(); toast(`${item.enterprise}已撤销提交前确认，可重新核对固定依据`); return;
    }
    if (action === "risk-action-submit") {
      const item = riskActionByEnterpriseId(target.dataset.enterpriseId);
      if (!item) return;
      state.drawer = null;
      void submitRiskAction(item);
      return;
    }
    if (action === "close-drawer") {
      if (target.classList.contains("drawer-backdrop") && event.target !== target) return;
      state.drawer = null;
      render();
    }
  });

  document.addEventListener("change", (event) => {
    const change = event.target.dataset.change;
    if (!change) return;
    if (change === "s003-model-version") state.riskModelingSelection.modelVersionId = event.target.value;
    if (change === "s003-as-of") state.riskModelingSelection.asOf = event.target.value;
    if (change === "s003-enterprise-scope") state.riskModelingSelection.enterpriseScope = event.target.value;
    if (change === "s003-use-kind") state.riskModelingSelection.useKind = event.target.value;
    if (change === "finance-scope-id") state.financeScopeId = event.target.value;
    if (change === "budget-scope") { state.budgetScope = event.target.value; state.budgetExpanded = ""; }
    if (change === "risk-tier") state.riskTier = event.target.value;
    if (change === "risk-sector") state.riskSector = event.target.value;
    if (change === "risk-sort") state.riskSort = event.target.value;
    persist(); render();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.drawer) { state.drawer = null; render(); }
    if (event.key === "Enter" && event.target.id === "risk-search") { state.riskSearch = event.target.value; persist(); render(); }
  });

  addEventListener("message", (event) => {
    if (window.parent !== window && event.source !== window.parent) return;
    if (event.origin && event.origin !== "null" && event.origin !== location.origin) return;
    if (event.data?.type === S003_MODELING_SCHEMA.messages.errorResponse) {
      if (!sameS003Identity(event.data.scenarioContext) || event.data.objectiveId !== S003_MODELING_SCHEMA.objective.objectiveId) return;
      s003Modeling.requestState = "failed";
      s003Modeling.receivedAt = localDateTime();
      s003Modeling.contractError = String(event.data.message || "候选试算未完成。");
      const current = route();
      if (current.type === "view" && current.id === "risk" && current.tab === "operations") render();
      return;
    }
    if (event.data?.type === S003_MODELING_SCHEMA.messages.contextResponse || event.data?.type === S003_MODELING_SCHEMA.messages.resultResponse) {
      const contractError = event.data.type === S003_MODELING_SCHEMA.messages.contextResponse
        ? acceptS003ModelingContext(event.data)
        : acceptS003ModelingResult(event.data);
      if (contractError) {
        s003Modeling.requestState = "failed";
        s003Modeling.receivedAt = localDateTime();
        s003Modeling.contractError = contractError;
      }
      const current = route();
      if (current.type === "view" && current.id === "risk" && current.tab === "operations") render();
      return;
    }
    if (event.data?.type !== "OFW_S005_EVALUATION_CONTEXT") return;
    const contractError = acceptS005EvaluationContext(event.data);
    if (contractError) {
      s005Evaluation.scenarioContext = null;
      s005Evaluation.evaluationRun = null;
      s005Evaluation.evaluationResult = null;
      s005Evaluation.receivedAt = localDateTime();
      s005Evaluation.contractError = contractError;
    }
    const current = route();
    if (current.type === "directory" || current.id === "post-investment") render();
  });

  addEventListener("hashchange", () => { state.drawer = null; window.scrollTo({ top: 0, behavior: "instant" }); render(); });
  window.OFW_RISK_DASHBOARD_TEST_API = Object.freeze({
    context: RISK_CONTEXT,
    modelingContext: S003_MODELING_CONTEXT,
    state,
    riskActionRequestId,
    buildRiskActionRequest,
    writeRiskActionRequest,
    riskActionRecord,
    setRiskActionRecord,
    riskIndustry,
    modelingSchema: S003_MODELING_SCHEMA,
    modelingState: s003Modeling,
    formalEnvelope: s003FormalEnvelope,
    normalizedEnvelope: s003NormalizedEnvelope,
    validateCandidateEnvelope: validateS003CandidateEnvelope,
    acceptModelingContext: acceptS003ModelingContext,
    acceptModelingResult: acceptS003ModelingResult,
    requestModelingContext: requestS003ModelingContext,
    focusScenario: focusS003Scenario,
    requestCandidateResult: requestS003CandidateResult,
  });
  window.OFW_S005_DASHBOARD_TEST_API = Object.freeze({
    contextFields: [...S005_CONTEXT_FIELDS],
    domainDefinitions: S005_DOMAIN_DEFINITIONS,
    evaluation: s005Evaluation,
    acceptEvaluationContext: acceptS005EvaluationContext,
    normalizedDomains: normalizedS005Domains,
    requestEvaluation: requestS005Evaluation,
  });
  if (!window.__OFW_DASHBOARD_SKIP_RENDER__) {
    render();
    requestS005Evaluation();
    requestS003ModelingContext();
  }
})();
