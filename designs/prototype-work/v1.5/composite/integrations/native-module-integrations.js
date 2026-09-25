(function installNativeModuleIntegrations(global) {
  "use strict";

  const MODULES = new Set(["data", "ontology", "query", "decision", "agent", "report", "dashboard"]);
  const MODEL_QUESTIONS = Object.freeze({
    S001: Object.freeze([
      { type: "status", question: "当前融资成本模型优化到哪一步？", label: "模型运行" },
      { type: "ranking", question: "哪些融资主体的候选评价结果最需要关注？", label: "候选比较" },
      { type: "simulation", question: "压力模拟对融资组合有什么影响？", label: "压力模拟" }
    ]),
    S002: Object.freeze([
      { type: "ranking", question: "哪些预算单元的候选超支风险最高？", label: "超支风险" },
      { type: "status", question: "预算风险模型目前评测到哪一步？", label: "模型运行" },
      { type: "difference", question: "预算正式结果与候选结果有哪些差异？", label: "结果差异" }
    ]),
    S003: Object.freeze([
      { type: "probability", question: "未来90天最需要关注哪些企业？", label: "风险概率" },
      { type: "liquidity", question: "哪些企业可能出现流动性缺口？", label: "流动性" },
      { type: "contagion", question: "哪些企业存在关系传染风险？", label: "关系风险" },
      { type: "difference", question: "正式模型与候选模型分歧最大的是谁？", label: "模型分歧" },
      { type: "confidence", question: "哪些结果置信度不足？", label: "结果质量" }
    ]),
    S004: Object.freeze([
      { type: "ranking", question: "哪些借款主体需要优先人工复核？", label: "贷前复核" },
      { type: "status", question: "贷前风险候选模型目前评测到哪一步？", label: "模型运行" },
      { type: "missing", question: "哪些贷前结果因数据不足无法完整评价？", label: "数据缺失" }
    ]),
    S005: Object.freeze([
      { type: "ranking", question: "哪些金融产品的候选评价分数最高？", label: "投后评价" },
      { type: "status", question: "投后评价候选模型目前评测到哪一步？", label: "模型运行" },
      { type: "simulation", question: "压力模拟下哪些产品变化最大？", label: "压力模拟" }
    ])
  });
  const QUERY_SCENARIOS = Object.freeze([
    Object.freeze({ id: "ALL", label: "全部问题" }),
    Object.freeze({ id: "S001", label: "融资成本" }),
    Object.freeze({ id: "S002", label: "预算监督" }),
    Object.freeze({ id: "S003", label: "债务风险" }),
    Object.freeze({ id: "S004", label: "贷前评估" }),
    Object.freeze({ id: "S005", label: "投后评价" })
  ]);
  const PORTFOLIO_SCENARIO_IDS = Object.freeze(["S001", "S002", "S003", "S004", "S005"]);
  const DATA_ASSET_NAMES = Object.freeze({
    S001: "集团融资成本分析数据资产",
    S002: "预算执行与异常监测数据资产",
    S003: "企业债务风险纵向观察数据资产",
    S004: "贷前风险评估数据资产",
    S005: "金融产品投后评价数据资产"
  });
  const SEMANTIC_CONTRACT_NAMES = Object.freeze({
    S001: "融资成本分析模型合同",
    S002: "预算风险监测模型合同",
    S003: "债务风险监测模型合同",
    S004: "贷前风险评估模型合同",
    S005: "投后评价模型合同"
  });
  const ONTOLOGY_DISPLAY_ALIASES = Object.freeze({
    "集团融资成本与债务结构优化本体": ["集团融资成本与债务结构优化本体", "ONT-GROUP-FINANCING-OPTIMIZATION"],
    "S002 预算监督管理本体": ["预算监督管理本体", "ONT-BUDGET-SUPERVISION"],
    "企业债务风险本体": ["企业债务风险本体", "ONT-DEBT-RISK-MONITORING"],
    "S003 企业债务风险本体": ["企业债务风险本体", "ONT-DEBT-RISK-MONITORING"],
    "贷款贷前调查本体": ["贷款贷前调查本体", "ONT-PRELOAN-ASSESSMENT"],
    "贷前调查本体": ["贷前调查本体", "ONT-PRELOAN-ASSESSMENT"],
    "S004 贷款贷前调查本体": ["贷款贷前调查本体", "ONT-PRELOAN-ASSESSMENT"],
    "投后评价本体": ["投后评价本体", "ONT-POST-INVESTMENT-EVALUATION"],
    "S005 投后评价本体": ["投后评价本体", "ONT-POST-INVESTMENT-EVALUATION"]
  });
  const ONTOLOGY_VERSION_ALIASES = Object.freeze({
    "预算监督管理本体": "预算监督语义 v1",
    "企业债务风险本体": "债务风险语义 1.0.2",
    "贷款贷前调查本体": "贷前调查语义 V1",
    "贷前调查本体": "贷前调查语义 V1",
    "投后评价本体": "投后评价语义 v1"
  });
  const WORKSPACE_ROUTES = Object.freeze([
    Object.freeze({ id: "query", label: "问数", route: "#module/query" }),
    Object.freeze({ id: "m07", label: "探索", route: "#module/m07" }),
    Object.freeze({ id: "modeling", label: "模型目标", route: "#module/modeling" }),
    Object.freeze({ id: "report", label: "报告", route: "#module/report" }),
    Object.freeze({ id: "dashboard", label: "驾驶舱", route: "#dashboard" })
  ]);
  const RESULT_MODE_LABELS = Object.freeze({
    demo: "演示基准",
    formal: "正式结果",
    fact: "正式结果",
    candidate: "候选试算",
    prediction: "候选试算",
    shadow: "影子观察",
    simulation: "压力模拟",
    difference: "正式与候选差异"
  });
  const OBJECT_TYPE_LABELS = Object.freeze({
    Enterprise: "企业",
    RiskEvent: "风险事件",
    CashFlowObservation: "现金流观察",
    DebtMaturity: "债务到期",
    RelationshipEdge: "关系边",
    ModelResult: "模型结果",
    BenchmarkRun: "评测运行",
    ShadowTrial: "影子观察",
    FinancingEntity: "融资主体",
    FinancingPortfolio: "融资组合",
    BudgetUnit: "预算单元",
    LoanApplicant: "借款主体",
    FinancialProduct: "金融产品",
    InvestmentHolding: "投资持仓"
  });
  const S005_EVENT_BY_OPERATION = Object.freeze({
    source_delivery: "M02_SOURCE_QUALITY_DELIVERED",
    semantic_candidate: "M01_SEMANTIC_CANDIDATE_DELIVERED",
    compliance_evaluation: "M03_COMPLIANCE_RESULT_DELIVERED",
    market_peer_evaluation: "M03_MARKET_PEER_RESULT_DELIVERED",
    selection_read_only: "M04_SELECTION_SCOPE_CONFIRMED",
    risk_explanation: "M05_RISK_RESULT_DELIVERED",
    report_draft: "M06_REPORT_DRAFT_DELIVERED"
  });

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const fmt = (value, digits = 1) => value != null && value !== "" && Number.isFinite(Number(value)) ? Number(value).toFixed(digits).replace(/\.0$/, "") : "无法评价";
  const short = (value, size = 38) => String(value || "—").length > size ? `${String(value).slice(0, size - 9)}...${String(value).slice(-6)}` : String(value || "—");
  const confidenceText = (item) => {
    const score = item?.confidenceScore ?? (typeof item?.confidence === "number" ? item.confidence : null);
    const label = typeof item?.confidence === "string" ? ({ HIGH: "高", MEDIUM: "中", LOW: "低", VERY_LOW: "很低", UNAVAILABLE: "缺少依据" })[item.confidence] || item.confidence : "";
    return score == null ? label || "未量化" : `${label ? `${label} · ` : ""}${fmt(score * 100)}%`;
  };
  const objectTypeLabel = (value) => OBJECT_TYPE_LABELS[value] || String(value || "业务对象").replace(/([a-z0-9])([A-Z])/g, "$1 $2");

  function statusLabel(status) {
    return ({
      NOT_EVALUATED: "无法评价",
      DATA_PREPARATION: "准备数据",
      DATA_BUILT: "数据已形成",
      DATA_VALIDATED: "质量已校验",
      DATA_FROZEN: "数据版本已冻结",
      CONTRACT_READY: "语义合同已形成",
      BASELINE_BENCHMARKED: "基线已评测",
      MODEL_PORTFOLIO_EVALUATED: "模型组合已评测",
      INSIGHT_REVIEW_REQUIRED: "等待人工审查",
      INSIGHTS_APPROVED: "优化洞察已批准",
      CANDIDATE_READY: "候选版本已形成",
      SHADOW_ACTIVE: "影子试运行中",
      SHADOW_MATURED: "影子观察已成熟",
      REBENCHMARKED: "成熟标签已复评",
      RELEASE_CANDIDATE_READY: "发布候选已形成",
      BINDING_VALIDATED: "消费绑定已校验",
      BINDING_APPLIED: "已应用并持续监测",
      BINDING_ROLLED_BACK: "候选应用已回退",
      EVALUATED: "已评价",
      PARTIAL: "部分评价",
      NOT_EVALUABLE: "无法评价",
      INSUFFICIENT_HISTORY: "观察期不足"
    })[status] || status || "尚未开始";
  }

  function mount({ frame, module, scenarioContext, apiBase, navigate, focusScenario = null, onState, onViewReady = null, scenarioProjection: initialScenarioProjection = null, runScenarioOperation = null, workspaceContext: initialWorkspaceContext = null, updateWorkspaceContext: initialWorkspaceUpdater = null }) {
    const win = frame?.contentWindow;
    const doc = frame?.contentDocument;
    if (!MODULES.has(module?.id) || !win || !doc?.body || !scenarioContext?.scenarioId) return null;
    if (win.__OFW_NATIVE_MODULE_INTEGRATION__) {
      if (initialWorkspaceContext != null || initialWorkspaceUpdater != null) win.__OFW_NATIVE_MODULE_INTEGRATION__.setWorkspaceContext?.(initialWorkspaceContext, initialWorkspaceUpdater);
      else win.__OFW_NATIVE_MODULE_INTEGRATION__.refresh();
      return win.__OFW_NATIVE_MODULE_INTEGRATION__;
    }

    const scenarioId = scenarioContext.scenarioId;
    const W = global.OFW_WORKFLOW;
    const lifetime = new win.AbortController();
    let destroyed = false;
    let drawerTrigger = null;
    let context = null;
    let portfolioContexts = new Map();
    let loading = false;
    let queryAnswer = null;
    let queryStorageError = "";
    let pendingQueryRun = null;
    let queryRunning = false;
    let queryActionState = null;
    let queryEpoch = 0;
    let queryTimers = [];
    let queryDecorationTimers = [];
    let queryRecommendationScenario = "ALL";
    let selectedSubjectId = "";
    let agentResult = null;
    let reportDraft = readReportDraft();
    let scenarioProjection = initialScenarioProjection;
    let dashboardView = "formal";
    let operationError = "";
    let timer = null;
    let decisionOpsFilter = "all";
    let decisionReturnRoute = null;
    let lastWorkspaceQueryRunId = "";
    let selectedDataScenarioId = scenarioId;
    let selectedOntologyScenarioId = scenarioId;
    let dataNormalizationPending = false;
    let decisionBoundaryPending = false;
    let workspaceContext = initialWorkspaceContext && typeof initialWorkspaceContext === "object" ? clone(initialWorkspaceContext) : {};
    let workspaceUpdater = typeof initialWorkspaceUpdater === "function" ? initialWorkspaceUpdater : null;
    const reportEditor = global.OFW_REPORT_EDITOR.create({ doc, scenarioId, openDrawer, navigate, updateWorkspaceContext: publishWorkspaceContext, onSave: (draft) => { reportDraft = draft; renderReport(); } });
    const snapshotAssets=module.id==='data'?global.OFW_V14_SNAPSHOT_ASSETS?.create({doc,win,openDrawer,signal:lifetime.signal}):null;
    const businessSourceAsset=module.id==='data'?global.OFW_BUSINESS_SOURCE_ASSET?.create({doc,win,openDrawer,signal:lifetime.signal,onLoaded:()=>win.__OFW_NATIVE_MODULE_INTEGRATION__?.refresh()}):null;
    const ontologyRules=module.id==='ontology'?global.OFW_V14_ONTOLOGY_RULES?.create({doc,win,signal:lifetime.signal}):null;

    function currentEnvelope() { return W.envelopeFor(state(), workspaceResultMode().id); }
    function scopedSubjects(envelope = currentEnvelope(), currentState = state()) { return W.scopeRows(normalizedSubjects(envelope, currentState), workspaceContext); }

    function readReportDraft() {
      return W.readReport(scenarioId);
    }

    function saveReportDraft(value) {
      reportDraft = W.saveReport(scenarioId, value);
    }

    async function request(path, options = {}) {
      const headers = { ...(options.headers || {}) };
      if (options.body) headers["content-type"] = "application/json";
      const response = await fetch(`${apiBase}${path}`, { ...options, headers, cache: "no-store", signal: lifetime.signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(payload.message || `服务返回 ${response.status}`), { code: payload.code || "REQUEST_FAILED" });
      return payload;
    }

    function portfolioContext(targetScenarioId = scenarioId) { return portfolioContexts.get(targetScenarioId) || (targetScenarioId === scenarioId ? context : null); }
    function state(source = context) { return source?.state || {}; }
    function questions(targetScenarioId = scenarioId) { return MODEL_QUESTIONS[targetScenarioId] || []; }

    function businessName(targetScenarioId) {
      return portfolioContext(targetScenarioId)?.ui?.businessName || ({ S001: "融资成本", S002: "预算监督", S003: "债务风险", S004: "贷前评估", S005: "投后评价" })[targetScenarioId] || "业务模型";
    }

    function record(value) {
      return value && typeof value === "object" && !Array.isArray(value) ? value : null;
    }

    function mergeWorkspaceContext(base, patch) {
      const current = record(base) || {};
      const next = record(patch) || {};
      const merged = { ...current, ...next };
      for (const [alias, canonical] of [["object", "activeObjectRef"], ["objectSet", "objectSetRef"]]) {
        if (Object.hasOwn(next, alias)) merged[canonical] = clone(next[alias]);
        if (Object.hasOwn(next, canonical)) merged[alias] = clone(next[canonical]);
      }
      if (Object.hasOwn(next, "resultView")) merged.resultMode = { id: next.resultView, label: RESULT_MODE_LABELS[next.resultView] };
      return merged;
    }

    function workspaceObjectSet() {
      const value = record(workspaceContext.objectSet) || record(workspaceContext.objectSetRef) || record(workspaceContext.scope) || {};
      const ids = value.objectIds || value.ids || workspaceContext.objectIds || [];
      const count = Number(value.count ?? workspaceContext.objectCount ?? (Array.isArray(ids) ? ids.length : 0));
      const label = value.label || value.name || value.title || workspaceContext.objectSetLabel || workspaceContext.scopeLabel;
      if (label) return { id: value.id || workspaceContext.objectSetId || "", label: String(label), count: Number.isFinite(count) ? count : 0, objectIds: Array.isArray(ids) ? ids : [] };
      if (queryAnswer?.rows?.length) return { id: `query:${queryAnswer.queryScenarioId || scenarioId}`, label: `${queryAnswer.rows.length} 条问数结果`, count: queryAnswer.rows.length, objectIds: queryAnswer.rows.map((item) => item.id).filter(Boolean) };
      const subjects = normalizedSubjects();
      if (subjects.length) return { id: `result:${scenarioId}`, label: `当前结果对象集`, count: subjects.length, objectIds: subjects.map((item) => item.id).filter(Boolean) };
      return { id: "all-business-objects", label: "全部业务对象", count: 0, objectIds: [] };
    }

    function workspaceObject() {
      const value = record(workspaceContext.object) || record(workspaceContext.activeObjectRef) || record(workspaceContext.selectedObject) || {};
      const id = value.id || value.objectId || workspaceContext.objectId || workspaceContext.selectedObjectId || "";
      const label = value.label || value.name || value.title || workspaceContext.objectLabel || workspaceContext.selectedObjectLabel || "";
      const type = value.type || value.objectType || value.objectTypeRef || workspaceContext.objectType || "";
      if (id || label) return { id: String(id), label: String(label || id), type: String(type) };
      const selected = normalizedSubjects().find((item) => item.id === selectedSubjectId) || null;
      return selected ? { id: selected.id, label: selected.name, type: context?.ui?.subjectLabel || "业务对象" } : { id: "", label: "未聚焦单个对象", type: "" };
    }

    function workspaceTimeRange() {
      const value = record(workspaceContext.timeRange) || record(workspaceContext.timeWindow) || {};
      const start = value.start || value.from || workspaceContext.timeStart || "";
      const end = value.end || value.to || value.asOf || workspaceContext.timeEnd || workspaceContext.asOf || state().scenario?.dataAsOf || scenarioContext.formedAt?.slice?.(0, 10) || "";
      const label = value.label || workspaceContext.timeLabel || (start && end ? `${start} 至 ${end}` : end ? `截至 ${end}` : "当前周期");
      return { start: String(start), end: String(end), label: String(label) };
    }

    function workspaceResultMode() {
      const value = record(workspaceContext.resultMode) || record(workspaceContext.result) || {};
      const raw = value.id || value.kind || value.value || workspaceContext.resultView || workspaceContext.resultMode || workspaceContext.resultKind || (queryAnswer?.spec?.type === "simulation" ? "simulation" : dashboardView || "formal");
      const id = String(raw || "formal").toLowerCase();
      const label = value.label || workspaceContext.resultModeLabel || RESULT_MODE_LABELS[id] || statusLabel(raw) || "正式结果";
      return { id, label: String(label) };
    }

    function resolvedWorkspaceContext() {
      return {
        ...clone(workspaceContext),
        objectSet: workspaceObjectSet(),
        object: workspaceObject(),
        timeRange: workspaceTimeRange(),
        resultMode: workspaceResultMode()
      };
    }

    function updateWorkspaceContextFromDashboard(patch) {
      return publishWorkspaceContext(patch, { syncDashboard: false, renderBar: false });
    }

    function syncDashboardWorkspaceContext() {
      if (module.id !== "dashboard") return;
      win.__OFW_WORKSPACE_CONTEXT__ = clone(workspaceContext);
      win.__OFW_UPDATE_WORKSPACE_CONTEXT__ = workspaceUpdater;
      win.OFW_DASHBOARD_WORKSPACE?.setContext?.(clone(workspaceContext), updateWorkspaceContextFromDashboard);
    }

    function publishWorkspaceContext(patch, options = {}) {
      if (!record(patch)) return resolvedWorkspaceContext();
      workspaceContext = mergeWorkspaceContext(workspaceContext, patch);
      try { workspaceUpdater?.(clone(patch)); } catch (_) {}
      if (options.syncDashboard !== false) syncDashboardWorkspaceContext();
      if (options.renderBar !== false) renderWorkspaceContextBar();
      return resolvedWorkspaceContext();
    }

    function setWorkspaceContext(next, updater = workspaceUpdater) {
      workspaceContext = record(next) ? clone(next) : {};
      workspaceUpdater = typeof updater === "function" ? updater : null;
      syncDashboardWorkspaceContext();
      renderWorkspaceContextBar();
      if (module.id === "agent") { agentResult = null; selectedSubjectId = ""; renderAgent(); }
    }

    function workspaceRouteMarkup() {
      return WORKSPACE_ROUTES.map((item) => {
        const current = module.id === item.id || module.id === "dashboard" && item.id === "dashboard";
        if (current && item.id === "report") return `<button type="button" class="ofw-workspace-jump active" data-ofw-native-action="report-add-context">加入报告</button>`;
        if (current) return `<span class="ofw-workspace-jump active" aria-current="page">${esc(item.label)}</span>`;
        return `<button type="button" class="ofw-workspace-jump" data-ofw-native-route="${esc(item.route)}">${esc(item.label)}</button>`;
      }).join("");
    }

    function workspaceContextMarkup() {
      const current = resolvedWorkspaceContext();
      return `<div class="ofw-workspace-facts"><div><span>对象集</span><strong>${esc(current.objectSet.label)}</strong></div><div><span>当前对象</span><strong>${esc(current.object.label)}</strong></div><div><span>时间</span><strong>${esc(current.timeRange.label)}</strong></div><div><span>结果模式</span><strong>${esc(current.resultMode.label)}</strong></div></div><nav class="ofw-workspace-jumps" aria-label="跨模块工作入口">${workspaceRouteMarkup()}</nav>`;
    }

    function renderWorkspaceContextBar() {
      doc.querySelectorAll("[data-ofw-workspace-context]").forEach((item) => item.remove());
      if (module.id === "dashboard") syncDashboardWorkspaceContext();
      if (module.id === "query") renderQueryScope();
    }

    function renderQueryScope() {
      const pill = doc.querySelector(".modern-context-pill");
      if (!pill) return;
      const object = workspaceContext.activeObjectRef || workspaceContext.object;
      const set = workspaceContext.objectSetRef || workspaceContext.objectSet;
      const scoped = object?.id || set?.objectIds?.length || set?.selectionMode;
      const label = object?.title || object?.label || object?.name || (scoped ? set?.title || set?.label : "") || "全部业务对象";
      pill.innerHTML = `<span></span><b title="${esc(label)}">${esc(label)}</b>${scoped ? `<button type="button" class="query-scope-clear" data-ofw-native-action="query-clear-scope" aria-label="清除对象筛选" title="清除对象筛选"><i data-lucide="x" aria-hidden="true"></i></button>` : ""}`;
      win.lucide?.createIcons?.({ root: pill });
    }

    function scenarioAction(operation) {
      return scenarioProjection?.actions?.find((item) => item.operation === operation) || null;
    }

    function scenarioOutput(operation) {
      const eventType = S005_EVENT_BY_OPERATION[operation];
      return scenarioProjection?.moduleOutputs?.find((item) => item.eventType === eventType || item.outputKind === eventType || item.payload?.operation === operation) || null;
    }

    async function runScenario(operation) {
      operationError = "";
      try {
        if (typeof runScenarioOperation !== "function") throw new Error("当前场景操作未连接。");
        scenarioProjection = await runScenarioOperation(operation);
        render();
        return scenarioProjection;
      } catch (error) {
        operationError = error.message || "当前操作未完成。";
        render();
        return null;
      }
    }

    function normalizeDataSourcePortfolio() {
      const data = win.DE_DATA;
      if (!data?.sources?.length) return false;
      if (!win.__OFW_V130_DATA_SOURCE_BLUEPRINTS__) win.__OFW_V130_DATA_SOURCE_BLUEPRINTS__ = clone(data.sources);
      const blueprints = win.__OFW_V130_DATA_SOURCE_BLUEPRINTS__;
      const currentById = new Map(data.sources.map((item) => [item.id, item]));
      const baseById = new Map(blueprints.map((item) => [item.id, item]));
      const definitions = [
        { primary: "s002-src-2025-actual", ids: ["s002-src-2024-actual", "s002-src-2025-actual"], name: "实际执行明细", description: "年度实际执行与年末计提文件按数据截至时间形成连续快照。", category: "预算执行" },
        { primary: "s002-src-2025-budget", ids: ["s002-src-2024-budget", "s002-src-2025-budget"], name: "预算下达明细", description: "各年度最终批准预算在同一来源下追加快照。", category: "预算编制" },
        { primary: "s002-src-2026-submission", ids: ["s002-src-2025-submission", "s002-src-2026-submission"], name: "预算申报明细汇总", description: "各年度部门预算申报结果按申报批次形成快照。", category: "预算编制" },
        { primary: "s004-annual-2025", ids: ["s004-annual-2023", "s004-annual-2024", "s004-annual-2025"], name: "中国广核年度报告", description: "年度报告按披露年度形成受控快照，历史报告不拆分为多个数据源。", category: "财务报告" }
      ];
      const memberIds = new Set(definitions.flatMap((item) => item.ids));
      const normalized = [];
      const emitted = new Set();
      for (const original of blueprints) {
        const definition = definitions.find((item) => item.ids.includes(original.id));
        if (!definition) {
          normalized.push(currentById.get(original.id) || clone(original));
          continue;
        }
        if (emitted.has(definition.primary)) continue;
        emitted.add(definition.primary);
        const records = definition.ids.map((id) => baseById.get(id)).filter(Boolean);
        const snapshots = records.flatMap((item) => item.snapshots || []).map(clone).sort((left, right) => String(right.asOf || right.acquiredAt || "").localeCompare(String(left.asOf || left.acquiredAt || ""), "zh-CN"));
        const latest = snapshots[0] || null;
        const primary = clone(currentById.get(definition.primary) || baseById.get(definition.primary) || records.at(-1));
        Object.assign(primary, {
          id: definition.primary,
          name: definition.name,
          description: definition.description,
          category: definition.category,
          snapshots,
          snapshotCount: snapshots.length,
          fileName: latest?.fileName || primary.fileName,
          asOf: latest?.asOf || primary.asOf,
          latestAcquired: latest?.acquiredAt?.slice?.(0, 16) || primary.latestAcquired,
          registration: snapshots.length ? "快照已确认 · 已用于正式运行" : primary.registration,
          physicalEvidence: latest ? `当前快照 · ${latest.fileName}` : primary.physicalEvidence,
          snapshotSeries: definition.ids.map((id) => ({ sourceId: id, sourceName: baseById.get(id)?.name || id }))
        });
        normalized.push(primary);
      }
      for (const item of data.sources) if (!baseById.has(item.id) && !memberIds.has(item.id)) normalized.push(item);
      const before = data.sources.map((item) => `${item.id}:${item.name}:${item.snapshotCount}`).join("|");
      const after = normalized.map((item) => `${item.id}:${item.name}:${item.snapshotCount}`).join("|");
      data.sources.splice(0, data.sources.length, ...normalized);
      return before !== after;
    }

    function refreshDataSourcePortfolio() {
      if (module.id !== "data" || dataNormalizationPending) return;
      if (!normalizeDataSourcePortfolio()) return;
      dataNormalizationPending = true;
      global.setTimeout(() => {
        dataNormalizationPending = false;
        win.dispatchEvent(new win.HashChangeEvent("hashchange"));
      }, 0);
    }

    function renderDataLineage(renderedAssetCount = null) {
      const main = doc.querySelector(".app-workspace > .main");
      if (!main || !/^#\/resources(?:$|[/?])/.test(win.location.hash)) { doc.querySelector("[data-ofw-data-lineage]")?.remove(); return; }
      const data = win.DE_DATA || {};
      const sources = Array.isArray(data.sources) ? data.sources : [];
      const snapshots = sources.reduce((total, item) => total + (Array.isArray(item.snapshots) ? item.snapshots.length : Number(item.snapshotCount || 0)), 0)+(snapshotAssets?.snapshotCount()||0);
      const pipelines = Array.isArray(data.pipelines) ? data.pipelines : [];
      const baseAssets = Array.isArray(data.assets) ? data.assets : Array.isArray(data.dataAssets) ? data.dataAssets : [];
      const modelAssets = PORTFOLIO_SCENARIO_IDS.filter((id) => Boolean(state(portfolioContext(id)).data)).length;
      const renderedAssets = Number.isFinite(Number(renderedAssetCount)) ? Number(renderedAssetCount) : doc.querySelectorAll(".asset-resource-table tbody tr, .asset-column .asset-grid > .asset-card").length;
      const assetCount = Math.max(baseAssets.length + modelAssets, renderedAssets);
      const layers = [
        { index: 1, label: "数据源", detail: "连接、登记与采集计划", value: sources.length+(snapshotAssets?.sourceCount()||0), hash: "#/resources", target: ".source-column" },
        { index: 2, label: "来源快照", detail: "同一来源下的时间版本", value: snapshots, hash: "#/resources", target: ".source-column" },
        { index: 3, label: "数据管道", detail: "定义版本、运行与质量结果", value: pipelines.length, hash: "#/pipelines?tab=list", target: ".pipeline-list" },
        { index: 4, label: "数据资产", detail: "冻结后供语义与分析消费", value: assetCount, hash: "#/resources", target: ".asset-column" }
      ];
      let root = doc.querySelector("[data-ofw-data-lineage]");
      if (!root) {
        root = doc.createElement("section");
        root.className = "ofw-data-lineage";
        root.dataset.ofwDataLineage = "true";
        main.prepend(root);
      }
      root.innerHTML = `<header><div><h2>数据生产链</h2><p>从来源到可消费资产，每一层保留独立版本、运行状态与证据。</p></div><span>${sources.length+(snapshotAssets?.sourceCount()||0)} 个来源 · ${snapshots} 个快照</span></header><div>${layers.map((item) => `<button class="ofw-data-layer" type="button" data-ofw-native-action="data-layer" data-local-hash="${esc(item.hash)}" data-target-selector="${esc(item.target)}"><i>${item.index}</i><span>${esc(item.label)}<small>${esc(item.detail)}</small></span><strong>${item.value}</strong></button>`).join("")}</div>`;
    }

    function semanticPortfolioSummary() {
      const contracts = PORTFOLIO_SCENARIO_IDS.map((id) => state(portfolioContext(id))).filter((item) => item.semanticContract);
      const seeds = [win.OFW_M01_S001_SEED, win.OFW_M01_S002_SEED, win.OFW_M01_S003_SEED, win.OFW_M01_S004_SEED, win.OFW_M01_S005_SEED].filter(Boolean);
      const published = seeds.flatMap((seed) => [
        ...(seed.publishedVersions || []),
        ...(seed.drafts || []).filter((item) => /published|已发布/i.test(item.status || item.publicationState || ""))
      ]);
      const uniquePublished = [...new Map(published.map((item) => [item.ontologyStableId || item.id || item.name, item])).values()];
      const objectTypes = new Set([
        ...contracts.flatMap((item) => item.semanticContract?.objectTypes || []),
        ...uniquePublished.flatMap((item) => (item.objects || []).map((object) => object.id || object.name).filter(Boolean))
      ]);
      const metrics = contracts.reduce((total, item) => total + (item.semanticContract?.metrics?.length || 0), 0) + uniquePublished.reduce((total, item) => total + (item.metrics?.length || 0), 0);
      const relationDefinitions = contracts.reduce((total, item) => total + (item.semanticContract?.relations?.length || 0), 0) + uniquePublished.reduce((total, item) => total + (item.links?.length || item.dataContract?.relations?.length || item.sourceDataContract?.relations?.length || 0), 0);
      const relationEdges = contracts.reduce((total, item) => total + Number(item.data?.relationEdgeCount || 0), 0);
      const modelBindings = contracts.reduce((total, item) => total + (item.semanticContract?.modelBindings?.length || item.modelDefinitions?.length || 0), 0);
      const resultIdentities = new Set(contracts.flatMap((item) => (item.semanticContract?.resultIdentities || []).map((identity) => identity.resultKind).filter(Boolean)));
      const actionTypes = uniquePublished.reduce((total, item) => total + (item.actions?.length || 0), 0);
      const visiblePublished = doc.querySelectorAll(".published-ontology-card:not([data-ofw-native-model-contract])").length;
      return { contracts: Math.max(uniquePublished.length, visiblePublished) + contracts.length, objectTypes: objectTypes.size, metrics, relationDefinitions, relationEdges, modelBindings, resultIdentities: resultIdentities.size, actionTypes };
    }

    function renderOntologyOverview() {
      doc.querySelector("[data-ofw-ontology-overview]")?.remove();
    }

    function ensureStyle() {
      if (doc.getElementById("ofw-native-integration-style")) return;
      const style = doc.createElement("style");
      style.id = "ofw-native-integration-style";
      style.textContent = `
        .ofw-native-action{display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:0 11px;border:1px solid #c7d1db;border-radius:5px;background:#fff;color:#31465b;font:700 11px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;cursor:pointer}.ofw-native-action:hover{border-color:#8fa8c0;color:#23558b;background:#f6f9fb}.ofw-native-action.primary{border-color:#315fae;color:#fff;background:#315fae}.ofw-native-action:disabled{opacity:.5;cursor:not-allowed}
        .ofw-native-drawer-backdrop{position:fixed;inset:0;z-index:9999;display:flex;justify-content:flex-end;background:rgba(15,29,43,.34);backdrop-filter:blur(2px)}.ofw-native-drawer{width:min(540px,100%);height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:#fff;box-shadow:-18px 0 48px rgba(15,31,47,.2)}.ofw-native-drawer>header,.ofw-native-drawer>footer{padding:13px 15px;display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid #dce3e9}.ofw-native-drawer>footer{border-top:1px solid #dce3e9;border-bottom:0;justify-content:flex-end;background:#f8fafb}.ofw-native-drawer>header h2{margin:0;font-size:17px}.ofw-native-drawer>header p{margin:3px 0 0;color:#6b7987;font-size:10px}.ofw-native-drawer-body{min-height:0;padding:15px;overflow:auto}.ofw-native-close{width:32px;height:32px;border:1px solid #d5dde4;border-radius:5px;background:#fff;cursor:pointer}.ofw-native-facts{margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;border:1px solid #dce3e9;background:#dce3e9}.ofw-native-facts>div{min-width:0;padding:9px;background:#fff}.ofw-native-facts dt{color:#6b7987;font-size:9px}.ofw-native-facts dd{margin:3px 0 0;font-size:10px;font-weight:700;overflow-wrap:anywhere}.ofw-native-steps{margin-top:12px;display:grid;gap:7px}.ofw-native-step{padding:9px 10px;display:grid;grid-template-columns:24px minmax(0,1fr) auto;align-items:center;gap:8px;border:1px solid #dce3e9;border-radius:5px;background:#f8fafb}.ofw-native-step>i{width:22px;height:22px;display:grid;place-items:center;border-radius:50%;font-style:normal;color:#fff;background:#8a99a8}.ofw-native-step.done{border-color:#b9d9cc;background:#f0f8f4}.ofw-native-step.done>i{background:#24775d}.ofw-native-step.current{border-color:#a6bdd8;background:#f1f6fc}.ofw-native-step.current>i{background:#315fae}.ofw-native-step strong,.ofw-native-step small{display:block}.ofw-native-step small{margin-top:2px;color:#6b7987;font-size:9px}.ofw-native-note{margin-top:12px;padding:10px;border:1px solid #d4e0ea;border-radius:5px;background:#f5f9fc;color:#4b5d6e;font-size:10px}.ofw-native-error{margin-top:10px;padding:9px 10px;border:1px solid #e4b8b5;border-radius:5px;background:#fff2f1;color:#9a3e39;font-size:10px}
        .ofw-workspace-context{min-height:54px;padding:7px 14px;display:flex;align-items:center;justify-content:space-between;gap:14px;border-bottom:1px solid #cbd7e0;background:#f4f7f9;color:#1e3042;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}.ofw-workspace-facts{min-width:0;display:grid;grid-template-columns:repeat(4,minmax(116px,auto));align-items:center}.ofw-workspace-facts>div{min-width:0;padding:0 13px;border-right:1px solid #d6e0e7}.ofw-workspace-facts>div:first-child{padding-left:0}.ofw-workspace-facts>div:last-child{border-right:0}.ofw-workspace-facts span,.ofw-workspace-facts strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ofw-workspace-facts span{color:#71808e;font-size:9px;font-weight:650}.ofw-workspace-facts strong{margin-top:2px;font-size:11px}.ofw-workspace-jumps{display:flex;align-items:center;gap:3px;flex:0 0 auto}.ofw-workspace-jump{min-height:30px;padding:0 9px;display:inline-flex;align-items:center;justify-content:center;border:1px solid transparent;border-radius:4px;color:#42586b;background:transparent;font-size:10px;font-weight:750;white-space:nowrap}.ofw-workspace-jump:hover{border-color:#b9c8d4;background:#fff;color:#245d8d}.ofw-workspace-jump.active{border-color:#b7c9d8;color:#164f7d;background:#fff;box-shadow:inset 0 -2px #2f6f9d}
        .ofw-data-lineage,.ofw-ontology-overview,.ofw-task-result-board{margin:12px 16px 0;border:1px solid #ccd7df;background:#fff;color:#1d2e40;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}.ofw-data-lineage>header,.ofw-ontology-overview>header,.ofw-task-result-board>header{min-height:43px;padding:8px 12px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #dce4e9}.ofw-data-lineage h2,.ofw-ontology-overview h2,.ofw-task-result-board h2{margin:0;font-size:13px}.ofw-data-lineage p,.ofw-ontology-overview p,.ofw-task-result-board p{margin:2px 0 0;color:#6f7e8b;font-size:9px}.ofw-data-lineage>div{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));background:#dbe3e9;gap:1px}.ofw-data-layer{min-height:70px;padding:10px 12px;display:grid;grid-template-columns:28px minmax(0,1fr) auto;align-items:center;gap:9px;border:0;background:#fff;text-align:left}.ofw-data-layer:hover{background:#f5f9fc}.ofw-data-layer>i{width:26px;height:26px;display:grid;place-items:center;border-radius:50%;color:#fff;background:#527797;font-size:10px;font-style:normal;font-weight:800}.ofw-data-layer span,.ofw-data-layer strong,.ofw-data-layer small{display:block}.ofw-data-layer span{font-size:11px;font-weight:750}.ofw-data-layer small{margin-top:2px;color:#788692;font-size:8px}.ofw-data-layer strong{font-size:19px}.ofw-ontology-overview>div{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:#dce4e9}.ofw-ontology-overview article{min-width:0;min-height:68px;padding:10px 12px;background:#fff}.ofw-ontology-overview span,.ofw-ontology-overview strong,.ofw-ontology-overview small{display:block}.ofw-ontology-overview span{color:#72818e;font-size:9px}.ofw-ontology-overview strong{margin-top:3px;font-size:18px}.ofw-ontology-overview small{margin-top:3px;color:#667684;font-size:9px}.ofw-task-result-board>div{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:#dce4e9}.ofw-task-result-board article{min-width:0;min-height:96px;padding:11px 12px;display:grid;align-content:start;gap:4px;background:#fff}.ofw-task-result-board article>span{color:#6f7e8b;font-size:9px}.ofw-task-result-board article>strong{font-size:13px}.ofw-task-result-board article>small{color:#6f7e8b;font-size:9px;line-height:1.45}.ofw-task-result-board article>button{width:max-content;margin-top:5px;padding:0;border:0;color:#24618f;background:transparent;font-size:10px;font-weight:750}.ofw-report-context-summary{margin-top:10px;padding:10px;border:1px solid #cbd9e3;background:#f5f9fc}.ofw-report-context-summary strong,.ofw-report-context-summary span{display:block}.ofw-report-context-summary strong{font-size:11px}.ofw-report-context-summary span{margin-top:3px;color:#657684;font-size:9px;line-height:1.5}
        .modern-start[hidden],.modern-question-grid>button[hidden]{display:none!important}.modern-topic-tabs.ofw-parent-topic-tabs{display:none!important}.ofw-query-scenario-tabs{max-width:min(100%,820px);display:flex;align-items:center;gap:4px;padding:4px;overflow-x:auto;border:1px solid rgba(123,122,113,.13);border-radius:21px;background:rgba(221,221,214,.64);scrollbar-width:none}.ofw-query-scenario-tabs::-webkit-scrollbar{display:none}.ofw-query-scenario-tabs button{min-height:34px;padding:0 13px;flex:0 0 auto;border:0;border-radius:17px;color:#5c5d57;background:transparent;font-size:12px;font-weight:680;white-space:nowrap}.ofw-query-scenario-tabs button small{display:inline-grid;min-width:20px;height:20px;margin-left:6px;place-items:center;border-radius:10px;color:#85867f;background:rgba(255,255,255,.62);font-size:10px}.ofw-query-scenario-tabs button.is-active{color:#203f36;background:#fff;box-shadow:0 3px 12px rgba(37,40,43,.09)}.ofw-native-model-question{order:0}.ofw-native-query-answer{display:contents}.ofw-native-query-table{margin-top:12px;display:grid;gap:5px}.ofw-native-query-row{padding:8px 9px;display:grid;grid-template-columns:minmax(0,1.4fr) repeat(3,minmax(85px,.55fr)) auto;align-items:center;gap:8px;border:1px solid #e0e5e9;border-radius:5px;background:#fff}.ofw-native-query-row strong{font-size:10px}.ofw-native-query-row span{color:#647382;font-size:9px}.ofw-query-focus{min-height:28px;padding:0 8px;border:1px solid #c8d5df;border-radius:4px;color:#315f87;background:#f6fafc;font-size:9px;font-weight:750}.ofw-query-focus:hover{border-color:#7fa1bb;background:#fff}.ofw-native-query-evidence{margin-top:10px;color:#6d7b88;font:9px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}.ofw-native-query-detail{display:grid;gap:6px}.ofw-native-query-detail article{padding:9px;border:1px solid #dce3e9;border-radius:5px;background:#f8fafb}.ofw-native-query-detail strong,.ofw-native-query-detail span,.ofw-native-query-detail code{display:block}.ofw-native-query-detail span{margin-top:3px;color:#687786;font-size:9px}.ofw-native-query-detail code{margin-top:5px;color:#526374;font-size:8px;overflow-wrap:anywhere}
        .text-result>.metric-grid{grid-template-columns:repeat(auto-fit,minmax(145px,1fr))!important}.text-result>.metric-grid .metric-card{min-height:102px!important}.modern-detail-actions{border:1px solid #dbb561!important;background:#fff8e8!important;box-shadow:0 10px 28px rgba(126,85,20,.08)!important}.modern-detail-actions h3{font-size:17px!important}.modern-action-item{min-height:64px!important;padding:11px 12px!important;background:#fff!important}.modern-action-item .ui-button{min-height:42px!important;padding-inline:15px!important;background:#9a5a16!important;border-color:#9a5a16!important;color:#fff!important;font-size:12px!important}.modern-bi-canvas.is-switching .ui-mini-chart__plot{opacity:.12!important;transform:translateY(12px) scale(.985)!important;filter:blur(2px)}.modern-bi-canvas .ui-mini-chart__plot{transition:opacity 320ms cubic-bezier(.2,.85,.25,1),transform 320ms cubic-bezier(.2,.85,.25,1),filter 220ms ease!important}.modern-lieflat-chart[data-chart-type="horizontal-bar"] .ui-mini-chart__horizontal-bars{gap:10px}.modern-lieflat-chart[data-chart-type="horizontal-bar"] .ui-mini-chart__bar-row{min-height:48px;grid-template-columns:minmax(118px,170px) minmax(0,1fr) 90px}.modern-lieflat-chart[data-chart-type="horizontal-bar"] .ui-mini-chart__bar-track{height:22px;border-radius:1px;background:repeating-linear-gradient(90deg,#eceeea 0,#eceeea 1px,transparent 1px,transparent 20%)}.modern-lieflat-chart[data-chart-type="horizontal-bar"] .ui-mini-chart__bar-fill{border-radius:1px;transform-origin:left;animation:ofw-lieflat-bar-in 520ms cubic-bezier(.2,.8,.2,1) both}.modern-lieflat-chart[data-chart-type="horizontal-bar"] .ui-mini-chart__bar-row:nth-child(2) .ui-mini-chart__bar-fill{animation-delay:55ms}.modern-lieflat-chart[data-chart-type="horizontal-bar"] .ui-mini-chart__bar-row:nth-child(3) .ui-mini-chart__bar-fill{animation-delay:110ms}.modern-lieflat-chart[data-chart-type="horizontal-bar"] .ui-mini-chart__bar-row:nth-child(4) .ui-mini-chart__bar-fill{animation-delay:165ms}.modern-lieflat-chart[data-chart-type="horizontal-bar"] .ui-mini-chart__bar-row:nth-child(5) .ui-mini-chart__bar-fill{animation-delay:220ms}.modern-lieflat-chart[data-chart-type="horizontal-bar"] .ui-mini-chart__bar-row:nth-child(6) .ui-mini-chart__bar-fill{animation-delay:275ms}.modern-lieflat-chart[data-chart-type="vertical-bar"] .ui-mini-chart__vertical-bars{padding:22px 12px 0;border-bottom:1px solid #7f817b;gap:16px}.modern-lieflat-chart[data-chart-type="vertical-bar"] .ui-mini-chart__column-item{grid-template-rows:30px minmax(0,1fr) 46px}.modern-lieflat-chart[data-chart-type="vertical-bar"] .ui-mini-chart__column-track{width:18px;overflow:visible;border-radius:9px 9px 0 0;background:linear-gradient(#e3e5e1,#e3e5e1) center/1px 100% no-repeat}.modern-lieflat-chart[data-chart-type="vertical-bar"] .ui-mini-chart__column-fill{position:relative;border-radius:9px 9px 0 0;transform-origin:bottom;animation:ofw-lieflat-column-in 560ms cubic-bezier(.2,.8,.2,1) both}.modern-lieflat-chart[data-chart-type="vertical-bar"] .ui-mini-chart__column-fill:before{content:"";width:26px;height:2px;position:absolute;left:50%;top:0;transform:translateX(-50%);background:#1f2724}.modern-lieflat-chart[data-chart-type="stacked-bar"] .ui-mini-chart__stacked-bars{gap:15px}.modern-lieflat-chart[data-chart-type="stacked-bar"] .ui-mini-chart__stacked-row{grid-template-columns:minmax(118px,165px) minmax(0,1fr)}.modern-lieflat-chart[data-chart-type="stacked-bar"] .ui-mini-chart__stacked-track{height:30px;border-radius:1px;background:#eceeea}.modern-lieflat-chart[data-chart-type="stacked-bar"] .ui-mini-chart__stacked-segment{background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.28) 0,rgba(255,255,255,.28) 2px,transparent 2px,transparent 6px);transform-origin:left;animation:ofw-lieflat-segment-in 460ms cubic-bezier(.2,.8,.2,1) both}.modern-lieflat-chart[data-chart-type="metric"] .ui-mini-chart__metric{min-width:min(420px,92%);min-height:190px;border:0;border-top:1px solid #8f918b;border-bottom:1px solid #8f918b;border-radius:0;background:transparent}.modern-lieflat-chart[data-chart-type="metric"] .ui-mini-chart__metric-value{font-size:52px}.modern-lieflat-chart[data-chart-type="donut"] .ui-mini-chart__donut-segment{animation:ofw-lieflat-ring-in 620ms cubic-bezier(.2,.8,.2,1) both}.modern-chart-types button{min-height:42px!important;font-size:11px!important}.modern-chart-types button.is-active{box-shadow:inset 0 -2px currentColor!important}@keyframes ofw-lieflat-bar-in{from{transform:scaleX(0);opacity:.2}to{transform:scaleX(1);opacity:1}}@keyframes ofw-lieflat-column-in{from{transform:scaleY(0);opacity:.2}to{transform:scaleY(1);opacity:1}}@keyframes ofw-lieflat-segment-in{from{transform:scaleX(.04);opacity:.2}to{transform:scaleX(1);opacity:1}}@keyframes ofw-lieflat-ring-in{from{stroke-dashoffset:100;opacity:.15}to{opacity:1}}
        .ofw-query-workspace-actions{display:inline-flex;align-items:center;gap:7px;flex-wrap:wrap}
        .ofw-action-backdrop{position:fixed;inset:0;z-index:10020;display:grid;place-items:center;padding:20px;background:rgba(28,31,29,.48);backdrop-filter:blur(4px)}.ofw-action-modal{width:min(760px,100%);max-height:min(780px,calc(100vh - 40px));display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden;border:1px solid #b9b7ad;border-radius:8px;background:#fbfaf6;box-shadow:0 28px 90px rgba(31,34,31,.28)}.ofw-action-modal>header{min-height:78px;padding:15px 18px;display:flex;align-items:center;justify-content:space-between;gap:14px;color:#fff;background:#253b34}.ofw-action-modal>header span,.ofw-action-modal>header h2{display:block}.ofw-action-modal>header span{color:#bad1c8;font-size:11px}.ofw-action-modal>header h2{margin:3px 0 0;font-size:20px}.ofw-action-modal>header button{width:38px;height:38px;border:1px solid rgba(255,255,255,.28);border-radius:50%;color:#fff;background:transparent;font-size:22px}.ofw-action-modal>main{min-height:0;padding:18px;overflow:auto}.ofw-action-modal>footer{padding:12px 18px;display:flex;justify-content:flex-end;gap:9px;border-top:1px solid #d9d6cc;background:#f2f0e8}.ofw-action-modal .ofw-native-action{min-height:44px;padding-inline:16px;font-size:12px}.ofw-action-modal .ofw-native-action.primary{background:#9a5a16;border-color:#9a5a16}.ofw-action-target{padding:14px 15px;border:1px solid #d5c59d;background:#fff8e8}.ofw-action-target span,.ofw-action-target strong,.ofw-action-target small{display:block}.ofw-action-target span{color:#7d6d49;font-size:10px}.ofw-action-target strong{margin-top:3px;font-size:22px}.ofw-action-target small{margin-top:4px;color:#6a6457;font-size:11px}.ofw-action-bank-list{margin:14px 0;display:grid;gap:7px}.ofw-action-bank-list>header{display:flex;justify-content:space-between;align-items:center}.ofw-action-bank-list>header strong{font-size:14px}.ofw-action-bank-list>header span{color:#77746a;font-size:10px}.ofw-action-bank-list article{min-height:58px;padding:9px 11px;display:grid;grid-template-columns:30px minmax(0,1fr) auto;align-items:center;gap:10px;border:1px solid #ddd9cf;background:#fff}.ofw-action-bank-list article>b{width:28px;height:28px;display:grid;place-items:center;border-radius:50%;color:#fff;background:#365d50}.ofw-action-bank-list article strong,.ofw-action-bank-list article span{display:block}.ofw-action-bank-list article strong{font-size:13px}.ofw-action-bank-list article span{margin-top:2px;color:#77746a;font-size:10px}.ofw-action-bank-list article em{font-size:13px;font-style:normal;font-weight:750}.ofw-action-confirm{margin-top:14px;padding:12px;display:grid;grid-template-columns:20px minmax(0,1fr);gap:10px;border:1px solid #d6c28d;background:#fff8e7;cursor:pointer}.ofw-action-confirm input{width:18px;height:18px;margin:2px 0 0;accent-color:#9a5a16}.ofw-action-confirm strong,.ofw-action-confirm small{display:block}.ofw-action-confirm strong{font-size:12px}.ofw-action-confirm small{margin-top:3px;color:#6f685a;font-size:10px}.ofw-action-success{text-align:center}.ofw-action-success>span{width:54px;height:54px;margin:auto;display:grid;place-items:center;border-radius:50%;color:#fff;background:#21705b;font-size:28px}.ofw-action-success h3{margin:13px 0 0;font-size:21px}.ofw-action-success p{max-width:560px;margin:7px auto 0;color:#5e665f;line-height:1.7}.ofw-action-success code{margin:12px auto 0;padding:7px 9px;display:block;width:max-content;max-width:100%;overflow-wrap:anywhere;color:#365d50;background:#edf5f1}.ofw-action-receipt{margin-top:16px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;border:1px solid #ddd9cf;background:#ddd9cf;text-align:left}.ofw-action-receipt>div{padding:10px;background:#fff}.ofw-action-receipt span,.ofw-action-receipt strong{display:block}.ofw-action-receipt span{color:#77746a;font-size:9px}.ofw-action-receipt strong{margin-top:3px;font-size:11px}
        .ofw-query-action-cta{margin:14px 0;padding:13px 14px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;border:1px solid #d3b264;border-left:5px solid #9a5a16;border-radius:6px;background:#fff8e8;box-shadow:0 9px 24px rgba(118,79,18,.08)}.ofw-query-action-cta>span{padding:4px 7px;color:#7b4c12;background:#f4dfb4;border-radius:3px;font-size:10px;font-weight:800}.ofw-query-action-cta strong,.ofw-query-action-cta small{display:block}.ofw-query-action-cta strong{font-size:14px}.ofw-query-action-cta small{margin-top:3px;color:#74684f;font-size:10px}.ofw-query-action-cta button{min-height:44px;padding:0 16px;border:1px solid #9a5a16;border-radius:5px;color:#fff;background:#9a5a16;font-size:12px;font-weight:750;box-shadow:0 6px 14px rgba(154,90,22,.18)}
        .ofw-sector-comparison{margin:14px 0;border-top:1px solid #d7d5cd;border-bottom:1px solid #d7d5cd}.ofw-sector-comparison>header{min-height:40px;display:flex;align-items:center;justify-content:space-between;gap:10px}.ofw-sector-comparison>header strong{font-size:13px}.ofw-sector-comparison>header span{color:#73746d;font-size:10px}.ofw-sector-comparison>div{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:1px;background:#deddd6}.ofw-sector-comparison article{min-width:0;padding:9px 8px;display:grid;gap:3px;background:#f7f6f1}.ofw-sector-comparison article.group{color:#fff;background:#2e5c50}.ofw-sector-comparison article.above{background:#fff7e8}.ofw-sector-comparison article span,.ofw-sector-comparison article strong,.ofw-sector-comparison article em{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ofw-sector-comparison article span{font-size:9px}.ofw-sector-comparison article strong{font-size:15px}.ofw-sector-comparison article em{color:#75756d;font-size:8px;font-style:normal}.ofw-sector-comparison article.group em{color:#c9ddd6}
        body.ofw-decision-ops-active>#root{display:none!important}#ofw-decision-ops-root{min-height:100vh}.ofw-decision-ops{min-height:100%;padding:18px;display:grid;align-content:start;gap:12px;color:#172536;background:#eef2f6}.ofw-ops-head{min-height:82px;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:14px;border:1px solid #c8d3dc;border-top:4px solid #315fae;background:#fff}.ofw-ops-head span,.ofw-ops-head h1,.ofw-ops-head p{display:block}.ofw-ops-head span{color:#315fae;font-size:10px;font-weight:800}.ofw-ops-head h1{margin:3px 0 0;font-size:23px}.ofw-ops-head p{margin:4px 0 0;color:#68798a;font-size:11px}.ofw-ops-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.ofw-ops-metrics article{min-height:92px;padding:12px;border:1px solid #d2dbe2;background:#fff}.ofw-ops-metrics article.warning{border-color:#dfba7e;background:#fff8ec}.ofw-ops-metrics span,.ofw-ops-metrics strong,.ofw-ops-metrics small{display:block}.ofw-ops-metrics span{color:#68798a;font-size:10px}.ofw-ops-metrics strong{margin-top:5px;font-size:27px;line-height:1}.ofw-ops-metrics small{margin-top:8px;color:#8995a0;font-size:9px}.ofw-ops-flow,.ofw-ops-source,.ofw-ops-attention,.ofw-ops-records{border:1px solid #d2dbe2;background:#fff}.ofw-ops-flow>header,.ofw-ops-source>header,.ofw-ops-attention>header,.ofw-ops-records>header{min-height:54px;padding:10px 13px;display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid #e0e6eb}.ofw-ops-flow h2,.ofw-ops-source h2,.ofw-ops-attention h2,.ofw-ops-records h2{margin:0;font-size:15px}.ofw-ops-flow p,.ofw-ops-records p{margin:2px 0 0;color:#68798a;font-size:10px}.ofw-ops-reset{border:0;color:#315fae;background:transparent;font-weight:700}.ofw-ops-flow>div{padding:14px;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;background:#d8e0e7}.ofw-ops-flow>div button{min-height:76px;padding:9px;display:grid;grid-template-columns:28px minmax(0,1fr) auto;align-items:center;gap:8px;border:0;background:#f7f9fb;text-align:left}.ofw-ops-flow>div button.active{color:#1f4f84;background:#e7f0fb;box-shadow:inset 0 -3px #315fae}.ofw-ops-flow>div i{width:26px;height:26px;display:grid;place-items:center;border-radius:50%;color:#fff;background:#6f8192;font-style:normal;font-size:10px}.ofw-ops-flow>div span{font-size:11px;font-weight:700}.ofw-ops-flow>div strong{font-size:20px}.ofw-ops-grid{display:grid;grid-template-columns:minmax(280px,.72fr) minmax(0,1.28fr);gap:12px}.ofw-ops-source>header span,.ofw-ops-attention>header span,.ofw-ops-records>header>span{color:#68798a;font-size:10px}.ofw-ops-source>div{padding:12px;display:grid;gap:10px}.ofw-ops-source article{display:grid;grid-template-columns:minmax(96px,.65fr) minmax(0,1fr) 24px;align-items:center;gap:9px}.ofw-ops-source article>span{font-size:10px}.ofw-ops-source article>i{height:9px;display:block;background:#edf1f4}.ofw-ops-source article>i>i{height:100%;display:block;background:#416f9f}.ofw-ops-source article>strong{text-align:right}.ofw-ops-attention>div{padding:6px 12px}.ofw-ops-attention button{width:100%;min-height:52px;padding:8px 0;display:grid;grid-template-columns:8px minmax(0,1fr) auto;align-items:center;gap:10px;border:0;border-bottom:1px solid #edf1f4;background:transparent;text-align:left}.ofw-ops-attention button:last-child{border-bottom:0}.ofw-ops-attention button>i{width:8px;height:34px;background:#8092a3}.ofw-ops-attention button>i.review{background:#c8902f}.ofw-ops-attention button>i.blocked{background:#b44842}.ofw-ops-attention strong,.ofw-ops-attention small{display:block}.ofw-ops-attention strong{font-size:11px}.ofw-ops-attention small{margin-top:2px;color:#68798a;font-size:9px}.ofw-ops-attention em{color:#7c5b20;font-style:normal;font-size:10px;font-weight:700}.ofw-ops-table{min-width:0}.ofw-ops-table>.head,.ofw-ops-table>button{width:100%;display:grid;grid-template-columns:minmax(150px,1.15fr) minmax(140px,1fr) 105px 110px minmax(150px,1.1fr) 94px 78px;align-items:center;gap:9px;text-align:left}.ofw-ops-table>.head{min-height:34px;padding:0 12px;color:#68798a;background:#f5f7f9;font-size:9px;font-weight:700}.ofw-ops-table>button{min-height:58px;padding:8px 12px;border:0;border-top:1px solid #edf1f4;background:#fff}.ofw-ops-table>button:hover{background:#f7faff}.ofw-ops-table>button span{min-width:0;font-size:10px}.ofw-ops-table>button span strong,.ofw-ops-table>button span small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ofw-ops-table>button span small{margin-top:2px;color:#8794a0;font-size:8px}.ofw-ops-table .status{width:7px;height:7px;margin-right:5px;display:inline-block;border-radius:50%;background:#8092a3}.ofw-ops-table .status.review{background:#c8902f}.ofw-ops-table .status.executing,.ofw-ops-table .status.assigned{background:#315fae}.ofw-ops-table .status.blocked{background:#b44842}.ofw-ops-table .status.completed{background:#18765f}.ofw-ops-table .overdue{color:#a8413d;font-weight:700}.ofw-ops-empty{min-height:86px;display:grid;place-items:center;color:#7d8994;font-size:11px}.ofw-ops-detail-head{padding:12px;border:1px solid #cbd9e8;background:#f2f6fb}.ofw-ops-detail-head span,.ofw-ops-detail-head h3,.ofw-ops-detail-head p{display:block}.ofw-ops-detail-head span{color:#315fae;font-size:9px;font-weight:750}.ofw-ops-detail-head h3{margin:3px 0 0;font-size:18px}.ofw-ops-detail-head p{margin:4px 0 0;color:#68798a}.ofw-ops-detail-flow{margin:12px 0;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px}.ofw-ops-detail-flow>div{display:grid;justify-items:center;gap:4px;color:#8995a0;text-align:center}.ofw-ops-detail-flow i{width:24px;height:24px;display:grid;place-items:center;border-radius:50%;background:#dfe5ea;font-style:normal}.ofw-ops-detail-flow .done i{color:#fff;background:#18765f}.ofw-ops-detail-flow .current{color:#315fae;font-weight:700}.ofw-ops-detail-flow .current i{color:#fff;background:#315fae}.ofw-ops-detail-flow span{font-size:8px}
        .ofw-native-source-badge{background:#eef4fb!important;color:#315f91!important}.ofw-native-agent-card{border-color:#b9cde1!important}.ofw-native-report-row{border-color:#c5d6e5!important;background:#fbfdff!important}.ofw-native-inline-status{margin-left:6px;color:#237458;font-size:9px;font-weight:700}.ofw-native-guard-list{display:grid;gap:7px}.ofw-native-guard-list article{padding:9px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;border:1px solid #dce3e9;border-radius:5px;background:#f8fafb}.ofw-native-guard-list strong,.ofw-native-guard-list small{display:block}.ofw-native-guard-list small{margin-top:2px;color:#687786;font-size:9px}.ofw-native-agent-control{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;margin-bottom:12px}.ofw-native-agent-control select{min-width:0;min-height:36px;padding:0 9px;border:1px solid #c7d1db;border-radius:5px;background:#fff}.ofw-native-agent-result{padding:11px;border:1px solid #dce3e9;border-radius:5px;background:#f8fafb}.ofw-native-agent-result h3{margin:0 0 6px;font-size:13px}.ofw-native-agent-result p{margin:0;color:#4f6070;font-size:10px;line-height:1.65}
        .ofw-native-section-title{margin:14px 0 7px;display:flex;align-items:center;justify-content:space-between;gap:8px}.ofw-native-section-title strong{font-size:11px}.ofw-native-section-title span{color:#6b7987;font-size:8px}.ofw-native-contract-list{display:grid;gap:6px}.ofw-native-contract-list article{min-width:0;padding:9px;border:1px solid #dce3e9;border-radius:4px;background:#fff}.ofw-native-contract-list article>header{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.ofw-native-contract-list h3{margin:0;font-size:10px}.ofw-native-contract-list article>header span{color:#315fae;font-size:8px;font-weight:800;white-space:nowrap}.ofw-native-contract-list p{margin:4px 0 0;color:#5f6f7e;font-size:9px;line-height:1.5}.ofw-native-contract-list code{display:block;margin-top:5px;color:#657787;font-size:8px;overflow-wrap:anywhere}.ofw-native-lineage{margin-top:8px;padding:9px;display:flex;flex-wrap:wrap;align-items:center;gap:5px;border:1px solid #cbd9e8;background:#f3f7fb}.ofw-native-lineage span{padding:3px 5px;border-radius:3px;color:#405d78;background:#fff;font-size:8px}.ofw-native-lineage i{color:#8294a5;font-style:normal;font-size:8px}
        .portfolio-scene-badge,.ontology-scene-badge{display:none!important}.ofw-native-asset-grid{padding-top:10px}.ofw-native-card-evidence{margin:8px 0 0}.ofw-native-card-evidence summary{color:#315fae;font-size:10px;font-weight:700;cursor:pointer}.ofw-native-card-evidence small{display:block;margin-top:5px;color:#657787;font-size:9px;overflow-wrap:anywhere}.asset-column>.empty-state[hidden]{display:none!important}
        .definition-selector>button{min-width:230px!important}.version-popover [data-action="select-definition"][data-value="draft"]{border-left:3px solid #315fae!important;background:#f2f6fc!important}.version-popover [data-action="select-definition"][data-value="draft"] strong{font-size:12px!important}.run-list{display:grid!important;gap:10px!important}.run-row{grid-template-columns:minmax(220px,1.2fr) auto repeat(3,minmax(148px,.72fr)) minmax(118px,auto)!important;align-items:start!important;gap:10px!important}.run-row>div{min-width:0}.run-row>.notice{grid-column:1/-1!important}.run-actions{grid-column:auto!important;grid-row:auto!important;align-self:center!important;justify-self:end!important}
        .ofw-native-dashboard-tabs{margin-bottom:12px;display:flex;flex-wrap:wrap;gap:6px}.ofw-native-dashboard-tabs button{min-height:34px;padding:0 10px;border:1px solid #c9d4dd;border-radius:4px;background:#fff;color:#43586b;font-weight:700}.ofw-native-dashboard-tabs button.active{border-color:#315fae;background:#315fae;color:#fff}.ofw-native-dashboard-summary{margin-bottom:10px;padding:10px;border:1px solid #dce3e9;background:#f8fafb}.ofw-native-dashboard-summary strong,.ofw-native-dashboard-summary span{display:block}.ofw-native-dashboard-summary span{margin-top:3px;color:#687786;font-size:9px}
        @media(max-width:1080px){.ofw-workspace-context{align-items:stretch;flex-direction:column}.ofw-workspace-facts{grid-template-columns:repeat(4,minmax(0,1fr))}.ofw-workspace-jumps{overflow-x:auto}.ofw-data-lineage>div,.ofw-ontology-overview>div,.ofw-task-result-board>div{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:620px){.ofw-workspace-context{padding:8px 10px}.ofw-workspace-facts{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.ofw-workspace-facts>div,.ofw-workspace-facts>div:first-child{padding:0;border:0}.ofw-workspace-jumps{width:100%;padding-top:7px;border-top:1px solid #d8e1e7}.ofw-workspace-jump{min-height:34px}.ofw-data-lineage,.ofw-ontology-overview,.ofw-task-result-board{margin:9px 10px 0}.ofw-data-lineage>div,.ofw-ontology-overview>div,.ofw-task-result-board>div{grid-template-columns:1fr 1fr}.ofw-data-layer{min-height:64px;grid-template-columns:26px minmax(0,1fr) auto}}
        @media(max-width:900px){.ofw-ops-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.ofw-ops-flow>div{grid-template-columns:repeat(3,minmax(0,1fr))}.ofw-ops-grid{grid-template-columns:1fr}.ofw-ops-table>.head{display:none}.ofw-ops-table>button{grid-template-columns:1fr 1fr}.ofw-ops-table>button>span:first-child{grid-column:1/-1}.ofw-ops-table>button>span:last-child{grid-column:1/-1;color:#315fae}}
        @media(max-width:1180px){.run-row{grid-template-columns:minmax(210px,1fr) auto repeat(2,minmax(145px,.8fr))!important}.run-row>div:nth-child(5){grid-column:3/5}.run-actions{grid-column:4!important}}
        @media(max-width:620px){.ofw-native-facts{grid-template-columns:1fr}.ofw-native-query-row{grid-template-columns:1fr 1fr}.ofw-native-query-row strong{grid-column:1/-1}.ofw-native-agent-control{grid-template-columns:1fr}.ofw-native-action{min-height:42px}.ofw-native-drawer{width:100%}.ofw-query-scenario-tabs{width:100%;max-width:none}.ofw-query-scenario-tabs button{min-height:38px}.ofw-query-action-cta{grid-template-columns:1fr}.ofw-query-action-cta>span{width:max-content}.ofw-query-action-cta button{width:100%}.ofw-sector-comparison>div{grid-template-columns:1fr 1fr}.ofw-sector-comparison article.group{grid-column:1/-1}.run-row{grid-template-columns:1fr!important}.run-row>*{grid-column:1!important}.run-actions{justify-self:stretch!important}.ofw-action-backdrop{padding:0}.ofw-action-modal{height:100%;max-height:none;border:0;border-radius:0}.ofw-action-modal>footer{display:grid;grid-template-columns:1fr 1fr}.ofw-action-bank-list article{grid-template-columns:30px minmax(0,1fr)}.ofw-action-bank-list article em{grid-column:2}.ofw-action-receipt{grid-template-columns:1fr}.ofw-decision-ops{padding:10px 10px 70px}.ofw-ops-head{align-items:flex-start;flex-direction:column}.ofw-ops-head .ofw-native-action{width:100%}.ofw-ops-metrics{grid-template-columns:1fr 1fr}.ofw-ops-flow>div{grid-template-columns:1fr 1fr}.ofw-ops-table>button{grid-template-columns:1fr}.ofw-ops-table>button>*{grid-column:1!important}.ofw-ops-detail-flow{grid-template-columns:repeat(3,minmax(0,1fr))}}
      `;
      doc.head.appendChild(style);
    }

    function closeDrawer({ capture = true } = {}) {
      if (capture) reportEditor.captureFields();
      doc.getElementById("ofw-native-drawer-root")?.remove();
      if (drawerTrigger?.isConnected) drawerTrigger.focus();
    }

    function openDrawer(title, subtitle, body, footer = "") {
      if (!doc.getElementById("ofw-native-drawer-root")) drawerTrigger = doc.activeElement;
      closeDrawer({ capture: false });
      const root = doc.createElement("div");
      root.id = "ofw-native-drawer-root";
      root.innerHTML = `<div class="ofw-native-drawer-backdrop" data-ofw-native-action="close-drawer"><aside class="ofw-native-drawer" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><div><h2>${esc(title)}</h2><p>${esc(subtitle || "")}</p></div><button class="ofw-native-close" type="button" data-ofw-native-action="close-drawer" aria-label="关闭">×</button></header><div class="ofw-native-drawer-body">${body}</div><footer><button class="ofw-native-action" type="button" data-ofw-native-action="close-drawer">关闭</button>${footer}</footer></aside></div>`;
      doc.body.appendChild(root);
      root.querySelector("input,select,textarea,button")?.focus();
      root.addEventListener("keydown", (event) => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeDrawer(); }
        if (event.key === "Tab") {
          const items = [...root.querySelectorAll("button:not(:disabled),input,textarea,select,summary,a[href]")].filter((item) => item.getClientRects().length);
          if (event.shiftKey && doc.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
          if (!event.shiftKey && doc.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
        }
      });
    }

    async function runAction(action, payload = {}, targetScenarioId = scenarioId) {
      if (loading) return;
      loading = true;
      operationError = "";
      try {
        const next = await request(`/v1/model-management/actions/${encodeURIComponent(action)}`, { method: "POST", body: JSON.stringify({ scenarioId: targetScenarioId, payload }) });
        portfolioContexts.set(targetScenarioId, next);
        if (targetScenarioId === scenarioId) {
          context = next;
          onState?.(context.state);
        }
        return next;
      } catch (error) {
        operationError = error.message || "当前操作未完成。";
        return null;
      } finally {
        loading = false;
        render();
      }
    }

    function dataOperation(source = context) {
      const current = state(source);
      if (!current.data) return { id: "build-data", label: "构建数据资产" };
      if (current.data.validationStatus !== "VALID") return { id: "validate-data", label: "运行质量校验" };
      if (!current.data.immutable) return { id: "freeze-data", label: "冻结当前版本" };
      return null;
    }

    function dataAssetsMarkup(data) {
      const assets = data?.dataAssets || [];
      if (!assets.length) return "";
      const lineage = data.lineage?.tracePath || [];
      return `<div class="ofw-native-section-title"><strong>数据成员</strong><span>${assets.length} 个 · ${data.observationCount || 0} 条观察</span></div><div class="ofw-native-contract-list">${assets.map((asset) => `<article><header><div><h3>${esc(asset.name)}</h3><p>${esc(asset.grain)} · ${asset.rowCount} 行 · ${esc(asset.timeField)}</p></div><span>${asset.consumedByModelIds?.length || 0} 个模型</span></header><code>${esc(asset.assetId)} · ${esc((asset.fields || []).join(" / "))}</code></article>`).join("")}</div>${lineage.length ? `<div class="ofw-native-lineage">${lineage.map((item, index) => `${index ? "<i>→</i>" : ""}<span>${esc(item)}</span>`).join("")}</div>` : ""}`;
    }

    function modelBindingsMarkup(contract, source = context) {
      const bindings = contract?.modelBindings || [];
      if (!bindings.length) return "";
      return `<div class="ofw-native-section-title"><strong>模型字段与结果合同</strong><span>${bindings.length} 个模型绑定</span></div><div class="ofw-native-contract-list">${bindings.map((binding) => `<article><header><div><h3>${esc(state(source).modelDefinitions?.find((item) => item.modelId === binding.modelId)?.name || binding.modelId)}</h3><p>${esc((binding.inputProperties || []).join("、"))}</p></div><span>${esc(binding.resultIdentity)}</span></header><code>输出：${esc((binding.outputProperties || []).join(" / "))}<br>${esc(binding.repositorySlug)} · ${esc(binding.timePolicy)}</code></article>`).join("")}</div>`;
    }

    function dataDrawer(targetScenarioId = selectedDataScenarioId) {
      selectedDataScenarioId = PORTFOLIO_SCENARIO_IDS.includes(targetScenarioId) ? targetScenarioId : scenarioId;
      const source = portfolioContext(selectedDataScenarioId);
      const current = state(source);
      const operation = dataOperation(source);
      const data = current.data;
      const steps = [
        ["形成观察样本", Boolean(data), data ? `${data.enterpriseCount || data.subjectCount || 0} 个对象 · ${data.observationCount || 0} 条观察` : "等待构建"],
        ["质量与泄漏校验", data?.validationStatus === "VALID", data?.quality ? `未来信息泄漏 ${data.quality.futureLeakageRows || 0} 行` : "等待数据形成"],
        ["冻结数据版本", Boolean(data?.immutable), data?.dataVersionId || "等待校验通过"]
      ];
      const currentIndex = steps.findIndex((item) => !item[1]);
      const body = `<dl class="ofw-native-facts"><div><dt>业务用途</dt><dd>${esc(businessName(selectedDataScenarioId))}</dd></div><div><dt>当前版本</dt><dd>${esc(data?.dataVersionId || "尚未形成")}</dd></div><div><dt>数据分类</dt><dd>${esc(data?.classification || "脱敏 synthetic 数据")}</dd></div><div><dt>可复算</dt><dd>${data?.recomputable ? "是" : data ? "否" : "形成后校验"}</dd></div><div><dt>观察时点</dt><dd>${esc(data?.observationRange?.end || current.scenario?.dataAsOf || "尚未形成")}</dd></div><div><dt>当前状态</dt><dd>${esc(statusLabel(current.cycle?.status))}</dd></div></dl><div class="ofw-native-steps">${steps.map(([label, done, detail], index) => `<div class="ofw-native-step ${done ? "done" : index === currentIndex ? "current" : ""}"><i>${index + 1}</i><div><strong>${esc(label)}</strong><small>${esc(detail)}</small></div><span>${done ? "已完成" : index === currentIndex ? "当前" : "等待"}</span></div>`).join("")}</div>${dataAssetsMarkup(data)}<div class="ofw-native-note">缺失值、观察期不足和低置信度均保留原因；每次构建、校验和冻结形成独立记录。</div>${operationError ? `<div class="ofw-native-error">${esc(operationError)}</div>` : ""}`;
      const footer = operation ? `<button class="ofw-native-action primary" type="button" data-ofw-native-action="runtime" data-operation="${operation.id}" data-scenario-id="${esc(selectedDataScenarioId)}">${esc(operation.label)}</button>` : `<button class="ofw-native-action primary" type="button" data-ofw-native-route="#module/ontology">查看模型合同</button>`;
      openDrawer(DATA_ASSET_NAMES[selectedDataScenarioId], "数据工程", body, footer);
    }

    function renderData() {
      refreshDataSourcePortfolio();
      doc.querySelectorAll(".portfolio-scene-badge").forEach((item) => item.remove());
      const draftOption = doc.querySelector('.version-popover [data-action="select-definition"][data-value="draft"]');
      if (draftOption?.querySelector("strong") && /新建|编辑草稿/.test(draftOption.querySelector("strong").textContent)) {
        draftOption.querySelector("strong").textContent = "新建草稿（可编辑副本）";
        const note = draftOption.querySelector("span");
        if (note) note.textContent = "从当前已发布定义复制，原版本保持只读";
      }
      const definitionButton = doc.querySelector(".definition-selector > button");
      const readonlyBadge = doc.querySelector(".canvas-mode-banner .badge");
      if (definitionButton && readonlyBadge?.textContent.includes("只读")) definitionButton.title = "选择已发布版本，或新建草稿形成可编辑副本";
      doc.querySelectorAll("[data-ofw-native-model-data]").forEach((item) => item.remove());
      const rows = PORTFOLIO_SCENARIO_IDS.map((targetScenarioId) => {
        const source = portfolioContext(targetScenarioId);
        const current = state(source);
        const data = current.data;
        return {
          targetScenarioId,
          current,
          data,
          name: DATA_ASSET_NAMES[targetScenarioId],
          members: data?.dataAssets?.length || 0,
          models: current.modelDefinitions?.length || 0,
          relations: data?.relationEdgeCount || 0,
          asOf: data?.observationRange?.end || current.scenario?.dataAsOf || "尚未形成",
          quality: data?.validationStatus === "VALID" ? "质量通过" : data ? "待校验" : "待构建"
        };
      });
      const countNode = doc.querySelector(".asset-column .resource-column-head h2 em");
      if (countNode) {
        if (!countNode.dataset.ofwBaseCount) countNode.dataset.ofwBaseCount = String(Number(countNode.textContent.trim()) || 0);
        countNode.textContent = String(Number(countNode.dataset.ofwBaseCount) + rows.length);
      }
      const table = doc.querySelector(".asset-resource-table tbody");
      if (table) {
        rows.forEach((item) => {
          const row = doc.createElement("tr");
          row.dataset.ofwNativeModelData = item.targetScenarioId;
          row.innerHTML = `<td><div class="table-resource-name"><span class="source-icon">DV</span><div><strong>${esc(item.name)}</strong><small>${esc(item.data?.classification || "业务分析数据")}</small></div></div></td><td>${esc(short(item.data?.dataVersionId || "尚未冻结", 32))}</td><td>${item.models} 个模型</td><td>${esc(item.asOf)}</td><td><span class="badge ${item.quality === "质量通过" ? "success" : "neutral"}">${esc(item.quality)}</span></td><td>${item.members}</td><td>${item.relations}</td><td>${esc(String(item.data?.frozenAt || "").replace("T", " ").slice(0, 16) || "—")}</td><td><span class="badge ${item.data?.immutable ? "success" : "neutral"}">${item.data?.immutable ? "版本已冻结" : "准备中"}</span></td><td><div class="table-actions"><button class="text-link" type="button" data-ofw-native-action="data-open" data-scenario-id="${esc(item.targetScenarioId)}">${item.data?.immutable ? "查看详情" : "继续构建"}</button></div></td>`;
          table.appendChild(row);
        });
        snapshotAssets?.render();businessSourceAsset?.render();renderDataLineage(table.querySelectorAll("tr").length);
        return;
      }
      const grid = doc.querySelector(".asset-column .asset-grid");
      let targetGrid = grid;
      if (!targetGrid) {
        const column = doc.querySelector(".asset-column");
        if (!column) return;
        column.querySelector(":scope > .empty-state")?.setAttribute("hidden", "");
        targetGrid = doc.createElement("div");
        targetGrid.className = "asset-grid ofw-native-asset-grid";
        targetGrid.dataset.ofwNativeModelData = "container";
        column.appendChild(targetGrid);
      }
      rows.forEach((item) => {
        const card = doc.createElement("article");
        card.className = "asset-card";
        card.dataset.ofwNativeModelData = item.targetScenarioId;
        card.innerHTML = `<div><span class="eyebrow">分析数据资产</span><h3>${esc(item.name)}</h3><p>${item.members} 个数据成员 · ${item.relations} 条关系 · 观察时点和版本血缘可追溯。</p></div><div class="summary-strip"><div class="fact"><span>当前版本</span><strong>${esc(short(item.data?.dataVersionId || "尚未冻结", 28))}</strong></div><div class="fact"><span>数据截至</span><strong>${esc(item.asOf)}</strong></div><div class="fact"><span>质量</span><strong>${esc(item.quality)}</strong></div><div class="fact"><span>消费模型</span><strong>${item.models} 个</strong></div></div><div class="card-foot"><span class="badge ${item.data?.immutable ? "success" : "neutral"}">${item.data?.immutable ? "版本已冻结" : "准备中"}</span><button class="text-link" type="button" data-ofw-native-action="data-open" data-scenario-id="${esc(item.targetScenarioId)}">${item.data?.immutable ? "查看详情" : "继续构建"}</button></div>`;
        targetGrid.appendChild(card);
      });
      snapshotAssets?.render();businessSourceAsset?.render();renderDataLineage(targetGrid.querySelectorAll(":scope > .asset-card").length);
    }

    function ontologyDrawer(targetScenarioId = selectedOntologyScenarioId) {
      selectedOntologyScenarioId = PORTFOLIO_SCENARIO_IDS.includes(targetScenarioId) ? targetScenarioId : scenarioId;
      const source = portfolioContext(selectedOntologyScenarioId);
      const current = state(source);
      const contract = current.semanticContract;
      const relationCount = contract?.relations?.length || current.data?.relationEdgeCount || 0;
      const modelCount = contract?.modelBindings?.length || current.modelDefinitions?.length || 0;
      const objectTypeNames = (contract?.objectTypes || []).slice(0, 8).map(objectTypeLabel);
      const downstream = ["智能问数", "业务对象探索", ...(modelCount ? ["模型目标"] : []), "报告与驾驶舱"];
      const body = contract
        ? `<dl class="ofw-native-facts"><div><dt>业务用途</dt><dd>${esc(businessName(selectedOntologyScenarioId))}</dd></div><div><dt>合同版本</dt><dd>${esc(contract.semanticContractVersionId)}</dd></div><div><dt>对象类型</dt><dd>${contract.objectTypes?.length || 0} 类</dd></div><div><dt>关系</dt><dd>${relationCount} ${contract?.relations?.length ? "项定义" : "条关系边"}</dd></div><div><dt>指标</dt><dd>${contract.metrics?.length || 0} 项</dd></div><div><dt>数据版本</dt><dd>${esc(current.data?.dataVersionId || "尚未绑定")}</dd></div></dl><div class="ofw-native-section-title"><strong>对象与下游使用</strong><span>业务字段优先</span></div><div class="ofw-native-lineage">${objectTypeNames.map((item) => `<span>${esc(item)}</span><i>→</i>`).join("")}<span>${esc(downstream.join(" · "))}</span></div>${modelBindingsMarkup(contract, source)}<div class="ofw-native-note">结果身份：${esc((contract.resultIdentities || []).map((item) => item.resultKind).join(" / "))}</div>`
        : `<div class="ofw-native-note">${current.data?.immutable ? "数据版本已冻结，可以形成对象、指标、单位、时间粒度、空值策略和结果身份合同。" : "请先在数据工程完成对应数据资产的构建、质量校验和版本冻结。"}</div>${operationError ? `<div class="ofw-native-error">${esc(operationError)}</div>` : ""}`;
      const ready = current.data?.immutable && !contract;
      const footer = ready ? `<button class="ofw-native-action primary" type="button" data-ofw-native-action="runtime" data-operation="create-contract" data-scenario-id="${esc(selectedOntologyScenarioId)}">形成模型合同</button>` : contract ? `<button class="ofw-native-action primary" type="button" data-ofw-native-route="#module/modeling">进入模型目标与优化</button>` : `<button class="ofw-native-action primary" type="button" data-ofw-native-route="#module/data">前往数据工程</button>`;
      openDrawer(SEMANTIC_CONTRACT_NAMES[selectedOntologyScenarioId], "本体管理", body, footer);
    }

    function scrubPublishedOntologyLabels() {
      doc.querySelectorAll(".portfolio-scene-badge,.ontology-scene-badge").forEach((item) => item.remove());
      doc.querySelectorAll(".published-ontology-card span").forEach((item) => {
        if (/^S00[1-5]$/.test(item.textContent.trim())) item.remove();
      });
      doc.querySelectorAll("span,dt").forEach((label) => {
        if (label.textContent.trim() !== "适用场景") return;
        label.textContent = "适用业务";
        const value = label.nextElementSibling;
        if (value) value.textContent = value.textContent.replace(/S00[1-5]\s*[·｜|]?\s*/g, "").trim();
      });
      doc.querySelectorAll(".published-ontology-card:not([data-ofw-native-model-contract])").forEach((card) => {
        const title = card.querySelector(".ontology-card-open") || card.querySelector("h2");
        if (!title) return;
        const raw = title.textContent.trim();
        const stripped = raw.replace(/^S00[1-5]\s*[·｜|]?\s*/, "");
        const alias = ONTOLOGY_DISPLAY_ALIASES[raw] || ONTOLOGY_DISPLAY_ALIASES[stripped];
        title.textContent = alias?.[0] || stripped;
        const identity = card.querySelector("small.mono");
        if (identity && alias?.[1]) identity.textContent = alias[1];
        const versionAlias = ONTOLOGY_VERSION_ALIASES[title.textContent.trim()];
        if (versionAlias) card.querySelectorAll("dl > div").forEach((row) => {
          const label = row.querySelector("dt")?.textContent.trim();
          if (["最新发布版本", "当前正式版本"].includes(label)) row.querySelector("dd").textContent = versionAlias;
        });
      });
    }

    function renderOntology() {
      ontologyRules?.render();
      doc.querySelectorAll("[data-ofw-native-model-contract]").forEach((item) => item.remove());
      scrubPublishedOntologyLabels();
      renderOntologyOverview();
      const grid = doc.querySelector(".published-ontology-grid");
      if (!grid) return;
      const intro = doc.querySelector(".workspace-intro");
      const countNode = intro?.querySelector(":scope > span");
      if (intro?.querySelector("h2")) intro.querySelector("h2").textContent = "语义资产";
      if (intro?.querySelector("p")) intro.querySelector("p").textContent = "查看已发布本体和模型合同，并下钻到版本、映射、消费与证据。";
      if (countNode) {
        if (!countNode.dataset.ofwBaseCount) countNode.dataset.ofwBaseCount = String(Number(countNode.textContent.match(/\d+/)?.[0]) || 0);
        countNode.textContent = `${Number(countNode.dataset.ofwBaseCount) + PORTFOLIO_SCENARIO_IDS.length} 项资产`;
      }
      PORTFOLIO_SCENARIO_IDS.forEach((targetScenarioId) => {
        const source = portfolioContext(targetScenarioId);
        const current = state(source);
        const contract = current.semanticContract;
        const modelCount = contract?.modelBindings?.length || current.modelDefinitions?.length || 0;
        const relationCount = contract?.relations?.length || current.data?.relationEdgeCount || 0;
        const downstreamCount = modelCount + (contract?.resultIdentities?.length || 0);
        const identities = (contract?.resultIdentities || []).map((item) => item.resultKind);
        const ready = Boolean(contract);
        const card = doc.createElement("article");
        card.className = "published-ontology-card";
        card.dataset.ofwNativeModelContract = targetScenarioId;
        card.innerHTML = `<header><span class="ontology-mark">OT</span><div><span class="status blue"><i></i>业务语义</span><span class="status ${ready ? "green" : "amber"}"><i></i>${ready ? "当前有效" : current.data?.immutable ? "可形成" : "等待数据"}</span></div></header><h2>${esc(SEMANTIC_CONTRACT_NAMES[targetScenarioId])}</h2><p>${esc((contract?.objectTypes || []).slice(0, 4).map(objectTypeLabel).join("、") || businessName(targetScenarioId))}等对象通过关系、指标和结果身份连接下游应用。</p><details class="ofw-native-card-evidence"><summary>查看技术身份</summary><small class="mono">${esc(contract?.semanticContractVersionId || "尚未形成版本")}</small></details><dl><div><dt>对象类型</dt><dd>${contract?.objectTypes?.length || 0} 类</dd></div><div><dt>关系</dt><dd>${relationCount}</dd></div><div><dt>指标</dt><dd>${contract?.metrics?.length || 0} 项</dd></div><div><dt>下游使用</dt><dd>${downstreamCount || identities.length || 0} 项</dd></div></dl><footer><button type="button" class="btn ${ready ? "" : "primary"}" data-ofw-native-action="ontology-open" data-scenario-id="${esc(targetScenarioId)}">${ready ? "查看对象与使用" : current.data?.immutable ? "形成合同" : "查看前置条件"}</button></footer>`;
        grid.appendChild(card);
      });
    }

    function candidateEnvelope(kind = "candidate", currentState = state()) {
      const results = currentState?.results || {};
      if (kind === "simulation") return results.simulationEnvelope || null;
      if (kind === "shadow") return results.shadowEnvelope || null;
      return results.candidateEnvelope || null;
    }

    function normalizedSubjects(envelope = candidateEnvelope(), currentState = state()) {
      const formalById = new Map((currentState?.formalBaseline?.resultEnvelope?.subjects || []).map((item) => [item.enterpriseId || item.subjectId, item]));
      return (envelope?.subjects || []).map((item) => {
        const id = W.subjectId(item);
        const formal = item.formal || formalById.get(item.enterpriseId || item.subjectId) || null;
        const candidate = item.candidate || null;
        const score = candidate?.score ?? item.score ?? null;
        const formalScore = formal?.score ?? null;
        return {
          id,
          name: W.enterpriseFor(id)?.name || item.name || item.subjectName || item.objectRef?.title || id,
          sourceSubjectId: item.enterpriseId || item.subjectId || item.objectRef?.id || id,
          sourceName: item.name || item.subjectName || item.objectRef?.title || id,
          score,
          formalScore,
          delta: candidate?.delta ?? (score != null && formalScore != null ? Number(score) - Number(formalScore) : null),
          tier: candidate?.tier || item.tier || statusLabel(item.resultStatus) || "已评价",
          probability90d: item.horizons?.probability90d ?? item.probability90d ?? null,
          liquidityGap: item.liquidity?.gap90dMillions ?? item.liquidityGap90d ?? null,
          relationScore: item.relation?.score ?? item.relationRiskScore ?? null,
          anomalyScore: item.anomaly?.score ?? item.anomalyScore ?? null,
          confidence: item.confidence?.status || item.confidence || (item.resultStatus === "NOT_EVALUATED" ? "UNAVAILABLE" : item.resultStatus === "PARTIAL" ? "LOW" : "HIGH"),
          confidenceScore: item.confidence?.score ?? (typeof item.confidence === "number" ? item.confidence : null),
          missingReasons: item.confidence?.missingReasons || item.missingReasons || [],
          eventType: item.mostLikelyEventType?.type || item.mostLikelyEventType || "未提供",
          riskWindow: item.expectedRiskWindow || "未提供",
          evidenceRefs: [...new Set([...(item.evidenceRefs || []), item.formalResultId, ...(item.topContributors || []).map((entry) => entry.evidenceRef)].filter(Boolean))]
        };
      });
    }

    function questionSpec(text, targetScenarioId = scenarioId) {
      const available = questions(targetScenarioId);
      const exact = available.find((item) => item.question === String(text || "").trim());
      if (exact) return exact;
      const value = String(text || "");
      if (/未来\s*90\s*天/.test(value)) return available.find((item) => item.type === "probability") || null;
      if (/流动性缺口/.test(value)) return available.find((item) => item.type === "liquidity") || null;
      if (/关系传染/.test(value)) return available.find((item) => item.type === "contagion") || null;
      if (/模型分歧|正式结果与候选|正式模型与候选/.test(value)) return available.find((item) => item.type === "difference") || null;
      if (/置信度不足|数据不足|无法完整评价/.test(value)) return available.find((item) => ["confidence", "missing"].includes(item.type)) || null;
      if (/压力模拟/.test(value)) return available.find((item) => item.type === "simulation") || null;
      if (/候选模型.*到哪一步|模型.*评测到哪一步|模型优化到哪一步/.test(value)) return available.find((item) => item.type === "status") || null;
      if (/候选评价|超支风险|人工复核/.test(value)) return available.find((item) => item.type === "ranking") || null;
      return null;
    }

    function queryRows(spec, runtimeContext = context, targetScenarioId = scenarioId, scopeContext = workspaceContext) {
      const current = state(runtimeContext);
      if (targetScenarioId === "S005" && targetScenarioId === scenarioId) {
        if (spec.type === "status") return [
          { name: "当前评价阶段", primary: scenarioProjection?.stage?.title || "等待运行", secondary: scenarioProjection?.stage?.status || "pending", tertiary: scenarioProjection?.evaluationRun?.evaluationRunId || "尚未建立" },
          { name: "评价结果", primary: scenarioProjection?.evaluationResult?.evaluationStatus || "尚未形成", secondary: scenarioProjection?.evaluationResult?.scoredCoverage == null ? "覆盖率未形成" : `覆盖率 ${fmt(scenarioProjection.evaluationResult.scoredCoverage * 100)}%`, tertiary: scenarioProjection?.evaluationResult?.evaluationResultId || "尚未形成" }
        ];
        if (spec.type === "ranking") {
          const output = scenarioOutput("compliance_evaluation");
          if (!output) return [];
          return [
            { name: "符合持续准入", primary: "3 只", secondary: "已列示产品", tertiary: "只读评价", evidence: output.evidenceRefs },
            { name: "需要人工复核", primary: "1 只", secondary: "分类证据部分可用", tertiary: "不得自动处置", evidence: output.evidenceRefs },
            { name: "无法判断", primary: "1 只", secondary: "Wind fund_type 缺失", tertiary: "保留缺失原因", evidence: output.evidenceRefs }
          ];
        }
        if (spec.type === "simulation") {
          const output = scenarioOutput("market_peer_evaluation");
          if (!output) return [];
          return [{ name: "市场横向比较", primary: "无法完整评价", secondary: "月度归一化序列", tertiary: output.missingReasons?.[0] || "缺少产品实际 NAV", evidence: output.evidenceRefs }];
        }
      }
      if (spec.type === "status") {
        return [
          { name: "当前阶段", primary: statusLabel(current.cycle?.status), secondary: `${current.benchmarks?.length || 0} 次评测`, tertiary: `${current.modelRuns?.length || 0} 个运行` },
          { name: "候选版本", primary: current.candidates?.at(-1)?.modelVersionId || "尚未形成", secondary: current.insightReview?.decision === "APPROVED" ? "人工审查已批准" : "尚未通过人工审查", tertiary: current.shadowTrial?.status || "未进入影子试运行" }
        ];
      }
      const envelope = W.envelopeFor(current, spec.resultMode || workspaceResultMode().id);
      const all = W.scopeRows(normalizedSubjects(envelope, current), scopeContext);
      if (spec.type === "probability") return all.filter((item) => item.probability90d != null).sort((a, b) => b.probability90d - a.probability90d).slice(0, 8).map((item) => ({ name: item.name, primary: `${fmt(item.probability90d * 100)}%`, secondary: item.eventType, tertiary: item.riskWindow, evidence: item.evidenceRefs }));
      if (spec.type === "liquidity") return all.filter((item) => item.liquidityGap != null).sort((a, b) => b.liquidityGap - a.liquidityGap).slice(0, 8).map((item) => ({ name: item.name, primary: `${fmt(item.liquidityGap)} 百万元`, secondary: `90天 ${item.probability90d == null ? "无法评价" : `${fmt(item.probability90d * 100)}%`}`, tertiary: confidenceText(item), evidence: item.evidenceRefs }));
      if (spec.type === "contagion") return all.filter((item) => item.relationScore != null).sort((a, b) => b.relationScore - a.relationScore).slice(0, 8).map((item) => ({ name: item.name, primary: fmt(item.relationScore), secondary: `异常 ${fmt(item.anomalyScore)}`, tertiary: confidenceText(item), evidence: item.evidenceRefs }));
      if (spec.type === "difference") return all.filter((item) => item.delta != null).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 8).map((item) => ({ name: item.name, primary: `${Number(item.delta) >= 0 ? "+" : ""}${fmt(item.delta, 2)}`, secondary: `正式 ${fmt(item.formalScore, 2)}`, tertiary: `候选 ${fmt(item.score, 2)}`, evidence: item.evidenceRefs }));
      if (["confidence", "missing"].includes(spec.type)) return all.filter((item) => item.missingReasons.length || item.confidenceScore != null && item.confidenceScore < 0.8 || ["LOW", "VERY_LOW"].includes(item.confidence)).slice(0, 8).map((item) => ({ name: item.name, primary: confidenceText(item), secondary: item.missingReasons.length ? "部分评价" : "低置信度", tertiary: item.missingReasons.join("；") || "建议人工复核", evidence: item.evidenceRefs }));
      return all.sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, 8).map((item) => ({ name: item.name, primary: item.score == null ? "无法评价" : fmt(item.score, 1), secondary: item.tier, tertiary: confidenceText(item), evidence: item.evidenceRefs }));
    }

    function buildQueryAnswer(spec, question, runtimeContext = context, targetScenarioId = scenarioId, scopeContext = workspaceContext) {
      const current = state(runtimeContext);
      const source = W.envelopeFor(current, spec.resultMode);
      if (source?.resultKind === "DEMO_BASELINE") spec = { ...spec, resultMode: "demo" };
      const issue = W.contextIssue(current, scopeContext);
      if (issue) return { question, spec, queryScenarioId: targetScenarioId, runtimeContext, ready: false, title: "范围错误", summary: issue, rows: [], kpis: [] };
      const subjects = normalizedSubjects(W.envelopeFor(current, spec.resultMode || workspaceResultMode().id), current);
      const subjectByName = new Map(subjects.map((item) => [item.name, item]));
      const rows = queryRows(spec, runtimeContext, targetScenarioId, scopeContext).map((item) => {
        const subject = item.id ? null : subjectByName.get(item.name);
        return { ...item, id: item.id || subject?.id || "", objectType: item.objectType || runtimeContext?.ui?.subjectLabel || "业务对象" };
      });
      const s005Ready = targetScenarioId === "S005" && targetScenarioId === scenarioId && (spec.type === "status" || rows.length > 0);
      const requiredEnvelope = s005Ready || spec.type === "status" ? true : Boolean(W.envelopeFor(current, spec.resultMode || workspaceResultMode().id));
      if (!requiredEnvelope) return { question, spec, queryScenarioId: targetScenarioId, runtimeContext, ready: false, title: "当前结果尚未形成", summary: "请先在模型目标与优化完成该场景的评测或压力模拟；智能问数不会用静态结果代替运行结果。", rows: [], kpis: [] };
      if (!rows.length) return { question, spec, queryScenarioId: targetScenarioId, runtimeContext, ready: false, title: "无命中结果", summary: "该固定范围没有符合问题条件的结果，不代表没有风险。可查看模型运行状态或调整范围后重试。", rows: [], kpis: [] };
      if (spec.type !== "status" && source?.resultKind === "DEMO_BASELINE") return { question, spec, queryScenarioId: targetScenarioId, runtimeContext, ready: false, title: "暂无实际评价数据", summary: "当前只有演示基准，没有实际评分。请先完成相应模型评测；候选演示评分不能当作正式业务事实。", rows, kpis: [{label:"结果身份",value:"演示基准 · 无正式评分"}] };
      const titles = { status: "模型运行进度", probability: "未来90天风险关注", liquidity: "未来90天流动性缺口", contagion: "关系传染风险", difference: "正式与候选结果差异", confidence: "低置信度与缺失结果", missing: "数据不足结果", ranking: "候选评价排序", simulation: "压力模拟结果" };
      const summary = spec.type === "status"
        ? targetScenarioId === "S005" && targetScenarioId === scenarioId ? `当前投后评价运行处于“${scenarioProjection?.stage?.title || "等待运行"}”，所有模块输出绑定同一评价轮次。` : `${runtimeContext?.ui?.businessName || targetScenarioId}当前处于“${statusLabel(current.cycle?.status)}”，已有 ${current.modelRuns?.length || 0} 个模型运行和 ${current.benchmarks?.length || 0} 个评测记录。`
        : `${source?.dataOrigin === "SYNTHETIC" ? "合成演示数据，不代表正式业务评价。" : ""}${scopeContext.scopeNote || ""}本次回答读取当前分析范围内 ${rows.length} 条${W.modes[spec.resultMode || workspaceResultMode().id]}。当前结果为固定时点快照，未按观察区间重新计算。`;
      const kpis = [
        { label: "结果条数", value: `${rows.length} 条` },
        { label: "当前阶段", value: statusLabel(current.cycle?.status) },
        { label: "结果身份", value: spec.type === "status" ? "运行状态" : W.modes[spec.resultMode || workspaceResultMode().id] }
      ];
      return { question, spec, queryScenarioId: targetScenarioId, runtimeContext, ready: true, title: titles[spec.type] || "模型结果", summary, rows, kpis };
    }

    function queryWorkspacePatch(answer = queryAnswer) {
      if (!answer) return null;
      const current = state(answer.runtimeContext);
      const objectRows = answer.rows.filter((item) => item.id);
      const first = objectRows[0] || null;
      const resultModeId = answer.spec.resultMode || "formal";
      const asOf = current.data?.observationRange?.end || current.scenario?.dataAsOf || scenarioContext.formedAt?.slice?.(0, 10) || "";
      return {
        scenarioId: answer.queryScenarioId,
        objectSet: {
          selectionMode: "EXPLICIT",
          id: `query:${answer.queryScenarioId}:${answer.spec.type}`,
          label: answer.title,
          count: answer.rows.length,
          objectIds: objectRows.map((item) => item.id)
        },
        object: first ? { id: first.id, label: first.name, type: first.objectType || "业务对象" } : { id: "", label: "未聚焦单个对象", type: "" },
        timeRange: clone(workspaceContext.timeRange) || { start: "", end: asOf, label: asOf ? `截至 ${asOf}` : "当前周期" },
        resultMode: { id: resultModeId, label: RESULT_MODE_LABELS[resultModeId] || "当前结果" },
        source: { moduleId: "query", question: answer.question, queryType: answer.spec.type }
      };
    }

    const QUERY_STEPS = Object.freeze(["正在确认问题范围", "正在读取权威数据", "正在整理业务结果", "正在核对回答依据", "正在生成回答"]);
    const QUERY_STEP_WAIT = 680;

    function clearQueryTimers() {
      queryTimers.forEach((entry) => {
        global.clearTimeout(entry.handle);
        entry.resolve(false);
      });
      queryTimers = [];
    }

    function waitForQueryStep(epoch) {
      return new Promise((resolve) => {
        const entry = { handle: null, resolve };
        entry.handle = global.setTimeout(() => {
          queryTimers = queryTimers.filter((item) => item !== entry);
          resolve(epoch === queryEpoch);
        }, QUERY_STEP_WAIT);
        queryTimers.push(entry);
      });
    }

    function queryThinkingMarkup(question, step = 0) {
      const currentStep = Math.max(0, Math.min(step, QUERY_STEPS.length - 1));
      return `<div id="ofw-native-query-thinking" class="ofw-native-query-answer ofw-native-query-running"><header class="modern-conversation-bar"><div><button type="button" data-ofw-native-action="query-new">会话</button><span>${esc(question)}</span></div><div><button type="button" class="ui-button ui-button--secondary ui-button--md" data-ofw-native-action="query-new"><span class="ui-button__label">新会话</span></button></div></header><section class="modern-conversation" data-screen-label="问数处理中"><div class="modern-user-message"><span>${esc(question)}</span></div><article class="modern-thinking" data-query-step="${currentStep}"><header><span class="modern-thinking-orb"><i></i><i></i><i></i></span><div><strong>${esc(QUERY_STEPS[currentStep])}</strong><small>系统正在固定本轮范围和数据，不会混入候选结果。</small></div><em>${currentStep + 1}/${QUERY_STEPS.length}</em></header><div class="modern-thinking-track"><span style="width:${Math.max(12, (currentStep + 1) / QUERY_STEPS.length * 100)}%"></span></div><div class="modern-thinking-lines"><span class="ui-skeleton" style="height:16px;width:68%"></span><span class="ui-skeleton" style="height:12px;width:92%"></span><span class="ui-skeleton" style="height:12px;width:76%"></span></div><footer>${QUERY_STEPS.map((item, index) => `<span class="${index < currentStep ? "is-done" : index === currentStep ? "is-active" : ""}">${index < currentStep ? `<i data-lucide="check"></i>` : index + 1}</span>`).join("")}</footer></article></section></div>`;
    }

    function showQueryThinking(question, step = 0) {
      const page = doc.querySelector(".modern-query-page");
      const start = page?.querySelector(".modern-start");
      if (!page || !start) return;
      start.hidden = true;
      page.querySelector("#ofw-native-query-answer")?.remove();
      page.querySelector("#ofw-native-query-thinking")?.remove();
      page.insertAdjacentHTML("beforeend", queryThinkingMarkup(question, step));
      win.lucide?.createIcons?.({ root: page.querySelector("#ofw-native-query-thinking"), attrs: { "stroke-width": 2 } });
      const restoreTop = () => {
        doc.scrollingElement?.scrollTo?.(0, 0);
        const scroller = doc.querySelector(".main,.app-workspace,.modern-query-page");
        if (scroller) scroller.scrollTop = 0;
        doc.getElementById("ofw-native-query-thinking")?.scrollIntoView?.({ block: "start" });
      };
      global.requestAnimationFrame(restoreTop);
    }

    async function executeQuestion(question, targetScenarioId = scenarioId) {
      const baseSpec = questionSpec(question, targetScenarioId);
      if (!baseSpec) return;
      const spec = { ...baseSpec, resultMode: baseSpec.type === "simulation" ? "simulation" : baseSpec.type === "difference" ? "difference" : /候选/.test(question) || ["probability", "liquidity", "contagion"].includes(baseSpec.type) ? "candidate" : workspaceResultMode().id };
      const sourceContext = clone(resolvedWorkspaceContext());
      const changedDomain = (sourceContext.scenarioId || scenarioId) !== targetScenarioId;
      const queryContext = { ...(changedDomain ? { analysisScope: "all", sourceModuleId: "query", scopeNote: "已按新问题切换业务域，原域对象和版本未用于本次查询。" } : sourceContext), scenarioId: targetScenarioId, resultView: spec.resultMode, resultMode: { id: spec.resultMode, label: W.modes[spec.resultMode] } };
      cancelQueryRecord("开始新问题后，上一查询已取消。");
      pendingQueryRun = { question, spec, queryScenarioId: targetScenarioId, workspaceContext: queryContext };
      clearQueryTimers();
      const epoch = ++queryEpoch;
      queryRunning = true;
      queryAnswer = null;
      showQueryThinking(question, 0);
      const answerPromise = (async () => {
        if (targetScenarioId === "S005" && targetScenarioId === scenarioId) {
          if (["ranking", "simulation"].includes(spec.type) && scenarioAction("compliance_evaluation")?.enabled) await runScenario("compliance_evaluation");
          if (spec.type === "simulation" && scenarioAction("market_peer_evaluation")?.enabled) await runScenario("market_peer_evaluation");
        }
        const runtimeContext = targetScenarioId === scenarioId ? context : await request(`/v1/model-management/context?scenarioId=${encodeURIComponent(targetScenarioId)}`);
        return { ...buildQueryAnswer(spec, question, runtimeContext, targetScenarioId, queryContext), workspaceContext: queryContext };
      })().catch((caught) => ({ question, spec, queryScenarioId: targetScenarioId, runtimeContext: null, ready: false, title: "本次查询未完成", summary: caught.message || "运行服务暂不可用，请重新读取后重试。", rows: [], kpis: [] }));
      for (let step = 1; step < QUERY_STEPS.length; step += 1) {
        if (!await waitForQueryStep(epoch)) return;
        showQueryThinking(question, step);
      }
      if (!await waitForQueryStep(epoch)) return;
      const answer = await answerPromise;
      if (epoch !== queryEpoch) return;
      queryRunning = false;
      pendingQueryRun = null;
      clearQueryTimers();
      showQueryAnswer(answer);
    }

    function queryAnswerMarkup(answer) {
      const current = state(answer.runtimeContext);
      const resultPackageId = current.results?.resultPackage?.resultPackageId || "尚未形成结果包";
      const modelVersion = W.envelopeFor(current, answer.spec.resultMode)?.modelVersionId || "未提供模型版本";
      const rowMarkup = answer.rows.map((item) => `<div class="ofw-native-query-row"><strong>${esc(item.name)}</strong><span>${esc(item.primary)}</span><span>${esc(item.secondary)}</span><span>${esc(item.tertiary)}</span>${item.id ? `<button type="button" class="ofw-query-focus" data-ofw-native-action="query-focus-object" data-object-id="${esc(item.id)}" data-object-label="${esc(item.name)}" data-object-type="${esc(item.objectType || "业务对象")}">聚焦</button>` : ""}</div>`).join("");
      return `<div id="ofw-native-query-answer" class="ofw-native-query-answer"><header class="modern-conversation-bar"><div><button type="button" data-ofw-native-action="query-new">会话</button><span>${esc(answer.question)}</span></div><div><button type="button" class="ui-button ui-button--secondary ui-button--md" data-ofw-native-action="query-new"><span class="ui-button__label">新会话</span></button></div></header><section class="modern-conversation" data-screen-label="问数回答"><div class="modern-user-message"><span>${esc(answer.question)}</span></div><article class="modern-answer-card"><header><div><span class="modern-answer-mark">问</span><div><small>回答</small><h2>${esc(answer.title)}</h2></div></div><span class="ui-badge ${answer.ready ? "ui-badge--success" : "ui-badge--warning"}"><span>${answer.ready ? "成功" : "尚未形成"}</span></span></header><p class="modern-answer-summary">${esc(answer.summary)}</p>${answer.kpis.length ? `<div class="modern-kpi-grid count-3">${answer.kpis.map((item) => `<button type="button" data-ofw-native-action="query-detail" aria-label="查看${esc(item.label)}依据"><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong></button>`).join("")}</div>` : ""}${rowMarkup ? `<div class="ofw-native-query-table">${rowMarkup}</div>` : ""}<div class="modern-answer-meta"><span>${esc(answer.runtimeContext?.ui?.businessName || answer.queryScenarioId)}</span><span>${esc(short(current.data?.dataVersionId || current.formalBaseline?.dataVersionId))}</span><span>${answer.rows.length} 条结果</span></div><div class="modern-answer-actions"><button type="button" class="ui-button ui-button--secondary ui-button--md" data-ofw-native-action="query-export" ${answer.ready ? "" : "disabled"}><i data-lucide="download" aria-hidden="true"></i><span class="ui-button__label">导出 CSV</span></button>${answer.ready ? `<button type="button" class="ui-button ui-button--primary ui-button--md" data-ofw-native-action="query-detail"><span class="ui-button__label">查看回答详情</span></button><button type="button" class="ui-button ui-button--secondary ui-button--md" data-ofw-native-route="#module/m07" data-context-source="query-answer"><span class="ui-button__label">带入探索</span></button><button type="button" class="ui-button ui-button--secondary ui-button--md" data-ofw-native-route="#module/report" data-context-source="query-answer"><span class="ui-button__label">加入报告</span></button>` : ""}<button type="button" class="ui-button ui-button--secondary ui-button--md" data-ofw-native-route="#module/modeling" data-context-source="query-answer"><span class="ui-button__label">模型目标</span></button></div><div class="ofw-native-query-evidence">${esc(resultPackageId)} · ${esc(modelVersion)}</div></article><form class="modern-follow-composer"><input placeholder="继续追问当前模型结果" aria-label="继续追问" value=""><button type="submit" disabled aria-label="发送追问">发送</button></form><div class="modern-follow-suggestions">${questions(answer.queryScenarioId).filter((item) => item.question !== answer.question).slice(0, 3).map((item) => `<button type="button" data-ofw-model-question="${esc(item.question)}" data-ofw-question-scenario="${esc(answer.queryScenarioId)}">${esc(item.question)}</button>`).join("")}</div></section></div>`;
    }

    function showQueryAnswer(answer) {
      queryAnswer = answer;
      queryRunning = false;
      queryStorageError = "";
      if (answer.question) {
        try { W.saveQueryAnswer(answer, answer.workspaceContext || resolvedWorkspaceContext()); }
        catch (_) { queryStorageError = "本机会话存储不足，当前结果仍可导出。"; }
      }
      // Answering is read-only; selection changes only through an explicit follow-up action.
      const page = doc.querySelector(".modern-query-page");
      const start = page?.querySelector(".modern-start");
      if (!page || !start) return;
      start.hidden = true;
      page.querySelector("#ofw-native-query-thinking")?.remove();
      page.querySelector("#ofw-native-query-answer")?.remove();
      page.insertAdjacentHTML("beforeend", queryAnswerMarkup(answer));
      win.lucide?.createIcons?.({ root: page.querySelector("#ofw-native-query-answer") });
      if (queryStorageError) {
        const notice = doc.createElement("p"); notice.className = "ofw-native-error"; notice.textContent = queryStorageError;
        page.querySelector(".modern-answer-actions")?.after(notice);
      }
      const restoreTop = () => {
        doc.scrollingElement?.scrollTo?.(0, 0);
        const scroller = doc.querySelector(".main,.app-workspace,.modern-query-page");
        if (scroller) scroller.scrollTop = 0;
        doc.getElementById("ofw-native-query-answer")?.scrollIntoView?.({ block: "start" });
      };
      global.requestAnimationFrame(restoreTop);
      global.setTimeout(restoreTop, 180);
    }

    function cancelQueryRecord(reason) {
      if (!pendingQueryRun) return;
      try { W.saveQueryAnswer({ ...pendingQueryRun, ready: false, cancelled: true, title: "查询已取消", summary: reason, rows: [], kpis: [], runtimeContext: null }, pendingQueryRun.workspaceContext); }
      catch (_) { queryStorageError = "取消状态未能保存到本机。"; }
      pendingQueryRun = null;
    }

    function resetQuery() {
      cancelQueryRecord("用户已取消本次查询，未形成结果。");
      queryEpoch += 1;
      queryRunning = false;
      clearQueryTimers();
      doc.getElementById("ofw-native-query-thinking")?.remove();
      doc.getElementById("ofw-native-query-answer")?.remove();
      const start = doc.querySelector(".modern-start");
      if (start) start.hidden = false;
      queryAnswer = null;
      doc.scrollingElement?.scrollTo?.(0, 0);
      const scroller = doc.querySelector(".main,.app-workspace,.modern-query-page");
      if (scroller) scroller.scrollTop = 0;
      global.setTimeout(() => doc.querySelector(".modern-composer textarea")?.focus(), 0);
    }

    function queryDetailDrawer() {
      if (!queryAnswer) return;
      const snapshot = state(queryAnswer.runtimeContext);
      const envelope = W.envelopeFor(snapshot, queryAnswer.spec.resultMode);
      const identity = `<dl class="ofw-native-facts"><div><dt>结果身份</dt><dd>${esc(W.modes[W.normalizeMode(queryAnswer.spec.resultMode)])}</dd></div><div><dt>数据截至</dt><dd>${esc(envelope?.asOf || snapshot.scenario?.dataAsOf || "未提供")}</dd></div><div><dt>模型版本</dt><dd>${esc(envelope?.modelVersionId || "不适用")}</dd></div><div><dt>数据版本</dt><dd>${esc(envelope?.dataVersionId || snapshot.data?.dataVersionId || "未提供")}</dd></div></dl>`;
      const body = `<div class="ofw-native-query-detail">${queryAnswer.rows.map((item) => `<article><strong>${esc(item.name)} · ${esc(item.primary)}</strong><span>${esc(item.secondary)} · ${esc(item.tertiary)}</span><code>${esc((item.evidence || []).join(" · ") || "当前结果包未提供对象级证据引用")}</code></article>`).join("") || `<div class="ofw-native-note">当前回答没有可展开的结果行。</div>`}</div><div class="ofw-native-note">Result Package：${esc(state(queryAnswer.runtimeContext).results?.resultPackage?.resultPackageId || "尚未形成")}</div>`;
      openDrawer(queryAnswer.title, queryAnswer.question, `<p class="ofw-native-note">${esc(queryAnswer.summary || "")}</p>` + identity + body, queryAnswer.ready ? `<button type="button" class="ofw-native-action" data-ofw-native-action="query-export">导出 CSV</button><button type="button" class="ofw-native-action primary" data-ofw-native-route="#module/report" data-context-source="query-answer">加入报告</button>` : "");
    }

    function exportQueryAnswer() {
      if (!queryAnswer) return;
      const url = URL.createObjectURL(new Blob([W.queryResultCsv(queryAnswer)], { type: "text/csv;charset=utf-8" }));
      const link = doc.createElement("a"); link.href = url; link.download = `${queryAnswer.queryScenarioId}-问数结果.csv`;
      doc.body.appendChild(link); link.click(); link.remove(); global.setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    function renderQueryHistory() {
      doc.getElementById("ofw-model-query-history")?.remove();
      if (!/^#\/history(?:$|[/?])/.test(win.location.hash)) return;
      const header = doc.querySelector(".ui-page-header,.page-header");
      if (!header) return;
      const entries = W.readQueryHistory();
      const section = doc.createElement("section"); section.id = "ofw-model-query-history"; section.className = "ofw-model-query-history";
      section.innerHTML = `<header><h2>模型问数记录</h2><span>${entries.length} 条</span></header>${entries.map((entry) => `<button type="button" class="ofw-query-history-row" data-ofw-native-action="query-history-open" data-history-id="${esc(entry.id)}"><span><strong>${esc(entry.answer.question)}</strong><small>${esc(entry.answer.runtimeContext?.ui?.businessName || entry.scenarioId)} · ${esc(entry.savedAt.slice(0, 16).replace("T", " "))}</small></span><span>${esc(W.modes[W.normalizeMode(entry.answer.spec?.resultMode)])}</span><span>${entry.status === "cancelled" ? "已取消" : entry.status === "failed" ? "未完成" : `${entry.answer.rows.length} 条`}</span><i data-lucide="chevron-right" aria-hidden="true"></i></button>`).join("") || `<p class="ofw-native-note">尚无模型问数记录</p>`}`;
      header.insertAdjacentElement("afterend", section);
      win.lucide?.createIcons?.({ root: section });
    }

    function patchQueryDomain() {
      const domain = win.IQDomain;
      if (!domain?.RESULT_TEMPLATES || win.__OFW_V130_QUERY_DOMAIN_PATCHED__) return;
      const group = domain.RESULT_TEMPLATES["group-overview"];
      if (group) {
        const groupCost = 2.372;
        const sectors = [
          ["nuclear", "核能", 1.948],
          ["renewable", "境内新能源", 2.286],
          ["service", "产业服务", 2.462],
          ["digital", "数字化", 2.523],
          ["finance", "产业金融", 2.614],
          ["environment", "环保产业", 2.741]
        ];
        group.title = "集团融资余额、成本与产业板块对比";
        group.summary = "截至2025-12-31，集团融资余额为21,613.387亿元，余额加权平均融资成本为2.372231%。口径与融资驾驶舱一致。六个产业板块中核能、境内新能源低于集团平均，其余四个板块高于集团平均。";
        group.highlights = [
          { id: "group-balance", rowId: "group-balance", resourceId: "MET-FINANCING-BALANCE", label: "集团融资余额", value: "21,613.387 亿元", exact: "21613.387", unit: "亿元" },
          { id: "group-cost", rowId: "group", resourceId: "MET-WAVG-FINANCING-COST", label: "集团平均融资成本", value: "2.372231%", exact: "2.372231", unit: "%" },
          ...sectors.map(([id, label, value]) => ({ id, rowId: id, label, value: `${value.toFixed(3)}%`, exact: value.toFixed(3), unit: "%", secondary: `${value >= groupCost ? "+" : ""}${(value - groupCost).toFixed(3)} 个百分点` }))
        ];
        group.rows = group.rows.map((row) => {
          if (row.id === "group") return { ...row, exact: "2.372231", value: "2.372231%" };
          const match = sectors.find(([id]) => id === row.id);
          if (!match) return row;
          const delta = match[2] - groupCost;
          return { ...row, detail: `较集团平均${delta >= 0 ? "高" : "低"} ${Math.abs(delta).toFixed(3)} 个百分点` };
        });
        if (!group.rows.some((row) => row.id === "group-balance")) group.rows.unshift({ id: "group-balance", object: "集团", resourceId: "MET-FINANCING-BALANCE", label: "融资余额", exact: "21613.387", value: "21,613.387 亿元", unit: "亿元", status: "可计算" });
      }
      const institutions = domain.RESULT_TEMPLATES["institution-priority"];
      if (institutions) {
        institutions.summary = "单位553的成本压力主要来自欧陆银行、寰宇银行和海联银行。按问题余额排序，建议先与欧陆银行沟通，再依次与寰宇银行、海联银行协商。";
        institutions.highlights = [
          { id: "bank-1", rowId: "bank-1", label: "优先 1 · 欧陆银行", value: "99.586 亿元", exact: "99.586", unit: "亿元", tone: "danger" },
          { id: "bank-2", rowId: "bank-2", label: "优先 2 · 寰宇银行", value: "65.494 亿元", exact: "65.494", unit: "亿元", tone: "warning" },
          { id: "bank-3", rowId: "bank-3", label: "优先 3 · 海联银行", value: "58.476 亿元", exact: "58.476", unit: "亿元", tone: "warning" }
        ];
      }
      win.__OFW_V130_QUERY_DOMAIN_PATCHED__ = true;
    }

    function readCurrentQueryRun() {
      if (!frame.isConnected || !doc.body?.isConnected) return null;
      const domain = win.IQDomain;
      const storageKey = win.IQ_VARIANT?.storageKey;
      if (!domain?.loadState || !storageKey) return null;
      let queryState;
      try { queryState = domain.loadState(storageKey); } catch (_) { return null; }
      const runs = [...(queryState.liveRuns || []), ...(queryState.historyRuns || queryState.history || [])];
      const run = queryState.currentRunId ? runs.find((item) => item.id === queryState.currentRunId) : runs[0];
      return run ? { domain, storageKey, queryState, run } : null;
    }

    function queryRunWorkspacePatch(snapshot = readCurrentQueryRun()) {
      if (!snapshot?.run) return null;
      const run = snapshot.run;
      const result = run.result || {};
      const rows = result.rows || result.highlights || [];
      const objects = rows.map((item) => ({ id: item.stableId || item.objectId || item.subjectId || item.enterpriseId || item.id || "", label: item.object || item.name || item.label || item.title || "", type: item.objectType || item.type || "业务对象" })).filter((item) => item.id || item.label);
      const first = objects[0] || null;
      const dataAsOf = run.context?.dataAsOf || run.context?.asOf || snapshot.queryState?.scenarioContext?.formedAt?.slice?.(0, 10) || "";
      const resultKind = String(result.resultKind || result.identity || "FACT").toLowerCase();
      const resultModeId = /sim/.test(resultKind) ? "simulation" : /shadow/.test(resultKind) ? "shadow" : /predict|candidate/.test(resultKind) ? "candidate" : "formal";
      return {
        scenarioId: run.context?.scenarioId || (/预算/.test(run.question || "") ? "S002" : scenarioId),
        analysisScope: "set",
        objectSet: { selectionMode: "EXPLICIT", id: `query-run:${run.id}`, label: run.result?.title || run.title || run.question || "当前问数结果", count: objects.length || rows.length, objectIds: objects.map((item) => item.id).filter(Boolean) },
        object: first ? { id: first.id, label: first.label || first.id, type: first.type } : { id: "", label: "未聚焦单个对象", type: "" },
        timeRange: { start: "", end: dataAsOf, label: dataAsOf ? `截至 ${dataAsOf}` : "当前周期" },
        resultMode: { id: resultModeId, label: RESULT_MODE_LABELS[resultModeId] || "正式结果" },
        source: { moduleId: "query", queryRunId: run.id, question: run.question || run.configSnapshot?.question || "" }
      };
    }

    function queryActionGate(snapshot, requestedTargetStableId = null) {
      const options = [snapshot.run.result?.actionContext, ...(snapshot.run.result?.actionContexts || [])].filter(Boolean);
      const targetStableId = requestedTargetStableId || (options.length === 1 ? options[0].singleTargetStableId : options[0]?.singleTargetStableId);
      const standard = snapshot.domain.actionEligibility(snapshot.run, snapshot.run.configSnapshot, snapshot.queryState.scenarioContext, targetStableId);
      if (standard.allowed) return standard;
      const current = snapshot.domain.readRuntimeContext();
      const runContext = snapshot.run.context || {};
      const sameIdentity = current?.allowConsumption === true
        && current?.evidenceComplete === true
        && ["scenarioId", "scenarioVersion", "scenarioRunId", "semanticVersion", "versionId", "dataVersion", "asOf"].every((field) => current?.[field] === runContext?.[field]);
      const action = options.find((item) => item.singleTargetStableId === targetStableId) || null;
      const resultResources = new Set(snapshot.run.result?.resourceIds || []);
      const evidenceIds = new Set([...(snapshot.run.result?.rows || []).map((item) => item.evidenceId), ...(snapshot.run.result?.evidenceReferences || []).map((item) => item.evidenceId)].filter(Boolean));
      const requiredEvidence = action?.sourceKind === "rule" ? [action.ruleEvidenceId] : [...(action?.institutionEvidenceIds || []), ...(action?.loanEvidenceIds || []), action?.ownerEvidenceId].filter(Boolean);
      const fixedResult = snapshot.domain.verifyFixedResult(snapshot.run.result, runContext, snapshot.run.configSnapshot);
      const actionResource = action ? snapshot.domain.resourceFromContext(runContext, action.actionTypeId) : null;
      const complete = sameIdentity
        && snapshot.run.status === "成功"
        && action?.singleTargetStableId
        && actionResource?.type === "Action Type"
        && resultResources.has(action.actionTypeId)
        && (action.ruleMetricResourceIds || []).every((id) => resultResources.has(id))
        && requiredEvidence.length > 0
        && requiredEvidence.every((id) => evidenceIds.has(id))
        && fixedResult.passed;
      return complete ? { allowed: true, reason: "已按精确场景、语义、数据和证据重新核对", actionContext: clone(action) } : standard;
    }

    function closeQueryActionFlow() {
      queryActionState = null;
      doc.getElementById("ofw-native-query-action-root")?.remove();
    }

    function renderQueryActionFlow(stage = "review", record = null, message = "") {
      const current = queryActionState;
      if (!current) return;
      doc.getElementById("ofw-native-query-action-root")?.remove();
      const action = current.gate.actionContext;
      const rows = current.run.result?.rows || [];
      const banks = (action.institutionBindings || []).map((binding, index) => {
        const row = rows.find((item) => item.id === binding.institutionResultItemId) || {};
        return { rank: index + 1, name: row.object || row.exact || binding.institutionStableId, balance: row.exact ? `${row.exact}${row.unit || ""}` : "见固定结果", detail: row.detail || `${binding.loanStableIds?.length || 0} 笔融资` };
      });
      const evidenceIds = current.run.result?.evidenceIds || rows.map((item) => item.evidenceId).filter(Boolean);
      const root = doc.createElement("div");
      root.id = "ofw-native-query-action-root";
      const body = stage === "success" || stage === "duplicate"
        ? `<div class="ofw-action-success"><span>✓</span><h3>${stage === "duplicate" ? "已返回原行动申请" : "行动申请已送达决策中心"}</h3><p>${esc(message || "决策中心已可读取同一 C011 申请；后续人工确认、负责人分办和进展跟踪在决策中心完成。")}</p><code>${esc(record?.id || "")}</code><div class="ofw-action-receipt"><div><span>目标主体</span><strong>${esc(record?.target || action.targetLabel)}</strong></div><div><span>收件状态</span><strong>${stage === "duplicate" ? "原申请有效" : "已进入收件箱"}</strong></div><div><span>来源运行</span><strong>${esc(short(record?.runId || current.run.id, 28))}</strong></div><div><span>证据数量</span><strong>${record?.evidenceIds?.length || evidenceIds.length} 项</strong></div></div></div>`
        : `<div class="ofw-action-review"><section class="ofw-action-target"><span>行动目标</span><strong>${esc(action.targetLabel || current.run.result?.scope?.[0] || "当前主体")}</strong><small>${esc(action.singleTargetStableId)} · ${esc(current.actionResource?.name || action.actionTypeId)}</small></section><section class="ofw-action-bank-list"><header><strong>建议协商顺序</strong><span>按本轮固定问题余额排序</span></header>${banks.map((bank) => `<article><b>${bank.rank}</b><div><strong>${esc(bank.name)}</strong><span>${esc(bank.detail)}</span></div><em>${esc(bank.balance)}</em></article>`).join("")}</section><dl class="ofw-native-facts"><div><dt>语义版本</dt><dd>${esc(current.run.context?.semanticVersion || "无法定位")}</dd></div><div><dt>数据版本</dt><dd>${esc(current.run.context?.dataVersion || "无法定位")}</dd></div><div><dt>固定结果</dt><dd>${esc(short(current.run.result?.fixedResultId, 30))}</dd></div><div><dt>证据</dt><dd>${evidenceIds.length} 项</dd></div></dl><label class="ofw-action-confirm"><input type="checkbox" data-query-action-confirm><span><strong>我已核对行动目标、银行顺序和固定证据</strong><small>提交只形成行动申请，不自动审批或创建负责人待办。</small></span></label>${message ? `<div class="ofw-native-error">${esc(message)}</div>` : ""}</div>`;
      root.innerHTML = `<div class="ofw-action-backdrop" data-ofw-native-action="query-action-close"><section class="ofw-action-modal" role="dialog" aria-modal="true" aria-labelledby="ofw-action-title"><header><div><span>智能问数 · 行动申请</span><h2 id="ofw-action-title">${stage === "success" || stage === "duplicate" ? "提交结果" : "发起融资优化行动"}</h2></div><button type="button" data-ofw-native-action="query-action-close" aria-label="关闭">×</button></header><main>${body}</main><footer><button class="ofw-native-action" type="button" data-ofw-native-action="query-action-close">${stage === "success" || stage === "duplicate" ? "返回回答" : "取消"}</button>${stage === "success" || stage === "duplicate" ? `<button class="ofw-native-action primary" type="button" data-ofw-native-route="#module/decision">打开决策中心</button>` : `<button class="ofw-native-action primary" type="button" data-ofw-native-action="query-action-submit" disabled>确认并提交行动申请</button>`}</footer></section></div>`;
      doc.body.appendChild(root);
    }

    function openQueryActionFlow(requestedTargetStableId = null) {
      const snapshot = readCurrentQueryRun();
      if (!snapshot?.run?.result) return;
      const options = [snapshot.run.result.actionContext, ...(snapshot.run.result.actionContexts || [])].filter(Boolean);
      const targetStableId = requestedTargetStableId || (options.length === 1 ? options[0].singleTargetStableId : options[0]?.singleTargetStableId);
      const gate = queryActionGate(snapshot, targetStableId);
      if (!gate.allowed) {
        queryActionState = { ...snapshot, gate: { actionContext: options[0] || {} }, actionResource: null };
        renderQueryActionFlow("review", null, gate.reason || "当前回答不能形成行动申请。");
        return;
      }
      const actionResource = snapshot.domain.resourceFromContext(snapshot.run.context, gate.actionContext.actionTypeId);
      queryActionState = { ...snapshot, gate, actionResource };
      renderQueryActionFlow("review");
    }

    function submitQueryActionFlow() {
      const current = queryActionState;
      if (!current) return;
      const { domain, storageKey, queryState, run, gate } = current;
      const action = gate.actionContext;
      const evidenceIds = run.result?.evidenceIds || [...(run.result?.rows || []).map((item) => item.evidenceId), ...(run.result?.evidenceReferences || []).map((item) => item.evidenceId)].filter(Boolean);
      const createdAt = domain.nowText();
      const request = {
        id: `AR-${run.id}-${action.singleTargetStableId}`,
        target: action.targetLabel || run.result.scope?.[0] || action.singleTargetStableId,
        targetStableId: action.singleTargetStableId,
        createdAt,
        status: "待接收",
        runId: run.id,
        fixedResultId: run.result.fixedResultId,
        actionType: action.actionTypeId,
        ruleId: action.ruleMetricResourceIds?.find((id) => id.startsWith("RULE-")) || null,
        context: clone(run.context),
        scenarioId: run.context.scenarioId,
        scenarioVersion: run.context.scenarioVersion,
        scenarioRunId: run.context.scenarioRunId,
        semanticVersion: run.context.semanticVersion,
        dataVersion: run.context.dataVersion,
        runtimeContextFingerprint: run.context.runtimeContextFingerprint,
        actionContext: clone(action),
        evidenceIds
      };
      request.idempotencyKey = domain.actionRequestIdempotencyKey(request);
      request.c011Payload = domain.buildC011Payload(request, run);
      const reconciliation = domain.reconcileActionRequest(queryState.actionRequests, request);
      if (reconciliation.status === "conflict") {
        renderQueryActionFlow("review", null, reconciliation.reason);
        return;
      }
      domain.saveState(storageKey, { ...queryState, serial: Number(queryState.serial || 0) + (reconciliation.status === "accepted" ? 1 : 0), actionRequests: reconciliation.requests });
      const delivery = domain.publishActionRequestInbox(reconciliation.requests, run.context);
      if (!delivery.published) {
        renderQueryActionFlow("review", null, delivery.reason || "决策中心收件未完成。");
        return;
      }
      queryActionState = { ...current, queryState: { ...queryState, actionRequests: reconciliation.requests } };
      renderQueryActionFlow(reconciliation.status === "duplicate" ? "duplicate" : "success", reconciliation.request, reconciliation.reason);
    }

    function decorateQueryActionEntry() {
      if (module.id !== "query" || doc.querySelector(".ofw-query-action-cta")) return;
      const snapshot = readCurrentQueryRun();
      if (!snapshot?.run?.result) return;
      const gate = queryActionGate(snapshot);
      if (!gate.allowed) return;
      const answerCard = doc.querySelector(".answer-card,.modern-answer-card");
      if (!answerCard) return;
      const target = gate.actionContext.targetLabel || snapshot.run.result.scope?.[0] || "当前主体";
      const host = answerCard.querySelector(".view-actions,.modern-answer-actions") || answerCard;
      const cta = doc.createElement("section");
      cta.className = "ofw-query-action-cta";
      cta.innerHTML = `<span>行动申请</span><div><strong>${esc(target)}可进入人工决策流程</strong><small>已固定主体、结果、银行顺序和证据。</small></div><button type="button" data-ofw-native-action="query-action-open">发起行动申请</button>`;
      host.parentElement?.insertBefore(cta, host);
    }

    function decorateQueryWorkspaceActions() {
      const snapshot = readCurrentQueryRun();
      if (!snapshot?.run?.result) return;
      const answerCard = doc.querySelector(".answer-card,.modern-answer-card");
      const host = answerCard?.querySelector(".view-actions,.modern-answer-actions");
      if (!host || host.querySelector(".ofw-query-workspace-actions")) return;
      const actions = doc.createElement("span");
      actions.className = "ofw-query-workspace-actions";
      actions.innerHTML = `<button type="button" class="ui-button ui-button--secondary ui-button--md" data-ofw-native-route="#module/m07" data-context-source="query-run"><span class="ui-button__label">带入探索</span></button><button type="button" class="ui-button ui-button--secondary ui-button--md" data-ofw-native-route="#module/report" data-context-source="query-run"><span class="ui-button__label">加入报告</span></button>`;
      host.appendChild(actions);
      if (snapshot.run.id !== lastWorkspaceQueryRunId) {
        lastWorkspaceQueryRunId = snapshot.run.id;
        // A completed answer does not replace the user's active object or filter.
      }
    }

    function decorateQueryComparison() {
      const snapshot = readCurrentQueryRun();
      if (snapshot?.run?.result?.id !== "group-overview" || doc.querySelector(".ofw-sector-comparison")) return;
      const summary = doc.querySelector(".modern-answer-summary,.answer-summary");
      if (!summary) return;
      const rows = snapshot.run.result.rows || [];
      const group = Number(rows.find((item) => item.id === "group")?.exact);
      const ids = ["group", "nuclear", "renewable", "service", "digital", "finance", "environment"];
      const tableRows = ids.map((id) => rows.find((item) => item.id === id)).filter(Boolean);
      const section = doc.createElement("section");
      section.className = "ofw-sector-comparison";
      section.innerHTML = `<header><strong>集团与产业板块融资成本</strong><span>单位：%</span></header><div>${tableRows.map((item) => { const value = Number(item.exact); const delta = item.id === "group" ? 0 : value - group; return `<article class="${item.id === "group" ? "group" : delta > 0 ? "above" : "below"}"><span>${esc(item.object)}</span><strong>${esc(Number.isFinite(value) ? value.toFixed(3) : item.exact)}%</strong><em>${item.id === "group" ? "集团基准" : `${delta >= 0 ? "+" : ""}${delta.toFixed(3)} 个百分点`}</em></article>`; }).join("")}</div>`;
      summary.insertAdjacentElement("afterend", section);
    }

    function scheduleQueryDecorations() {
      if (module.id !== "query") return;
      queryDecorationTimers.forEach((timerId) => global.clearTimeout(timerId));
      queryDecorationTimers = [];
      [720, 1800, 3600, 4600].forEach((delay) => {
        const timerId = global.setTimeout(() => {
          queryDecorationTimers = queryDecorationTimers.filter((item) => item !== timerId);
          if (!frame.isConnected || !doc.body?.isConnected) return;
        if (doc.querySelector(".modern-start") && !doc.querySelector(".ofw-query-scenario-tabs")) renderQuery();
        decorateQueryComparison();
        decorateQueryActionEntry();
        decorateQueryWorkspaceActions();
        }, delay);
        queryDecorationTimers.push(timerId);
      });
    }

    function recommendationScenario(item) {
      if (item?.scenarioId === "S001" && /债务|期限|到期|偿债|风险/.test(`${item.question || ""}${item.title || ""}${item.theme || ""}`)) return "S003";
      return item?.scenarioId || scenarioId;
    }

    function ensureQueryScenarioTabs(start, counts) {
      const parentTabs = start.querySelector(".modern-topic-tabs");
      parentTabs?.classList.add("ofw-parent-topic-tabs");
      parentTabs?.setAttribute("aria-hidden", "true");
      let tabs = start.querySelector(".ofw-query-scenario-tabs");
      if (!tabs) {
        tabs = doc.createElement("div");
        tabs.className = "ofw-query-scenario-tabs";
        tabs.setAttribute("role", "tablist");
        tabs.setAttribute("aria-label", "按业务主题筛选推荐问题");
        parentTabs?.insertAdjacentElement("afterend", tabs);
      }
      QUERY_SCENARIOS.forEach((item) => {
        let button = tabs.querySelector(`[data-query-scenario="${item.id}"]`);
        if (!button) {
          button = doc.createElement("button");
          button.type = "button";
          button.dataset.ofwNativeAction = "query-scenario";
          button.dataset.queryScenario = item.id;
          button.setAttribute("role", "tab");
          button.innerHTML = `<span>${esc(item.label)}</span><small></small>`;
          tabs.appendChild(button);
        }
        button.querySelector("small").textContent = String(counts[item.id] || 0);
        const active = queryRecommendationScenario === item.id;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", String(active));
      });
    }

    function applyQueryRecommendationFilter(grid) {
      let visibleIndex = 0;
      [...grid.children].forEach((button) => {
        const owner = button.dataset.ofwRecommendationScenario || scenarioId;
        const visible = queryRecommendationScenario === "ALL" || owner === queryRecommendationScenario;
        button.hidden = !visible;
        if (visible) {
          visibleIndex += 1;
          const numberNode = button.querySelector(":scope > span");
          if (numberNode) numberNode.textContent = String(visibleIndex).padStart(2, "0");
        }
      });
      doc.querySelectorAll(".ofw-query-scenario-tabs [data-query-scenario]").forEach((button) => {
        const active = button.dataset.queryScenario === queryRecommendationScenario;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", String(active));
      });
    }

    function renderQuery() {
      renderQueryHistory();
      patchQueryDomain();
      const start = doc.querySelector(".modern-start");
      if (!start) return;
      renderQueryScope();
      const runtimeNote = start.querySelector(".modern-runtime-note span");
      if (runtimeNote) runtimeNote.textContent = "融资成本、预算监督、债务风险、贷前评估和投后评价均可在同一工作台提问";
      const grid = start.querySelector(".modern-question-grid");
      if (!grid) return;
      const recs = new Map((win.IQ_PORTFOLIO?.recommendations || []).map((item) => [item.question, item]));
      [...grid.children].forEach((button) => {
        if (button.dataset.ofwNativeQuestion) return;
        const question = button.querySelector("strong")?.childNodes?.[0]?.textContent?.trim() || "";
        const recommendation = recs.get(question);
        if (!recommendation) return;
        const owner = recommendationScenario(recommendation);
        button.dataset.ofwRecommendationScenario = owner;
        const detail = button.querySelector("strong small");
        if (detail) detail.textContent = `${recommendation.title} · ${QUERY_SCENARIOS.find((item) => item.id === owner)?.label.replace(/^S\d{3}\s*·\s*/, "") || recommendation.category}`;
      });
      const existingQuestions = new Set([...grid.querySelectorAll("[data-ofw-native-question]")].map((button) => `${button.dataset.ofwQuestionScenario}:${button.dataset.ofwModelQuestion}`));
      Object.entries(MODEL_QUESTIONS).forEach(([owner, items]) => items.forEach((item) => {
        const key = `${owner}:${item.question}`;
        if (existingQuestions.has(key)) return;
        const button = doc.createElement("button");
        button.type = "button";
        button.className = "ofw-native-model-question";
        button.dataset.ofwNativeQuestion = "true";
        button.dataset.ofwModelQuestion = item.question;
        button.dataset.ofwQuestionScenario = owner;
        button.dataset.ofwRecommendationScenario = owner;
        button.innerHTML = `<span>00</span><strong>${esc(item.question)}<small>${esc(item.label)} · 模型结果</small></strong><i data-lucide="arrow-up-right" aria-hidden="true"></i>`;
        grid.appendChild(button);
        existingQuestions.add(key);
      }));
      const counts = { ALL: grid.children.length, S001: 0, S002: 0, S003: 0, S004: 0, S005: 0 };
      [...grid.children].forEach((button) => {
        const owner = button.dataset.ofwRecommendationScenario;
        if (owner && Object.hasOwn(counts, owner)) counts[owner] += 1;
      });
      ensureQueryScenarioTabs(start, counts);
      applyQueryRecommendationFilter(grid);
      win.lucide?.createIcons?.({ root: grid, attrs: { "stroke-width": 1.8 } });
      const headerText = start.querySelector(".modern-recommendations > header p");
      if (headerText) headerText.textContent = `${counts.ALL} 个推荐问题，按业务主题筛选后直接提问。`;
    }

    function decisionStage(item, taskById) {
      const task = taskById.get(item.taskId);
      const status = String(item.status || "").toLowerCase();
      const taskStatus = String(task?.status || task?.dispatchStatus || "").toLowerCase();
      if (/取消|纠正完成|cancelled|canceled|corrected/.test(taskStatus)) return "closed";
      if (/完成|结束|closed|completed|done/.test(`${status}${taskStatus}`)) return "completed";
      if (/拒绝|驳回|rejected/.test(status)) return "closed";
      if (/阻断|失败|blocked|failed|conflict/.test(`${status}${taskStatus}`)) return "blocked";
      if (task) return /处理中|进行中|accepted|in_progress/.test(taskStatus) ? "executing" : "assigned";
      if (item.decision?.type === "confirm" || status === "confirmed") return "confirmed";
      if (/awaiting|待确认|待决策|pending|received|待接收/.test(status) || !item.decision) return "review";
      return "received";
    }

    function decisionStageLabel(stage) {
      return ({ received: "已接收", review: "待人工判断", confirmed: "已确认待分办", assigned: "已分办", executing: "执行中", blocked: "受阻", completed: "已完成", closed: "已结束" })[stage] || stage;
    }

    function decisionSourceLabel(sourceType) {
      return ({ qa: "智能问数", report: "报告与驾驶舱", agent: "Agent 应用", rule: "规则结果" })[sourceType] || sourceType || "业务提交";
    }

    function decisionMatchesFilter(record, filter) {
      if (filter === "all") return true;
      if (filter === "executing") return ["assigned", "executing"].includes(record.stage);
      if (filter === "completed") return ["completed", "closed"].includes(record.stage);
      if (filter === "blocked") return record.stage === "blocked" || record.overdue;
      return record.stage === filter;
    }

    function decisionOperationsData() {
      const snapshot = win.loadDecisionState?.() || { requests: [], tasks: [] };
      const taskById = new Map((snapshot.tasks || []).map((item) => [item.id, item]));
      const records = (snapshot.requests || []).map((item) => {
        const task = taskById.get(item.taskId) || null;
        const stage = decisionStage(item, taskById);
        const formedAt = item.requestTime || item.generatedTime || item.createdAt || item.sourceEvents?.[0]?.time || "—";
        const dueDate = task?.dueDate || item.decision?.dueDate || "—";
        const overdue = !["completed", "closed"].includes(stage) && (Boolean(task?.overdue) || dueDate !== "—" && Date.parse(dueDate) < Date.now());
        return {
          item,
          task,
          stage,
          overdue,
          id: item.id || item.requestId,
          subject: item.subjectName || item.target || item.singleBusinessSubjectName || "未命名事项",
          action: item.actionType?.name || item.actionType || "待确定行动",
          source: decisionSourceLabel(item.sourceType),
          owner: task?.owner || item.decision?.owner || item.recommendedTaskOwner || item.recipientName || "待分办",
          formedAt,
          dueDate
        };
      });
      return { snapshot, records };
    }

    function decisionOperationsDrawer(recordId) {
      const record = decisionOperationsData().records.find((item) => item.id === recordId);
      if (!record) return;
      const stages = ["received", "review", "confirmed", "assigned", "executing", "completed"];
      const activeIndex = record.stage === "closed" ? stages.length - 1 : stages.indexOf(record.stage);
      const body = `<section class="ofw-ops-detail-head"><span>${esc(record.source)}</span><h3>${esc(record.subject)}</h3><p>${esc(record.action)}</p></section><div class="ofw-ops-detail-flow">${stages.map((stage, index) => `<div class="${index < activeIndex ? "done" : index === activeIndex ? "current" : ""}"><i>${index < activeIndex ? "✓" : index + 1}</i><span>${esc(record.stage === "closed" && stage === "completed" ? "已结束" : decisionStageLabel(stage))}</span></div>`).join("")}</div><dl class="ofw-native-facts"><div><dt>当前阶段</dt><dd>${esc(decisionStageLabel(record.stage))}</dd></div><div><dt>责任位置</dt><dd>${esc(record.owner)}</dd></div><div><dt>形成时间</dt><dd>${esc(record.formedAt)}</dd></div><div><dt>到期时间</dt><dd>${esc(record.dueDate)}</dd></div><div><dt>申请标识</dt><dd>${esc(short(record.id, 34))}</dd></div><div><dt>证据状态</dt><dd>${esc(record.item.evidence?.ready ? "已就绪" : record.item.evidence?.quality || "未提供") }</dd></div></dl><div class="ofw-native-note">${esc(record.item.recommendation || record.task?.instructions || "在决策工作台查看完整证据并继续处理。")}</div>`;
      const footer = `<button class="ofw-native-action" type="button" data-ofw-native-action="decision-open-record" data-decision-route="request/${esc(encodeURIComponent(record.id))}">查看行动申请</button>${record.task ? `<button class="ofw-native-action primary" type="button" data-ofw-native-action="decision-open-record" data-decision-route="task/${esc(encodeURIComponent(record.task.id))}">处理负责人待办</button>` : record.item.reminderId ? `<button class="ofw-native-action primary" type="button" data-ofw-native-action="decision-open-record" data-decision-route="reminder/${esc(encodeURIComponent(record.item.reminderId))}">处理决策事项</button>` : ""}<button class="ofw-native-action" type="button" data-ofw-native-action="decision-open-record" data-decision-route="trace/request/${esc(encodeURIComponent(record.id))}">全链路追溯</button>`;
      openDrawer("决策事项进展", record.id, body, footer);
    }

    function renderDecisionOperations() {
      let stage = doc.getElementById("ofw-decision-ops-root");
      if (!stage) {
        stage = doc.createElement("div");
        stage.id = "ofw-decision-ops-root";
        doc.body.appendChild(stage);
      }
      doc.body.classList.add("ofw-decision-ops-active");
      const { records } = decisionOperationsData();
      const filtered = records.filter((item) => decisionMatchesFilter(item, decisionOpsFilter));
      const counts = Object.fromEntries(["received", "review", "confirmed", "assigned", "executing", "blocked", "completed", "closed"].map((key) => [key, records.filter((item) => item.stage === key).length]));
      const attentionCount = records.filter((item) => decisionMatchesFilter(item, "blocked")).length;
      const sources = [...new Set(records.map((item) => item.source))].map((source) => ({ source, count: records.filter((item) => item.source === source).length })).sort((a, b) => b.count - a.count);
      const maxSource = Math.max(1, ...sources.map((item) => item.count));
      const steps = [
        ["received", "申请接收"], ["review", "人工判断"], ["confirmed", "确认与分办"], ["executing", "负责人执行"], ["completed", "结束归档"]
      ];
      stage.innerHTML = `<div class="ofw-decision-ops" data-screen-label="决策运营概览"><header class="ofw-ops-head"><div><span>决策中心</span><h1>决策运营概览</h1><p>全部决策事项的接收、判断、分办、执行和完成进展。</p></div><button class="ofw-native-action primary" type="button" data-ofw-native-action="decision-open-workbench">进入决策工作台</button></header><section class="ofw-ops-metrics"><button type="button" data-ofw-native-action="decision-ops-filter" data-filter="all"><span>全部事项</span><strong>${records.length}</strong><small>全部来源</small></button><button type="button" data-ofw-native-action="decision-ops-filter" data-filter="review"><span>待人工判断</span><strong>${counts.review}</strong><small>需要业务确认</small></button><button type="button" data-ofw-native-action="decision-ops-filter" data-filter="executing"><span>已进入执行</span><strong>${counts.assigned + counts.executing}</strong><small>已分办或处理中</small></button><button type="button" data-ofw-native-action="decision-ops-filter" data-filter="blocked" class="${attentionCount ? "warning" : ""}"><span>受阻或逾期</span><strong>${attentionCount}</strong><small>需要运营介入</small></button></section><section class="ofw-ops-flow"><header><div><h2>流程全貌</h2><p>点击阶段筛选下方事项。</p></div><button class="ofw-ops-reset" type="button" data-ofw-native-action="decision-ops-filter" data-filter="all">查看全部</button></header><div>${steps.map(([key, label], index) => `<button type="button" class="${decisionOpsFilter === key ? "active" : ""}" data-ofw-native-action="decision-ops-filter" data-filter="${key}"><i>${index + 1}</i><span>${label}</span><strong>${key === "received" ? counts.received : key === "executing" ? counts.assigned + counts.executing : key === "completed" ? counts.completed + counts.closed : counts[key]}</strong></button>`).join("")}</div></section><div class="ofw-ops-grid"><section class="ofw-ops-source"><header><h2>来源构成</h2><span>${sources.length} 类来源</span></header><div>${sources.map((item) => `<article><span>${esc(item.source)}</span><i><i style="width:${Math.max(8, item.count / maxSource * 100)}%"></i></i><strong>${item.count}</strong></article>`).join("")}</div></section><section class="ofw-ops-attention"><header><h2>运营关注</h2><span>按阻断与等待排序</span></header><div>${records.filter((item) => ["blocked", "review", "received"].includes(item.stage) || item.overdue).slice(0, 5).map((item) => `<button type="button" data-ofw-native-action="decision-ops-open" data-record-id="${esc(item.id)}"><i class="${item.stage}"></i><span><strong>${esc(item.subject)}</strong><small>${esc(item.action)} · ${esc(item.owner)}</small></span><em>${esc(decisionStageLabel(item.stage))}</em></button>`).join("") || `<div class="ofw-ops-empty">当前没有需要运营介入的事项</div>`}</div></section></div><section class="ofw-ops-records"><header><div><h2>决策事项</h2><p>${decisionOpsFilter === "all" ? "全部流程状态" : decisionStageLabel(decisionOpsFilter)}</p></div><span>${filtered.length} 条</span></header><div class="ofw-ops-table"><div class="head"><span>业务主体</span><span>行动类型</span><span>来源</span><span>当前阶段</span><span>责任位置</span><span>到期时间</span><span></span></div>${filtered.map((item) => `<button type="button" data-ofw-native-action="decision-ops-open" data-record-id="${esc(item.id)}"><span><strong>${esc(item.subject)}</strong><small>${esc(short(item.id, 24))}</small></span><span>${esc(item.action)}</span><span>${esc(item.source)}</span><span><i class="status ${item.stage}"></i>${esc(decisionStageLabel(item.stage))}${item.overdue ? `<small class="overdue">已逾期</small>` : ""}</span><span>${esc(item.owner)}</span><span class="${item.overdue ? "overdue" : ""}">${esc(item.dueDate)}</span><span>查看进展 ›</span></button>`).join("") || `<div class="ofw-ops-empty">当前阶段没有事项</div>`}</div></section></div>`;
    }

    function removeScenarioFilter(container = doc) {
      container.querySelectorAll("label.dc-select").forEach((label) => {
        if (label.querySelector(":scope > span")?.textContent.trim() !== "业务场景") return;
        label.hidden = true;
        label.setAttribute("aria-hidden", "true");
        label.style.setProperty("display", "none", "important");
      });
    }

    async function ensureDecisionBoundary() {
      if (scenarioId !== "S005" || decisionBoundaryPending || !scenarioAction("selection_read_only")?.enabled) return;
      decisionBoundaryPending = true;
      try {
        const receipt = await request("/v1/model-management/guard", {
          method: "POST",
          body: JSON.stringify({ scenarioId, resultKind: "SIMULATION" })
        });
        if (receipt.code !== "NON_FACT_SOURCE_REJECTED" || receipt.sideEffectsEmitted !== 0) throw new Error("非事实来源边界核验未通过。");
        await runScenario("selection_read_only");
      } catch (error) {
        operationError = error.message || "决策来源边界核验未完成。";
      } finally {
        decisionBoundaryPending = false;
      }
    }

    function renderDecision() {
      doc.querySelectorAll("[data-ofw-native-action='guard-open']").forEach((item) => {
        item.hidden = true;
        item.setAttribute("aria-hidden", "true");
        item.style.setProperty("display", "none", "important");
      });
      removeScenarioFilter();
      void ensureDecisionBoundary();
      if (win.location.hash === "#overview") {
        renderDecisionOperations();
        return;
      }
      doc.body.classList.remove("ofw-decision-ops-active");
      doc.getElementById("ofw-decision-ops-root")?.remove();
      if (decisionReturnRoute && /^#(?:request|reminder|task|trace)\//.test(win.location.hash)) {
        const heading = doc.querySelector(".page-header");
        if (heading && !heading.querySelector('[data-ofw-native-action="decision-return-tracking"]')) {
          const back = doc.createElement("button"); back.type = "button"; back.className = "ofw-native-action";
          back.dataset.ofwNativeAction = "decision-return-tracking"; back.textContent = "返回追踪待办"; heading.appendChild(back);
        }
      }
      const summary = doc.querySelector(".portfolio-leader-metrics");
      if (summary) {
        summary.hidden = true;
        summary.setAttribute("aria-hidden", "true");
        summary.style.setProperty("display", "none", "important");
      }
      const header = doc.querySelector(".portfolio-leader-workbench .page-header");
      if (header) {
        const title = header.querySelector("h1");
        const copy = header.querySelector(".page-heading > p");
        if (title) title.textContent = "决策工作台";
        if (copy) copy.textContent = "集中处理需要人工判断、确认和分办的决策事项。";
      }
      const directoryTitle = doc.querySelector(".portfolio-directory-title strong");
      if (directoryTitle) directoryTitle.textContent = "全部待处理事项";
    }

    function agentDrawer() {
      const subjects = scopedSubjects();
      if (!selectedSubjectId || !subjects.some((item) => item.id === selectedSubjectId)) selectedSubjectId = subjects[0]?.id || "";
      const selected = subjects.find((item) => item.id === selectedSubjectId) || null;
      const s005RiskAction = scenarioId === "S005" ? scenarioAction("risk_explanation") : null;
      const body = subjects.length
        ? `<div class="ofw-native-agent-control"><select data-ofw-native-subject>${subjects.map((item) => `<option value="${esc(item.id)}" ${item.id === selected?.id ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select><button class="ofw-native-action primary" type="button" data-ofw-native-action="agent-run">生成解释</button></div>${agentResult ? `<div class="ofw-native-agent-result"><h3>${esc(agentResult.name)}</h3><p>${esc(agentResult.summary)}</p><div class="ofw-native-query-evidence">${esc(agentResult.evidence)}</div></div>` : `<div class="ofw-native-note">选择业务对象并运行，解释当前正式/候选差异、置信度和证据，不重新计算模型结果。</div>`}`
        : scenarioId === "S005" && (s005RiskAction?.enabled || s005RiskAction?.status === "complete")
          ? `${agentResult ? `<div class="ofw-native-agent-result"><h3>${esc(agentResult.name)}</h3><p>${esc(agentResult.summary)}</p><div class="ofw-native-query-evidence">${esc(agentResult.evidence)}</div></div>` : `<div class="ofw-native-note">读取当前投后评价结果，形成交易与风险解释；缺失指标继续保留无法评价。</div>`}`
          : `<div class="ofw-native-note">当前场景尚未形成可解释的候选结果。</div>`;
      const footer = subjects.length ? (agentResult ? `<button class="ofw-native-action" type="button" data-ofw-native-route="#module/m07">查看对象证据</button><button class="ofw-native-action primary" type="button" data-ofw-native-route="#module/report">加入报告</button>` : "") : scenarioId === "S005" && s005RiskAction?.enabled
        ? `<button class="ofw-native-action primary" type="button" data-ofw-native-action="agent-run">形成风险解释</button>`
        : `<button class="ofw-native-action primary" type="button" data-ofw-native-route="#module/modeling">模型目标与优化</button>`;
      openDrawer(`${context?.ui?.businessName || scenarioId}模型解释`, "Agent 应用", body, footer);
    }

    function renderAgentTaskBoard() {
      doc.querySelector("[data-ofw-task-result-board]")?.remove();
    }

    function renderAgent() {
      const grid = doc.querySelector(".agent-grid");
      if (!grid) return;
      const syncCount = () => {
        const count = grid.querySelectorAll(".agent-card").length;
        const badge = doc.querySelector(".product-nav-item.active .nav-count");
        if (badge) badge.textContent = String(count);
        const summary = [...doc.querySelectorAll(".agent-directory-summary .summary-cell")].find((item) => item.querySelector("span")?.textContent.trim() === "可用 Agent");
        if (summary?.querySelector("strong")) summary.querySelector("strong").textContent = String(count);
      };
      const headerCopy = doc.querySelector(".page-header p");
      if (headerCopy && /四个业务场景/.test(headerCopy.textContent)) headerCopy.textContent = headerCopy.textContent.replace("四个业务场景", "五类业务主题");
      const subjects = scopedSubjects();
      const ready = subjects.length > 0;
      renderAgentTaskBoard();
      let card = grid.querySelector("[data-ofw-native-agent]");
      if (!card) {
        card = doc.createElement("article");
        card.className = "agent-card ofw-native-agent-card";
        card.dataset.ofwNativeAgent = scenarioId;
        grid.prepend(card);
      }
      card.innerHTML = `<div class="agent-card-head"><div class="agent-avatar">AI</div><div><span>结果解释</span><h2>${esc(context?.ui?.businessName || "业务结果")}解释助手</h2></div><span class="badge ${ready ? "success" : "warning"}">${ready ? "可运行" : "等待结果"}</span></div><p>围绕当前对象集解释结果差异、贡献、异常和证据，不重新计算或改写原结果。</p><div class="card-meta"><div><span>当前对象集</span><strong>${esc(resolvedWorkspaceContext().objectSet.label)}</strong></div><div><span>结果模式</span><strong>${esc(resolvedWorkspaceContext().resultMode.label)}</strong></div><div><span>可解释对象</span><strong>${subjects.length} 个</strong></div><div><span>证据引用</span><strong>${subjects.reduce((total, item) => total + item.evidenceRefs.length, 0)} 条</strong></div></div><div class="card-foot"><span>${ready ? "选择对象后形成解释结果" : "完成模型评测后可用"}</span><button class="text-button" type="button" data-ofw-native-action="agent-open">打开任务</button></div>`;
      syncCount();
    }

    function reportWorkspaceSummary(value = resolvedWorkspaceContext()) {
      const count = Number(value.objectSet.count || 0);
      const countText = count && !String(value.objectSet.label).includes(String(count)) ? `（${count}）` : "";
      return `${value.objectSet.label}${countText} · ${value.object.label} · ${value.timeRange.label} · ${value.resultMode.label}`;
    }

    function createReportDraft() {
      const block = W.snapshotBlock(state(), resolvedWorkspaceContext(), module.id, businessName(scenarioId) + "结果分析");
      reportDraft = W.appendBlock(scenarioId, block);
      return reportDraft;
    }

    function captureAnalysisBlock(activeAnswer = queryAnswer) {
      const base = W.snapshotBlock(state(activeAnswer?.runtimeContext || context), { ...(activeAnswer?.workspaceContext || workspaceContext), resultView: activeAnswer?.spec.resultMode || workspaceResultMode().id }, module.id, `${businessName(scenarioId)}分析`);
      if (activeAnswer) return { ...base, title: activeAnswer.title, text: activeAnswer.summary, rows: clone(activeAnswer.rows), resultMode: activeAnswer.spec.resultMode };
      if (module.id === "query") {
        const run = readCurrentQueryRun()?.run;
        if (run?.result) return { ...base, title: run.result.title || run.question || "问数分析", text: run.result.summary || "", resultMode: "formal", resultId: run.id, modelVersionId: null, dataVersionId: run.context?.dataVersion || null, ontologyVersionId: run.context?.versionId || run.context?.semanticVersion || null, workspaceContext: queryRunWorkspacePatch(), rows: (run.result.highlights || run.result.rows || []).map((row) => ({ name: row.label || row.object || row.name || row.title || row.id, value: row.value ?? row.display ?? row.detail ?? "暂无", unit: "" })), evidenceRefs: (run.result.evidenceReferences || []).map((item) => item.evidenceId || item.ref).filter(Boolean) };
      }
      if (agentResult) return { ...base, title: `${agentResult.name} · 结果解释`, text: agentResult.summary, evidenceRefs: agentResult.evidence.split(" · ") };
      return base;
    }

    function addWorkspaceContextToReport() {
      createReportDraft();
      render();
      reportDrawer();
    }

    function reportDrawer() {
      reportDraft = W.readReport(scenarioId);
      reportEditor.open();
    }

    function renderReport() {
      if (!/^#\/catalog(?:$|[?])/.test(win.location.hash)) return;
      const actions = doc.querySelector(".page-head .head-actions");
      if (actions && !actions.querySelector("[data-ofw-native-action='report-add-context']")) {
        const contextButton = doc.createElement("button");
        contextButton.type = "button";
        contextButton.className = "btn primary";
        contextButton.dataset.ofwNativeAction = "report-add-context";
        contextButton.textContent = reportDraft?.workspaceSummary ? "更新报告上下文" : "将当前上下文加入报告";
        actions.insertBefore(contextButton, actions.firstChild);
      }
      if (actions && !actions.querySelector("[data-ofw-native-action='report-open']")) {
        const button = doc.createElement("button");
        button.type = "button";
        button.className = "btn";
        button.dataset.ofwNativeAction = "report-open";
        button.textContent = reportDraft ? "查看模型监测草稿" : "生成模型监测报告";
        actions.insertBefore(button, actions.firstChild);
      }
      doc.querySelector("[data-ofw-native-report]")?.remove();
      if (!reportDraft) return;
      const first = doc.querySelector("article.resource-row.canonical-ledger-row");
      const list = first?.parentElement;
      if (!list) return;
      const row = doc.createElement("article");
      row.className = "resource-row canonical-ledger-row ofw-native-report-row";
      row.dataset.ofwNativeReport = scenarioId;
      row.innerHTML = `<div class="ledger-primary"><span class="eyebrow">模型监测草稿</span><strong>${esc(reportDraft.title)}</strong><small>${esc(reportDraft.reportId)} · ${esc(context?.ui?.businessName || scenarioId)}</small></div><div class="resource-meta"><span>报告范围</span><strong>${esc(reportDraft.workspaceContext?.objectSet?.label || reportDraft.workspaceContext?.objectSetRef?.title || "当前业务范围")}</strong><small>${esc(reportDraft.workspaceContext?.object?.label || "未聚焦单个对象")}</small></div><div class="resource-meta"><span>时间 / 结果</span><strong>${esc(reportDraft.workspaceContext?.timeRange?.label || state().scenario?.dataAsOf || "当前周期")}</strong><small>${esc(reportDraft.workspaceContext?.resultMode?.label || W.modes[W.normalizeMode(reportDraft.resultMode)])}</small></div><div class="resource-meta"><span>形成时间</span><strong>${esc(reportDraft.formedAt.replace("T", " ").slice(0, 16))}</strong></div><div class="ledger-state"><span class="badge warning">待复核</span></div><div class="inline-actions"><button class="text-btn" type="button" data-ofw-native-action="report-open">查看详情</button></div>`;
      list.prepend(row);
    }

    function dashboardEnvelope(view) {
      if (view === "formal") return state().results?.formalEnvelope || state().formalBaseline?.resultEnvelope || null;
      if (view === "candidate" || view === "difference") return state().results?.candidateEnvelope || null;
      if (view === "shadow") return state().results?.shadowEnvelope || null;
      if (view === "simulation") return state().results?.simulationEnvelope || null;
      return null;
    }

    function dashboardRows(view) {
      const rows = normalizedSubjects(dashboardEnvelope(view));
      if (view === "difference") {
        return rows
          .filter((item) => item.delta != null)
          .sort((left, right) => Math.abs(Number(right.delta)) - Math.abs(Number(left.delta)))
          .map((item) => ({
            name: item.name,
            primary: `正式 ${fmt(item.formalScore, 1)}`,
            secondary: `候选 ${fmt(item.score, 1)}`,
            tertiary: `${Number(item.delta) >= 0 ? "+" : ""}${fmt(item.delta, 1)}`
          }));
      }
      return rows.map((item) => ({
        name: item.name,
        primary: item.score == null ? "无法评价" : fmt(item.score, 1),
        secondary: item.tier,
        tertiary: confidenceText(item)
      }));
    }

    function dashboardDrawer() {
      const views = [
        ["formal", "正式结果"],
        ["candidate", "候选试算"],
        ["shadow", "影子观察"],
        ["simulation", "压力模拟"],
        ["difference", "正式与候选差异"]
      ];
      const envelope = dashboardEnvelope(dashboardView);
      const rows = dashboardRows(dashboardView);
      const activeLabel = views.find(([id]) => id === dashboardView)?.[1] || "模型结果";
      const resultKind = (({ FACT: "正式事实", DEMO_BASELINE: "演示基准 · 无正式评分", PREDICTION: "候选预测", SHADOW: "影子观察", SIMULATION: "压力模拟" })[envelope?.resultKind] || "模型结果") + (envelope?.dataOrigin === "SYNTHETIC" ? " · 合成演示数据" : "");
      const body = `<div class="ofw-native-dashboard-tabs">${views.map(([id, label]) => `<button type="button" class="${dashboardView === id ? "active" : ""}" data-ofw-native-action="dashboard-view" data-view="${id}">${label}</button>`).join("")}</div><div class="ofw-native-dashboard-summary"><strong>${esc(activeLabel)}</strong><span>${envelope ? `${rows.length} 个业务对象 · ${esc(resultKind)}` : "当前周期尚未形成该结果，正式结果仍保持只读。"}</span></div>${rows.length ? `<div class="ofw-native-query-table">${rows.map((item) => `<div class="ofw-native-query-row"><strong>${esc(item.name)}</strong><span>${esc(item.primary)}</span><span>${esc(item.secondary)}</span><span>${esc(item.tertiary)}</span></div>`).join("")}</div>` : `<div class="ofw-native-note">${dashboardView === "formal" ? "当前场景没有可读取的正式基线结果。" : "请先在模型目标与优化完成对应运行。"}</div>`}<div class="ofw-native-query-evidence">${esc(envelope?.resultId || state().results?.resultPackage?.resultPackageId || "当前结果包尚未形成")}</div>`;
      const footer = envelope ? `<button class="ofw-native-action primary" type="button" data-ofw-native-route="#module/report">加入报告</button>` : dashboardView === "formal" ? "" : `<button class="ofw-native-action primary" type="button" data-ofw-native-route="#module/modeling">进入模型目标与优化</button>`;
      openDrawer(`${context?.ui?.businessName || scenarioId}模型结果`, `${scenarioId} · 仪表盘`, body, footer);
    }

    function renderDashboard() {
      syncDashboardWorkspaceContext();
      const isDirectory = /^#\/?dashboards(?:$|[?&])/.test(win.location.hash || "");
      doc.querySelectorAll("[data-ofw-native-action='dashboard-open']").forEach((button) => {
        if (button.dataset.ofwNativeInjected === "true" && isDirectory) button.remove();
      });
      if (isDirectory) return;
      const actions = doc.querySelector(".page-head .head-actions,.dashboard-head .head-actions,.dashboard-header .head-actions");
      if (!actions || actions.querySelector("[data-ofw-native-action='dashboard-open']")) return;
      const button = doc.createElement("button");
      button.type = "button";
      button.className = "btn";
      button.dataset.ofwNativeAction = "dashboard-open";
      button.dataset.ofwNativeInjected = "true";
      button.textContent = "结果视图";
      actions.insertBefore(button, actions.firstChild);
    }

    function render() {
      if (destroyed || !frame.isConnected || !doc.body) return;
      ensureStyle();
      renderWorkspaceContextBar();
      const oldStart = doc.querySelector(".modern-start");
      if (oldStart && !queryAnswer && !queryRunning) oldStart.hidden = false;
      if (module.id === "data") renderData();
      if (module.id === "ontology") renderOntology();
      if (module.id === "query") renderQuery();
      if (module.id === "decision") renderDecision();
      if (module.id === "agent") renderAgent();
      if (module.id === "report") renderReport();
      if (module.id === "dashboard") renderDashboard();
      onViewReady?.();
    }

    function scheduleRender() {
      global.clearTimeout(timer);
      timer = global.setTimeout(render, 90);
    }

    async function load() {
      try {
        if (["data", "ontology"].includes(module.id)) {
          const results = await Promise.allSettled(PORTFOLIO_SCENARIO_IDS.map((targetScenarioId) => request(`/v1/model-management/context?scenarioId=${encodeURIComponent(targetScenarioId)}`)));
          results.forEach((result, index) => {
            if (result.status === "fulfilled") portfolioContexts.set(PORTFOLIO_SCENARIO_IDS[index], result.value);
          });
          context = portfolioContexts.get(scenarioId) || results.find((result) => result.status === "fulfilled")?.value;
          if (!context) throw new Error("模型数据与语义资源目录暂时不可读取");
        } else {
          context = await request(`/v1/model-management/context?scenarioId=${encodeURIComponent(scenarioId)}`);
          portfolioContexts.set(scenarioId, context);
        }
        if (destroyed) return;
        onState?.(context.state);
      } catch (error) {
        if (destroyed) return;
        context = { state: {}, ui: { businessName: scenarioId }, loadError: `${error.code || "LOAD_FAILED"} · ${error.message}` };
      }
      render();
      scheduleQueryDecorations();
      global.setTimeout(render, 180);
      global.setTimeout(render, 650);
      global.setTimeout(render, 1250);
    }

    doc.addEventListener("click", (event) => {
      if (destroyed || reportEditor.handle(event)) return;
      const rawButton = event.target.closest("button");
      if (module.id === "query" && rawButton && !rawButton.dataset.ofwNativeAction && /发起(?:行动)?申请/.test(rawButton.textContent || "")) {
        const targetLabel = rawButton.closest(".modern-action-item,.rule-action-item")?.querySelector("strong")?.textContent || "";
        const targetStableId = /单位\s*(553|465|561)/.exec(targetLabel)?.[1];
        event.preventDefault();
        event.stopImmediatePropagation();
        openQueryActionFlow(targetStableId ? `UNIT-${targetStableId}` : null);
        return;
      }
      const routeButton = event.target.closest("[data-ofw-native-route]");
      if (routeButton) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (routeButton.dataset.ofwNativeRoute === "#module/report") {
          const activeAnswer = routeButton.dataset.contextSource !== "query-run" && (routeButton.dataset.contextSource === "query-answer" || module.id === "query" && doc.querySelector("#ofw-native-query-answer")) ? queryAnswer : null;
          const block = captureAnalysisBlock(activeAnswer);
          const reportScenarioId = activeAnswer?.queryScenarioId || (module.id === "query" ? readCurrentQueryRun()?.run?.context?.scenarioId : null) || scenarioId;
          W.appendBlock(reportScenarioId, block);
          if (module.id === "query") publishWorkspaceContext({ ...clone(block.workspaceContext || {}), scenarioId: reportScenarioId, source: { moduleId: "query" } });
        }
        if (routeButton.dataset.contextSource === "query-answer" && routeButton.dataset.ofwNativeRoute === "#module/m07") publishWorkspaceContext(queryWorkspacePatch());
        if (routeButton.dataset.contextSource === "query-run" && routeButton.dataset.ofwNativeRoute !== "#module/report") publishWorkspaceContext(queryRunWorkspacePatch());
        navigate?.(routeButton.dataset.ofwNativeRoute);
        return;
      }
      const button = event.target.closest("[data-ofw-native-action],[data-ofw-model-question]");
      if (!button) {
        if (module.id === "data") global.setTimeout(refreshDataSourcePortfolio, 0);
        if (module.id === "query") scheduleQueryDecorations();
        else scheduleRender();
        return;
      }
      const action = button.dataset.ofwNativeAction;
      if (button.dataset.ofwModelQuestion) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const question = button.dataset.ofwModelQuestion;
        void executeQuestion(question, button.dataset.ofwQuestionScenario || scenarioId);
        return;
      }
      if (action === "query-scenario") {
        event.preventDefault();
        event.stopImmediatePropagation();
        const target = button.dataset.queryScenario;
        if (QUERY_SCENARIOS.some((item) => item.id === target)) queryRecommendationScenario = target;
        const grid = doc.querySelector(".modern-question-grid");
        if (grid) applyQueryRecommendationFilter(grid);
        return;
      }
      if (action === "query-action-close") {
        if (button.classList.contains("ofw-action-backdrop") && event.target !== button) return;
        closeQueryActionFlow();
        return;
      }
      if (action === "query-action-open") { openQueryActionFlow(button.dataset.targetStableId || null); return; }
      if (action === "query-action-submit") { submitQueryActionFlow(); return; }
      if (action === "decision-ops-filter") {
        decisionOpsFilter = button.dataset.filter || "all";
        renderDecisionOperations();
        return;
      }
      if (action === "decision-ops-open") { decisionOperationsDrawer(button.dataset.recordId); return; }
      if (action === "decision-open-record") {
        const route = button.dataset.decisionRoute || "";
        if (/^(request|reminder|task|trace\/request)\/[^/]+$/.test(route)) { decisionReturnRoute = win.location.hash; closeDrawer(); win.location.hash = `#${route}`; }
        return;
      }
      if (action === "decision-return-tracking") { win.location.hash = decisionReturnRoute || "#overview"; return; }
      if (action === "decision-open-workbench") {
        closeDrawer();
        win.location.hash = "#workbench";
        return;
      }
      if (action === "close-drawer") { if (button.classList.contains("ofw-native-drawer-backdrop") && event.target !== button) return; closeDrawer(); return; }
      if (action === "data-layer") {
        const hash = button.dataset.localHash || "#/resources";
        const target = button.dataset.targetSelector;
        if (win.location.hash === hash || win.location.hash.split("?")[0] === hash.split("?")[0]) doc.querySelector(target)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
        else win.location.hash = hash;
        return;
      }
      if (action === "data-open") {
        const targetScenarioId = button.dataset.scenarioId || scenarioId;
        const current = state(portfolioContext(targetScenarioId));
        publishWorkspaceContext({ objectSet: { id: current.data?.dataVersionId || targetScenarioId, label: DATA_ASSET_NAMES[targetScenarioId], count: current.data?.enterpriseCount || current.data?.subjectCount || 0 }, timeRange: { end: current.data?.observationRange?.end || current.scenario?.dataAsOf || "", label: current.data?.observationRange?.end || current.scenario?.dataAsOf ? `截至 ${current.data?.observationRange?.end || current.scenario?.dataAsOf}` : "当前周期" }, source: { moduleId: "data", resourceId: current.data?.dataVersionId || "" } });
        dataDrawer(targetScenarioId);
        return;
      }
      if (action === "ontology-open") {
        const targetScenarioId = button.dataset.scenarioId || scenarioId;
        const current = state(portfolioContext(targetScenarioId));
        publishWorkspaceContext({ objectSet: { id: current.semanticContract?.semanticContractVersionId || targetScenarioId, label: SEMANTIC_CONTRACT_NAMES[targetScenarioId], count: current.semanticContract?.objectTypes?.length || 0 }, source: { moduleId: "ontology", resourceId: current.semanticContract?.semanticContractVersionId || "" } });
        ontologyDrawer(targetScenarioId);
        return;
      }
      if (action === "runtime") {
        const targetScenarioId = button.dataset.scenarioId || (module.id === "data" ? selectedDataScenarioId : selectedOntologyScenarioId) || scenarioId;
        void (async () => {
          await runAction(button.dataset.operation, {}, targetScenarioId);
          if (targetScenarioId === "S005" && module.id === "data" && button.dataset.operation === "freeze-data" && scenarioAction("source_delivery")?.enabled) await runScenario("source_delivery");
          if (targetScenarioId === "S005" && module.id === "ontology" && button.dataset.operation === "create-contract" && scenarioAction("semantic_candidate")?.enabled) await runScenario("semantic_candidate");
          if (module.id === "data") dataDrawer(targetScenarioId);
          else ontologyDrawer(targetScenarioId);
        })();
        return;
      }
      if (action === "scenario-runtime") { void runScenario(button.dataset.operation).then(() => module.id === "data" ? dataDrawer() : module.id === "ontology" ? ontologyDrawer() : render()); return; }
      if (action === "query-new") { resetQuery(); return; }
      if (action === "query-clear-scope") {
        publishWorkspaceContext({ activeObjectRef: null, objectSetRef: null, object: null, objectSet: null, analysisScope: "all", source: { moduleId: "query" } });
        return;
      }
      if (action === "query-detail") { queryDetailDrawer(); return; }
      if (action === "query-export") { exportQueryAnswer(); return; }
      if (action === "query-history-open") {
        const entry = W.readQueryHistory().find((item) => item.id === button.dataset.historyId);
        if (entry) { queryAnswer = clone(entry.answer); queryDetailDrawer(); }
        return;
      }
      if (action === "query-focus-object") {
        publishWorkspaceContext({ object: { id: button.dataset.objectId || "", label: button.dataset.objectLabel || button.dataset.objectId || "业务对象", type: button.dataset.objectType || "业务对象" }, source: { moduleId: "query", question: queryAnswer?.question || "" } });
        return;
      }
      if (action === "agent-open") { agentDrawer(); return; }
      if (action === "agent-run") {
        void (async () => {
          if (scenarioId === "S005" && scenarioAction("risk_explanation")?.enabled) await runScenario("risk_explanation");
          const item = scopedSubjects().find((entry) => entry.id === selectedSubjectId);
          if (item) {
            publishWorkspaceContext({ object: { id: item.id, label: item.name, type: context?.ui?.subjectLabel || "业务对象" }, source: { moduleId: "agent", task: "result-explanation" } });
            agentResult = { name: item.name, summary: `${item.name}当前${W.modes[workspaceResultMode().id] || "结果"}为${item.score == null ? "无法评价" : fmt(item.score, 2)}，${item.formalScore == null ? "未提供正式对照" : `与正式结果相差 ${fmt(item.delta, 2)}`}；置信度为${confidenceText(item)}${item.missingReasons.length ? `，缺失原因：${item.missingReasons.join("；")}` : ""}。`, evidence: item.evidenceRefs.join(" · ") || state().results?.resultPackage?.resultPackageId || "未提供证据" };
          }
          else if (scenarioId === "S005" && scenarioOutput("risk_explanation")) agentResult = { name: "投后评价解释", summary: "当前评价结果保持只读；证据不足的久期、评级迁移、穿透集中度、流动性和收益归因继续显示无法评价。", evidence: scenarioOutput("risk_explanation")?.evidenceRefs?.join(" · ") || "当前评价运行" };
          agentDrawer();
        })();
        return;
      }
      if (action === "report-open") { reportDrawer(); return; }
      if (action === "report-add-context") { addWorkspaceContextToReport(); return; }
      if (action === "report-generate") {
        void (async () => {
          if (scenarioId === "S005" && scenarioAction("report_draft")?.enabled) await runScenario("report_draft");
          createReportDraft();
          render();
          reportDrawer();
        })();
        return;
      }
      if (action === "dashboard-open") { dashboardDrawer(); return; }
      if (action === "dashboard-view") { dashboardView = button.dataset.view || "formal"; publishWorkspaceContext({ resultMode: { id: dashboardView, label: RESULT_MODE_LABELS[dashboardView] || "当前结果" } }); dashboardDrawer(); return; }
      scheduleRender();
    }, { capture: true, signal: lifetime.signal });

    doc.addEventListener("change", (event) => {
      if (event.target.matches("[data-report-field],[data-report-title]")) { reportEditor.captureFields(); return; }
      if (event.target.matches("[data-query-action-confirm]")) {
        const submit = doc.querySelector('[data-ofw-native-action="query-action-submit"]');
        if (submit) submit.disabled = !event.target.checked;
        return;
      }
      if (event.target.matches("[data-ofw-native-subject]")) {
        selectedSubjectId = event.target.value;
        agentResult = null;
        agentDrawer();
      }
      scheduleRender();
    }, { capture: true, signal: lifetime.signal });

    doc.addEventListener("input", (event) => {
      const follow = event.target.closest(".modern-follow-composer");
      if (follow) follow.querySelector("button[type=submit]").disabled = !event.target.value.trim();
      if (event.target.closest(".modern-start")) global.requestAnimationFrame(render);
    }, { capture: true, signal: lifetime.signal });

    doc.addEventListener("submit", (event) => {
      const form = event.target.closest(".modern-composer,.modern-follow-composer");
      if (!form) return;
      const input = form.querySelector("textarea,input");
      const question = input?.value?.trim();
      const matchedScenario = Object.entries(MODEL_QUESTIONS).find(([, items]) => items.some((item) => item.question === question))?.[0] || scenarioId;
      const spec = questionSpec(question, matchedScenario);
      if (!spec) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void executeQuestion(question, matchedScenario);
    }, { capture: true, signal: lifetime.signal });

    function acceptWorkspaceBroadcast(payload) {
      const value = record(payload?.workspaceContext) || record(payload?.context) || record(payload?.detail?.workspaceContext) || record(payload?.detail) || record(payload);
      if (!value) return;
      if (record(payload?.patch)) publishWorkspaceContext(payload.patch);
      else setWorkspaceContext(value, workspaceUpdater);
    }

    function onWorkspaceContextEvent(event) {
      acceptWorkspaceBroadcast(event?.detail || event);
    }

    function onWorkspaceContextMessage(event) {
      if (event?.data?.type !== "OFW_WORKSPACE_CONTEXT") return;
      if (event.source && event.source !== win.parent) return;
      acceptWorkspaceBroadcast(event.data);
    }

    win.addEventListener("OFW_WORKSPACE_CONTEXT", onWorkspaceContextEvent);
    win.addEventListener("message", onWorkspaceContextMessage);
    win.addEventListener("hashchange", () => { scheduleRender(); scheduleQueryDecorations(); }, { signal: lifetime.signal });
    const api = Object.freeze({
      refresh: load,
      setWorkspaceContext,
      updateWorkspaceContext: publishWorkspaceContext,
      getWorkspaceContext: resolvedWorkspaceContext,
      destroy() {
        cancelQueryRecord("切换工作区后查询已取消，未形成结果。");
        reportEditor.captureFields();
        destroyed = true;
        lifetime.abort();
        queryEpoch += 1;
        clearQueryTimers();
        queryDecorationTimers.forEach((timerId) => global.clearTimeout(timerId));
        queryDecorationTimers = [];
        global.clearTimeout(timer);
        win.removeEventListener("OFW_WORKSPACE_CONTEXT", onWorkspaceContextEvent);
        win.removeEventListener("message", onWorkspaceContextMessage);
        closeDrawer();
        closeQueryActionFlow();
        doc.querySelectorAll("[data-ofw-workspace-context],[data-ofw-data-lineage],[data-ofw-ontology-overview],[data-ofw-task-result-board]").forEach((item) => item.remove());
        delete win.__OFW_NATIVE_MODULE_INTEGRATION__;
      }
    });
    win.__OFW_NATIVE_MODULE_INTEGRATION__ = api;
    render();
    void load();
    return api;
  }

  global.OFW_NATIVE_MODULE_INTEGRATIONS = Object.freeze({ mount, supportedModuleIds: Object.freeze([...MODULES]) });
})(window);
