(() => {
  "use strict";

  const {
    Icon, Button, IconButton, Badge, StatusBadge, Modal, Drawer, Notice,
    EmptyState, PageHeader, Tabs, Segmented, DisplayModeSwitch, Fact, FactGrid,
    Skeleton, Progress, DataTable, MiniChart, EvidenceList, ResourceChip,
    ContextBar, ToastRegion, getChartApplicability
  } = window.IQComponents;
  const D = window.IQDomain;
  const VARIANT = window.IQ_VARIANT || { id: "conversation", name: "对话工作区", storageKey: "ontology3.iq.review.default.v1" };

  const ROUTES = {
    ask: { label: "问数工作台", icon: "message-square-text" },
    semantics: { label: "语义资源", icon: "library-big" },
    history: { label: "历史会话", icon: "history" },
    views: { label: "问数视图", icon: "panels-top-left" },
    agent: { label: "Agent 配置", icon: "bot" }
  };
  const RUN_STEPS = ["确认问题范围", "装配运行上下文", "生成查询计划", "执行语义查询", "核验证据", "组织回答"];
  const CHART_OPTIONS = [
    { id: "recommended", label: "系统推荐", icon: "sparkles" },
    { id: "metric", label: "指标卡", icon: "square-equal" },
    { id: "horizontal-bar", label: "横向柱状图", icon: "chart-bar-big" },
    { id: "vertical-bar", label: "纵向柱状图", icon: "chart-column-big" },
    { id: "stacked-bar", label: "堆叠柱状图", icon: "chart-bar-stacked" },
    { id: "donut", label: "环形图", icon: "chart-pie" }
  ];
  const DISPLAY_MODE_LABELS = { text: "文字解读", table: "数据表", chart: "BI 图表" };
  const CHART_TYPE_LABELS = {
    recommended: "系统推荐", metric: "指标卡", bar: "横向柱状图", "horizontal-bar": "横向柱状图",
    "vertical-bar": "纵向柱状图", stacked: "堆叠柱状图", "stacked-bar": "堆叠柱状图", donut: "环形图"
  };
  const displayModeLabel = (value) => DISPLAY_MODE_LABELS[value] || "文字解读";
  const chartTypeLabel = (value) => CHART_TYPE_LABELS[value] || "系统推荐";
  const WAIT = 420;
  let operationEpoch = 0;
  const beginAsync = () => operationEpoch;
  const asyncIsCurrent = (epoch) => epoch === operationEpoch;
  const invalidateAsync = () => { operationEpoch += 1; };

  const clone = D.clone;
  const now = D.nowText;
  const configForScenario = (config, scenarioContext = null) => ({
    ...config,
    sceneId: scenarioContext?.id || config?.sceneId || null,
    sceneVersion: scenarioContext?.version || config?.sceneVersion || null,
    sceneVersionStatus: scenarioContext?.status || config?.sceneVersionStatus || "场景版本待读取"
  });
  const runtimeForScenario = (state, config = state.activeConfig) => {
    const scopedConfig = configForScenario(config, state.scenarioContext);
    return D.projectRuntimeContextForScenario(D.readRuntimeContext(), state.scenarioContext, scopedConfig);
  };
  const candidateForScenario = (state, config = state.activeConfig, candidateContext = null) => {
    const scopedConfig = configForScenario(config, state.scenarioContext);
    const scoped = D.attachScenarioContext(candidateContext || D.readCandidateConsumptionContext(), state.scenarioContext, scopedConfig);
    if (!scoped?.ready) return scoped;
    const scenarioReady = Boolean(scoped.scenarioId && scoped.scenarioVersion && scopedConfig.sceneId === scoped.scenarioId && scopedConfig.sceneVersion === scoped.scenarioVersion);
    return scenarioReady ? scoped : {
      ...scoped,
      ready: false,
      status: "场景版本待确认",
      reason: "候选验证缺少同一场景身份与场景版本",
      recovery: "由平台场景清单提供精确场景版本，并在问数 Agent 配置中固定后重新读取。"
    };
  };
  const agentConfigInputFingerprint = (config) => JSON.stringify({
    id: config?.id || null,
    version: config?.version || null,
    promptVersion: config?.promptVersion || null,
    whitelistVersion: config?.whitelistVersion || null,
    contentFingerprint: config?.contentFingerprint || null,
    sceneId: config?.sceneId || null,
    sceneVersion: config?.sceneVersion || null,
    sceneVersionStatus: config?.sceneVersionStatus || null
  });
  const candidateValidationInputFingerprint = (context, config) => JSON.stringify({
    candidateInputFingerprint: context?.inputFingerprint || null,
    scenarioId: context?.scenarioId || null,
    scenarioVersion: context?.scenarioVersion || null,
    scenarioReferenceStatus: context?.scenarioReferenceStatus || null,
    configSnapshot: agentConfigInputFingerprint(config)
  });
  const allRuns = (state) => [...(state.liveRuns || []), ...(state.historyRuns || [])];
  const toneFor = (value) => {
    const text = String(value || "");
    if (/成功|已启用|可运行|可消费|已接收|已加载|完整|已发布|当前/.test(text)) return "success";
    if (/失败|阻断|不可消费|错配|版本不一致|已废弃|缺失/.test(text)) return "danger";
    if (/处理中|验证中|候选|待启用|正在/.test(text)) return "info";
    if (/警告|陈旧|上一可信|需修订|待确认|命中/.test(text)) return "warning";
    return "neutral";
  };
  const routeState = () => {
    const raw = (location.hash || "#/ask").replace(/^#\/?/, "");
    const [path, query = ""] = raw.split("?");
    const parts = path.split("/").filter(Boolean);
    return { page: ROUTES[parts[0]] ? parts[0] : "ask", id: parts[1] || null, params: new URLSearchParams(query) };
  };
  const go = (page, id = null, params = null) => {
    const query = params && [...params.entries()].length ? `?${params.toString()}` : "";
    location.hash = `#/${page}${id ? `/${encodeURIComponent(id)}` : ""}${query}`;
  };
  const resourceFor = (context, resourceId) => D.resourceFromContext(context, resourceId);
  const questionResourceNames = (item, context = null) => item.resources.map((id) => resourceFor(context, id)?.name || id).join("、");
  const ambiguousUnit55Pattern = /单位\s*55(?!\d)/;
  const hasAmbiguousUnit55 = (text) => ambiguousUnit55Pattern.test(String(text || ""));
  const replaceAmbiguousUnit55 = (text, selected) => String(text || "").replace(ambiguousUnit55Pattern, selected);
  const makeEvidence = (run) => {
    const rows = (run.result?.rows || []).map((row, index) => ({
    id: row.evidenceId || null,
    title: `${row.object} · ${row.label}`,
    summary: `${row.exact}${row.unit || ""} · ${row.status}`,
    type: resourceFor(run.context, row.resourceId)?.type || "语义结果",
    source: row.resourceId,
    version: run.context?.semanticVersion,
    asOf: run.context?.asOf,
    status: row.status,
    resourceId: row.resourceId,
    rowId: row.id,
    detail: row.detail,
    warning: row.warning
    }));
    const known = new Set(rows.map((item) => item.id).filter(Boolean));
    const extra = (run.result?.evidenceReferences || []).filter((item) => item.evidenceId && !known.has(item.evidenceId)).map((item) => ({
      id: item.evidenceId,
      title: `${item.object ? `${item.object} · ` : ""}${item.label || item.type || "补充证据"}`,
      summary: item.exact !== undefined ? `${item.exact}${item.unit || ""} · ${item.status || "可追溯"}` : "属于本轮固定对象范围与证据映射",
      type: item.type || "补充证据",
      source: item.resourceId,
      version: run.context?.semanticVersion,
      asOf: run.context?.asOf,
      status: "可追溯",
      resourceId: item.resourceId,
      rowId: item.resultItemId,
      detail: item.detail || "该引用与本轮固定结构化结果、双版本和对象范围一并保存。"
    }));
    return [...rows, ...extra];
  };
  const getRun = (state, id) => allRuns(state).find((run) => run.id === id) || null;
  const clearPendingViewRun = (state) => ({ ...state, pendingViewRun: null });
  const updateRun = (state, id, updater) => ({
    ...state,
    liveRuns: state.liveRuns.map((run) => run.id === id ? updater(run) : run),
    historyRuns: state.historyRuns.map((run) => run.id === id ? updater(run) : run)
  });
  const chartToken = (type) => ({
    "horizontal-bar": "bar", "vertical-bar": "bar", "stacked-bar": "stacked"
  }[type] || type);
  const chartType = (type) => ({ bar: "horizontal-bar", stacked: "stacked-bar" }[type] || type);
  const chartLabel = (type) => type === "table" ? "数据表" : chartTypeLabel(type);
  const applicableNextQuestions = (run) => (run?.result?.nextQuestions || []).filter((question) => {
    const currentCodes = D.referencedUnitCodes((run?.result?.scope || []).join("、"));
    if (/第三家.*加入|加入.*第三家/.test(question)) return currentCodes.length === 2 && ["553", "465", "561"].filter((code) => !currentCodes.includes(code)).length === 1;
    const removed = question.match(/去掉单位\s*(553|465|561)/);
    if (removed) return currentCodes.length > 1 && currentCodes.includes(removed[1]);
    if (/(?:三家|这些单位).*(?:规则|命中)|(?:规则|命中).*(?:三家|这些单位)/.test(question)) return currentCodes.length === 3;
    const templateId = D.resolveQuestion(question);
    const unitCodes = D.referencedUnitCodes(question);
    if (!templateId || templateId === "trend-blocked") return false;
    if (templateId === "rule-explain" && unitCodes.length !== 3) return false;
    if (templateId === "institution-priority" && !unitCodes.includes("553")) return false;
    return true;
  });
  const chartRowFor = (result, label, index, explicitId) => {
    if (explicitId) return result.rows.find((row) => row.id === explicitId || row.evidenceId === explicitId) || null;
    return result.rows.find((row) => row.object === label || row.label === label || row.label?.includes(label) || label?.includes(row.label)) || result.rows[index] || null;
  };
  const chartView = (result, requestedType) => {
    if (!result?.chart) return { type: "table", data: [], series: [], unit: "", partToWhole: false };
    const requestedDisplay = requestedType === "recommended" ? (result.chart.recommended || "bar") : requestedType;
    const requested = chartToken(requestedDisplay);
    const resolvedDisplayType = requestedDisplay === "vertical-bar" ? "vertical-bar" : chartType(requested);
    const explicit = result.chart.views?.[requested] || result.chart.adapters?.[requested] || null;
    if (requested === "metric") {
      const metric = explicit?.items?.[0] || explicit || result.chart.metric || result.highlights?.[0];
      const row = chartRowFor(result, metric?.label, 0, metric?.rowId || metric?.evidenceId || metric?.id);
      return {
        type: "metric",
        unit: metric?.unit || row?.unit || "",
        partToWhole: false,
        series: [],
        data: metric ? [{ id: row?.id || metric.id || "metric", rowId: row?.id || metric.rowId || metric.id, evidenceId: row?.evidenceId || metric.evidenceId || null, label: metric.label, value: Number(metric.exact ?? metric.value), unit: metric.unit || row?.unit, status: row?.status || "可计算", displayValue: metric.value }] : []
      };
    }
    const source = explicit || result.chart;
    if (source.items?.length) {
      const data = source.items.map((item) => ({
        ...item,
        id: item.id || item.rowId,
        rowId: item.rowId || item.id,
        value: item.value === null || item.value === undefined ? null : Number(item.value),
        segments: (item.segments || []).map((segment) => ({ ...segment, value: Number(segment.value) }))
      }));
      const segmentLabels = source.segmentLabels || [...new Set(data.flatMap((item) => (item.segments || []).map((segment) => segment.label)))];
      return {
        type: resolvedDisplayType, data, unit: source.unit || "",
        series: requested === "stacked" ? segmentLabels.map((label, index) => ({ id: `segment-${index}`, key: `segment-${index}`, label })) : [],
        partToWhole: requested === "donut" || Boolean(source.composition),
        allowTopN: Boolean(source.allowTopN || result.chart.allowTopN),
        maxCategories: source.maxCategories || 6
      };
    }
    const categories = source.categories || [];
    const values = source.values || [];
    const stacks = source.stacks || [];
    const evidenceIds = source.evidenceIds || [];
    const labels = source.segmentLabels || result.chart.segmentLabels || ["浮动利率", "固定利率"];
    const data = categories.map((label, index) => {
      const row = chartRowFor(result, label, index, evidenceIds[index]);
      const segments = stacks[index]?.map((value, segmentIndex) => ({
        id: `${row?.id || `chart-${index}`}-segment-${segmentIndex}`,
        key: `segment-${segmentIndex}`,
        label: labels[segmentIndex] || `构成 ${segmentIndex + 1}`,
        value: Number(value),
        unit: source.segmentUnit || source.unit,
        evidenceId: row?.evidenceId || evidenceIds[index] || null
      }));
      return {
        id: row?.id || evidenceIds[index] || `chart-${index}`,
        rowId: row?.id || evidenceIds[index] || null,
        evidenceId: row?.evidenceId || evidenceIds[index] || null,
        label,
        value: requested === "stacked" && segments?.length ? segments.reduce((sum, segment) => sum + segment.value, 0) : Number(values[index]),
        unit: requested === "stacked" ? (source.segmentUnit || source.unit) : source.unit,
        status: row?.status || "可计算",
        segments
      };
    });
    return {
      type: resolvedDisplayType, data,
      unit: requested === "stacked" ? (source.segmentUnit || source.unit || "") : (source.unit || ""),
      series: requested === "stacked" ? labels.map((label, index) => ({ id: `segment-${index}`, key: `segment-${index}`, label })) : [],
      partToWhole: requested === "donut" || Boolean(source.composition),
      allowTopN: Boolean(source.allowTopN || result.chart.allowTopN),
      maxCategories: source.maxCategories || 6
    };
  };
  const resultColumns = [
    { key: "object", label: "业务对象" },
    { key: "label", label: "指标 / 规则 / 关系" },
    { key: "exact", label: "精确值", align: "right" },
    { key: "unit", label: "单位" },
    { key: "status", label: "业务状态", render: (value) => <StatusBadge status={value} /> },
    { key: "evidence", label: "证据", render: (value) => <span className="evidence-ref"><Icon name="file-check-2" size={13} />{value}</span> }
  ];
  const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csvEligibility = (run, scenarioContext = null) => D.csvEligibility(run, scenarioContext);
  const viewRuntimeState = (view, semanticContext = D.readPublishedOntologyContext(), config = D.ACTIVE_CONFIG, scenarioContext = null) => {
    if (!view) return { status: "需修订", reason: "视图不可定位" };
    if (view.status === "需修订") return { status: "需修订", reason: view.issue || "稳定语义资源引用需要修订" };
    const savedScenarioId = view.queryDefinition?.sceneId || null;
    const savedScenarioVersion = view.queryDefinition?.sceneVersion || null;
    const currentScenarioId = scenarioContext?.id || config?.sceneId || null;
    const currentScenarioVersion = scenarioContext?.version || config?.sceneVersion || null;
    if (!currentScenarioId || !currentScenarioVersion) return { status: "等待上下文", reason: "平台场景清单尚未提供当前场景身份与版本" };
    if (!savedScenarioId || !savedScenarioVersion) return { status: "需修订", reason: "视图保存时未固定场景身份与版本，不能自动映射到当前场景" };
    if (savedScenarioId !== currentScenarioId || savedScenarioVersion !== currentScenarioVersion) return { status: "需修订", reason: "视图保存时的场景版本与当前场景不同，请核对后重新保存" };
    if (!semanticContext?.discoverable) return { status: "等待上下文", reason: semanticContext?.reason || "尚无可发现的精确已发布语义版本" };
    const currentIds = new Set((semanticContext?.resources || []).map((item) => item.id));
    const missing = (view.queryDefinition?.resourceIds || []).filter((id) => !currentIds.has(id));
    if (missing.length) return { status: "需修订", reason: `${missing.length} 项关联资源在当前精确版本中不可定位，请重新确认对应资源。` };
    if (view.semanticVersionId && semanticContext?.versionId && view.semanticVersionId !== semanticContext.versionId) {
      return { status: "需修订", reason: "视图保存时的精确语义版本与当前版本不同；需逐项确认稳定身份。" };
    }
    if (view.resourceContractFingerprint && semanticContext?.resourceContractFingerprint && view.resourceContractFingerprint !== semanticContext.resourceContractFingerprint) {
      return { status: "需修订", reason: "已发布资源的单位、范围、依赖或关系定义已变化；需逐项核对后再运行。" };
    }
    if (semanticContext?.formalAnswerable !== true) return { status: "等待上下文", reason: semanticContext?.answerabilityReason || "精确已发布资源可查看，但当前尚未形成可正式回答的权威组合。" };
    const runtimeContext = D.projectRuntimeContextForScenario(D.readRuntimeContext(), scenarioContext, config);
    const configState = D.deriveConfigRuntimeState(config, runtimeContext, D.readOntologyBindingContext());
    if (configState.status !== "兼容") return { status: "等待上下文", reason: configState.reason || "问数 Agent 配置尚未通过完整运行门禁。" };
    return { status: "可运行", reason: "查询定义中的稳定资源仍可精确定位" };
  };
  const pinEligibility = (run, view, scenarioContext = null) => {
    if (!run || run.past || run.context?.past) return { allowed: false, reason: "需先按当前权威上下文重新运行视图" };
    if (run.status !== "成功" || !run.result) return { allowed: false, reason: "只有成功形成的当前固定结果可以提交" };
    const viewState = viewRuntimeState(view, undefined, run?.configSnapshot || D.ACTIVE_CONFIG, scenarioContext);
    if (viewState.status !== "可运行") return { allowed: false, reason: viewState.reason };
    if (view.queryDefinition?.sceneId !== run.context?.scenarioId || view.queryDefinition?.sceneVersion !== run.context?.scenarioVersion) return { allowed: false, reason: "问数视图与来源运行的场景身份或版本不一致" };
    if (!run.context?.ready || run.context?.allowConsumption !== true || !run.context?.evidenceComplete) return { allowed: false, reason: "双版本、数据可信度或证据不完整" };
    const current = D.projectRuntimeContextForScenario(D.readRuntimeContext(), scenarioContext, run?.configSnapshot || D.ACTIVE_CONFIG);
    if (!current?.ready || current.runtimeContextFingerprint !== run.context.runtimeContextFingerprint) return { allowed: false, reason: "当前权威上下文已变化，请重新运行后提交" };
    const verified = D.verifyFixedResult(run.result, run.context, run.configSnapshot);
    return verified.passed ? { allowed: true, reason: "" } : { allowed: false, reason: verified.issues[0] };
  };
  const createPinRecord = (prev, view, run, serialOffset = 1) => ({
    id: D.nextStableId("PIN"),
    viewId: view.id,
    title: view.name,
    status: "待接收",
    submittedAt: now(),
    receivedAt: null,
    note: "等待报告中心回执；仪表盘尚未发布",
    deliverySnapshot: {
      readOnly: true,
      snapshotStatus: "待报告中心接收",
      capturedAt: now(),
      queryDefinition: clone(view.queryDefinition),
      displaySuggestion: clone(view.displayPreference),
      fixedResult: clone(run.result),
      fixedResultIdentity: {
        runId: run.id,
        resultId: run.result.id,
        fixedResultId: run.result.fixedResultId
      },
      semanticVersion: run.context.semanticVersion,
      versionId: run.context.versionId,
      scenarioId: run.context.scenarioId,
      scenarioVersion: run.context.scenarioVersion,
      dataVersion: run.context.dataVersion,
      asOf: run.context.asOf,
      quality: run.context.quality,
      freshness: run.context.freshness,
      evidenceIds: makeEvidence(run).map((item) => item.id).filter(Boolean)
    }
  });
  const viewFromRun = (run, id, name, createdAt = now()) => {
    const baseDefinition = clone(run.queryDefinitionSnapshot || D.queryDefinition(run.templateId));
    return {
      id,
      name,
      question: run.question,
      templateId: run.templateId,
      status: "可运行",
      createdAt,
      semanticVersionId: run.context?.versionId || null,
      semanticVersion: run.context?.semanticVersion || null,
      resourceContractFingerprint: run.context?.resourceContractFingerprint || null,
      queryDefinition: {
        ...baseDefinition,
        sceneId: run.context?.scenarioId || baseDefinition.sceneId || null,
        sceneVersion: run.context?.scenarioVersion || baseDefinition.sceneVersion || null,
        objectScope: clone(run.result?.scope || baseDefinition.objectScope || []),
        resourceIds: clone(run.result?.resourceIds || baseDefinition.resourceIds || []),
        parameters: clone(run.queryContext || null)
      },
      displayPreference: {
        mode: run.display?.mode || "text",
        chart: chartType(run.display?.chart || "recommended"),
        legend: true,
        direction: baseDefinition.sorting || "业务默认"
      },
      lastRunId: run.id
    };
  };
  const downloadCsv = (run) => {
    const evidence = makeEvidence(run);
    const headers = ["业务对象", "资源类型", "稳定资源身份", "业务标签", "精确值", "单位", "业务状态", "业务提示", "证据编号", "已发布语义版本", "可消费数据版本", "数据截至时间", "生成时间", "质量状态", "新鲜度", "查询返回范围"];
    const rows = run.result.rows.map((row, index) => [
      row.object, resourceFor(run.context, row.resourceId)?.type || "语义结果", row.resourceId, row.label,
      row.exact, row.unit, row.status, row.warning || "", row.evidenceId || evidence[index]?.id, run.context.semanticVersion,
      run.context.dataVersion, run.context.asOf, run.completedAt, run.context.quality, run.context.freshness,
      run.result.queryDefinitionTopN ? `查询定义返回 Top ${run.result.queryDefinitionTopN}` : "当前查询完整结果"
    ]);
    const body = `\ufeff${[headers, ...rows].map((line) => line.map(csvCell).join(",")).join("\n")}`;
    const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
    const anchor = document.createElement("a");
    const objectUrl = URL.createObjectURL(blob);
    anchor.href = objectUrl;
    anchor.download = `${run.result.title}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  const isActionEligible = (run, scenarioContext = null) => {
    const target = run?.result?.scope?.length === 1 && run.result.scope[0] !== "集团" ? run.result.scope[0] : null;
    const actionResource = resourceFor(run?.context, "ACTION-FINANCING-OPTIMIZATION");
    const gate = D.actionEligibility(run, run?.configSnapshot, scenarioContext);
    return { eligible: gate.allowed, target, reasons: gate.allowed ? [] : [gate.reason], actionResource, actionContext: gate.actionContext };
  };

  function Shell({ state, route, navigate, onReset, onDataScenario, children }) {
    const context = D.readRuntimeContext();
    const scopedConfig = configForScenario(state.activeConfig, state.scenarioContext);
    const configState = D.deriveConfigRuntimeState(scopedConfig, runtimeForScenario(state, scopedConfig), D.readOntologyBindingContext());
    const totalRuns = allRuns(state).length;
    return <div className="app-shell">
      <aside className="platform-rail" aria-label="平台模块">
        <span className="platform-logo" title="智财问策"><Icon name="boxes" size={19} /></span>
        <span className="platform-static" title="平台总览（当前不可操作）" aria-label="平台总览，当前不可操作" aria-disabled="true"><Icon name="layout-dashboard" /></span>
        <button className="platform-button active" title="智能问数" onClick={() => navigate("ask")}><Icon name="messages-square" /></button>
        <span className="platform-static" title="决策中心（当前不可操作）" aria-label="决策中心，当前不可操作" aria-disabled="true"><Icon name="git-pull-request-arrow" /></span>
        <span className="platform-static" title="报告中心（当前不可操作）" aria-label="报告中心，当前不可操作" aria-disabled="true"><Icon name="chart-spline" /></span>
        <span className="platform-spacer"></span>
        <span className="platform-static" title="帮助（当前不可操作）" aria-label="帮助，当前不可操作" aria-disabled="true"><Icon name="circle-help" /></span>
      </aside>
      <aside className="product-nav">
        <div className="product-nav-head"><span><Icon name="messages-square" size={17} /></span><div><strong>智能问数</strong><small>{VARIANT.name}</small></div></div>
        <nav className="product-nav-list">
          <span className="product-nav-label">工作区</span>
          {Object.entries(ROUTES).map(([key, item]) => <button key={key} className={`product-nav-item ${route.page === key ? "active" : ""}`} onClick={() => navigate(key)}>
            <Icon name={item.icon} size={17} /><span>{item.label}</span>
            {key === "history" ? <em>{totalRuns}</em> : key === "views" ? <em>{state.savedViews.length}</em> : null}
          </button>)}
        </nav>
        <div className="product-nav-foot"><strong>{configState.status}</strong><span>{state.activeConfig.name} · {state.activeConfig.status}</span></div>
      </aside>
      <section className="app-workspace">
        <header className="topbar">
          <div className="breadcrumb"><Icon name="home" size={13} /><span>智能问数</span><Icon name="chevron-right" size={12} /><strong>{ROUTES[route.page].label}</strong></div>
          <div className="top-actions">
            <button className={`data-context ${context.ready ? "ready" : "failed"}`} onClick={onDataScenario} title="查看数据与语义状态">
              <Icon name={context.ready ? "database-zap" : "triangle-alert"} size={16} /><span>{context.ready ? "权威上下文可用" : context.status}</span>
            </button>
            <IconButton icon="rotate-ccw" label="重置状态" onClick={onReset} />
          </div>
        </header>
        <main className="main" data-screen-label={ROUTES[route.page].label} tabIndex={-1}>{children}</main>
      </section>
    </div>;
  }

  function Recommendations({ state, setState, ask, notify }) {
    const rec = state.recommendations;
    const scopedConfig = configForScenario(state.activeConfig, state.scenarioContext);
    const runtime = runtimeForScenario(state, scopedConfig);
    const currentlyEligible = rec.status === "成功"
      ? rec.items.filter((item) => D.recommendationEligibility(item, scopedConfig, runtime).eligible)
      : [];
    const runGeneration = () => {
      const semantic = D.readPublishedOntologyContext();
      const generationRuntime = runtimeForScenario(state, scopedConfig);
      const epoch = beginAsync();
      const attempt = rec.attempt + 1;
      setState((prev) => ({ ...prev, recommendations: { ...prev.recommendations, status: "生成中", attempt, error: null } }));
      if (!semantic.discoverable || generationRuntime?.ready !== true) {
        const reason = generationRuntime?.reason || semantic.answerabilityReason || semantic.reason || "当前正式运行上下文尚未形成";
        window.setTimeout(() => {
          if (!asyncIsCurrent(epoch)) return;
          setState((prev) => ({ ...prev, recommendations: { ...prev.recommendations, status: "失败", error: `${semantic.status || generationRuntime?.status || "暂不可用"}：${reason}` } }));
          notify("当前没有可正式回答的问题组合", "danger");
        }, WAIT * 2);
        return;
      }
      window.setTimeout(() => {
        if (!asyncIsCurrent(epoch)) return;
        if (attempt === 2) {
          setState((prev) => ({ ...prev, recommendations: { ...prev.recommendations, status: "失败", error: "绑定语义摘要读取超时" } }));
          notify("推荐问题生成失败，可重试", "danger");
        } else {
          const items = D.recommendableQuestions(scopedConfig, generationRuntime).map((item) => ({
            ...clone(item),
            resourceLabels: item.resources.map((id) => D.resourceFromContext(semantic, id)?.name || id)
          }));
          const firstIneligible = D.RECOMMENDED_QUESTIONS.map((item) => D.recommendationEligibility(item, scopedConfig, generationRuntime)).find((item) => !item.eligible);
          const error = items.length ? null : firstIneligible?.reason || "当前配置没有通过正式运行门禁的问题组合";
          setState((prev) => ({ ...prev, recommendations: { ...prev.recommendations, status: items.length ? "成功" : "失败", items, generatedAt: now(), error } }));
          notify(items.length ? "推荐问题已更新" : "当前配置没有可推荐的问题", items.length ? "success" : "danger");
        }
      }, WAIT * 2);
    };
    return <section className="recommendation-panel">
      <header><div><h2>推荐问题</h2><p>由当前问数配置、权限和绑定的已发布语义定义生成。</p></div>
        <Button size="sm" variant="ghost" icon="refresh-cw" loading={rec.status === "生成中"} onClick={runGeneration}>{rec.status === "未生成" ? "生成推荐" : "刷新推荐"}</Button>
      </header>
      {rec.status === "未生成" ? <div className="recommendation-state"><Icon name="sparkles" /><strong>尚未生成推荐</strong><p>生成只更新问题建议，不改变配置、版本或已形成的回答。</p><Button size="sm" variant="primary" onClick={runGeneration}>生成推荐</Button></div> : null}
      {rec.status === "生成中" ? <div className="recommendation-state"><Skeleton lines={3} /><strong>正在生成可回答的问题</strong><p>仅核对当前白名单内的已发布语义定义。</p></div> : null}
      {rec.status === "失败" ? <div className="recommendation-state"><Icon name="circle-x" /><strong>推荐问题生成失败</strong><p>{rec.error}；当前配置和正式结果未发生变化。</p><Button size="sm" variant="primary" onClick={runGeneration}>重试</Button></div> : null}
      {rec.status === "成功" && !currentlyEligible.length ? <div className="recommendation-state"><Icon name="shield-alert" /><strong>此前推荐已失效</strong><p>当前配置或正式上下文已变化，请重新生成后再提问。</p><Button size="sm" variant="primary" onClick={runGeneration}>重新生成</Button></div> : null}
      {rec.status === "成功" && currentlyEligible.length ? <div className="recommendation-grid">{currentlyEligible.map((item) => <button className="recommendation-card" key={item.id} onClick={() => ask(item.question)}>
        <span><Icon name="message-circle-question" size={17} /></span><div><strong>{item.title}</strong><small>{item.question}</small><code>{item.resourceLabels?.join("、") || questionResourceNames(item)}</code></div><Icon name="arrow-up-right" size={15} />
      </button>)}</div> : null}
    </section>;
  }

  function Composer({ state, setState, ask, notify }) {
    const [question, setQuestion] = React.useState(state.draftQuestion || "");
    React.useEffect(() => setQuestion(state.draftQuestion || ""), [state.draftQuestion]);
    const submit = (event) => { event?.preventDefault(); if (question.trim()) ask(question.trim()); };
    return <>
      <div className="ask-hero">
        <div className="ask-heading"><span><Icon name="sparkles" /></span><div><h2>想了解什么业务问题？</h2><p>输入单位、集团、板块、指标、规则或金融机构范围。</p></div></div>
        <div className="agent-match-card"><span><Icon name="bot" /></span><div><strong>系统将匹配：{state.activeConfig.name}</strong><small>{state.activeConfig.scene} · 提交后自动匹配并固定配置快照</small></div><Button size="sm" variant="ghost" onClick={() => go("agent")}>查看详情</Button></div>
        {state.pendingViewRun ? <Notice tone="info" compact title={`已载入问数视图${state.pendingViewRun.parameterConfirmed ? "参数" : ""}`} action={<Button size="sm" variant="ghost" onClick={() => setState((prev) => ({ ...prev, pendingViewRun: null, draftQuestion: "" }))}>取消载入</Button>}>对象范围：{state.pendingViewRun.queryDefinition?.objectScope?.join("、") || "运行时确认"}。提交前仍会执行 Agent 匹配和完整上下文门禁。</Notice> : null}
        <form className="composer" onSubmit={submit}>
          <textarea aria-label="输入业务问题" value={question} onChange={(event) => { const value = event.target.value; setQuestion(value); setState((prev) => ({ ...prev, draftQuestion: value, pendingViewRun: prev.pendingViewRun?.question === value ? prev.pendingViewRun : null })); }} placeholder="例如：单位553平均融资成本及构成是什么？"></textarea>
          <div className="composer-foot"><span><Icon name="shield-check" size={14} />仅使用白名单内的已发布语义资源</span><Button type="submit" variant="primary" icon="arrow-up" disabled={!question.trim()}>提交问题</Button></div>
        </form>
      </div>
      <Recommendations state={state} setState={setState} ask={ask} notify={notify} />
      <section className="question-library"><div className="section-title"><div><h2>问题入口</h2><p>从已保存视图或历史轮次继续；新的推荐内容由上方真实生成。</p></div></div><div className="question-grid">
        {state.savedViews.filter((view) => viewRuntimeState(view, undefined, state.activeConfig, state.scenarioContext).status === "可运行").slice(0, 4).map((view) => <button key={view.id} className="question-card" onClick={() => { setState((prev) => ({ ...prev, draftQuestion: view.question, pendingViewRun: { viewId: view.id, question: view.question, queryDefinition: clone(view.queryDefinition), displayPreference: clone(view.displayPreference) } })); }}><span><Icon name="panels-top-left" size={18} /></span><div><strong>{view.name}</strong><p>载入查询定义与展示偏好</p></div><Icon name="arrow-up-right" size={15} /></button>)}
      </div></section>
    </>;
  }

  function RunProgress({ run }) {
    return <div className="run-surface">
      <div className="question-echo"><span><Icon name="user-round" /></span><div><small>原问题</small><strong>{run.question}</strong></div><StatusBadge status="处理中" /></div>
      <div className="processing-card"><span className="spinner large"></span><h2>{RUN_STEPS[Math.min(run.step, RUN_STEPS.length - 1)]}</h2><p>已冻结本轮配置和权威上下文，候选版本不会混入。</p>
        <Progress value={Math.max(8, (run.step + 1) / RUN_STEPS.length * 100)} label={`${run.step + 1} / ${RUN_STEPS.length}`} />
        <ol className="plan-list">{RUN_STEPS.map((label, index) => <li key={label} className={index < run.step ? "done" : index === run.step ? "active" : ""}><span>{index < run.step ? <Icon name="check" size={12} /> : index + 1}</span><strong>{label}</strong><small>{index < run.step ? "已完成" : index === run.step ? "正在处理" : "等待"}</small></li>)}</ol>
      </div>
    </div>;
  }

  function ContextSummary({ run, onEvidence, onContext }) {
    const quality = run.context?.quality || "无法判断";
    const freshness = run.context?.freshness || "无法判断";
    const warnings = [
      ...(/失败|陈旧|上一可信|刷新中|警告/.test(freshness) ? [freshness] : []),
      ...(/警告|失败|无法判断/.test(quality) ? [quality] : []),
      ...(run.result?.rows?.some((row) => row.warning) ? ["业务口径待确认"] : [])
    ];
    return <ContextBar semanticVersion={run.context?.semanticVersion} dataVersion={run.context?.dataVersion} dataAsOf={run.context?.asOf} generatedAt={run.completedAt} quality={quality} freshness={freshness} evidenceCount={makeEvidence(run).length} onEvidence={onEvidence} onOpen={onContext} warnings={warnings} />;
  }

  function ResultText({ run, selectEvidence }) {
    const valueAlreadyHasUnit = (item) => Boolean(item.unit && String(item.value ?? "").includes(item.unit));
    return <div className="text-result"><p className="answer-summary">{run.result.summary}</p><div className={`metric-grid ${run.result.highlights.length === 4 ? "four" : ""}`}>{run.result.highlights.map((item) => <button className={`metric-card ${item.tone || ""}`} key={item.id} onClick={() => selectEvidence(item.rowId || item.evidenceId || item.id)}><span>{item.label}</span><strong>{item.value}</strong><small>{valueAlreadyHasUnit(item) ? "精确业务值" : item.unit || "业务结果"} · 点击查看证据</small></button>)}</div>
      <div className="answer-proof"><Icon name="shield-check" size={16} /><span>所有正式数值均来自本轮固定结构化语义结果；文字未重新计算。</span><button onClick={() => selectEvidence()}>查看证据</button></div></div>;
  }

  function ResultTable({ run, selected, onSelect, onExport, exportState, allowExport = true, exportReason = "" }) {
    const evidence = makeEvidence(run);
    const rows = run.result.rows.map((row, index) => ({ ...row, evidence: evidence[index]?.id }));
    return <div className="table-result"><div className="workspace-toolbar"><div><strong>当前完整结果</strong><small>{rows.length} 行 · 精确业务值{run.result.queryDefinitionTopN ? ` · 查询定义返回 Top ${run.result.queryDefinitionTopN}` : ""}</small></div><span className="toolbar-spacer"></span><Button size="sm" icon="download" loading={exportState === "导出中"} disabled={!allowExport} title={!allowExport ? exportReason : "导出当前完整结构化结果"} onClick={onExport}>导出 CSV</Button></div>
      <DataTable columns={resultColumns} rows={rows} selectedRowId={selected} onRowClick={(row) => onSelect(row.id)} caption="当前问数结构化结果" compact />
    </div>;
  }

  function ChartMenu({ run, value, onChange }) {
    const menuRef = React.useRef(null);
    React.useEffect(() => {
      const menu = menuRef.current;
      const active = menu?.querySelector("button.active");
      if (!menu || !active || menu.scrollWidth <= menu.clientWidth) return;
      const left = Math.max(0, active.offsetLeft - (menu.clientWidth - active.offsetWidth) / 2);
      menu.scrollTo({ left, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }, [value]);
    return <div className="horizontal-scroll-frame chart-menu-frame"><div className="chart-menu-inline" ref={menuRef}>{CHART_OPTIONS.map((item) => {
      const view = chartView(run.result, item.id);
      const supportedByContract = item.id === "recommended" || (run.result.chart?.allowed || []).includes(chartToken(item.id));
      const check = getChartApplicability(item.id === "recommended" ? view.type : item.id, view.data, {
        partToWhole: view.partToWhole, series: view.series, unit: view.unit,
        allowTopN: view.allowTopN, maxCategories: view.maxCategories
      });
      const supported = supportedByContract && (item.id === "recommended" || check.applicable);
      const reason = !supportedByContract ? "当前结果语义未提供该图表所需的可比结构" : check.reason;
      return <button key={item.id} className={value === item.id ? "active" : ""} disabled={!supported} title={!supported ? reason : item.label} onClick={() => onChange(item.id)}><Icon name={item.icon} size={15} /><span>{item.label}</span>{!supported ? <small>{reason}</small> : null}</button>;
    })}</div><span className="horizontal-scroll-cue" aria-hidden="true"><Icon name="move-horizontal" size={13} />左右滑动</span></div>;
  }

  function ResultChart({ run, chartType: requestedType, selected, onSelect, onEvidence, failed, onRetry, onRestore, onExport, exportState, switching, allowExport = true, exportReason = "" }) {
    if (failed) return <div className="chart-stage is-failed"><Notice tone="danger" title="图表展示失败" action={<Button size="sm" onClick={onRetry}>重试图表</Button>}>已安全回退到数据表；原结果、版本和证据保持不变。</Notice><ResultTable run={run} selected={selected} onSelect={onSelect} onExport={onExport} exportState={exportState} allowExport={allowExport} exportReason={exportReason} /></div>;
    const view = chartView(run.result, requestedType);
    return <div className={`chart-stage ${switching ? "is-switching" : ""}`}><MiniChart type={view.type} data={view.data} series={view.series} title={run.result.title} subtitle="点击图形元素可定位对应表格行和证据" unit={view.unit} selectedId={selected} onSelect={(id, item) => onSelect(item?.rowId || id)} onEvidence={(id, item) => onEvidence(id || item?.evidenceId || item?.rowId)} onRestore={onRestore} partToWhole={view.partToWhole} allowTopN={view.allowTopN} maxCategories={view.maxCategories} transition="semantic" /></div>;
  }

  function Answer({ run, state, setState, notify, openEvidence, openContext, saveView, pinView, openAction, follow }) {
    const [exportState, setExportState] = React.useState("可导出");
    const [chartFailed, setChartFailed] = React.useState(false);
    const [chartSwitching, setChartSwitching] = React.useState(false);
    const [followText, setFollowText] = React.useState("");
    const chartSwitchRef = React.useRef(0);
    const display = run.display || { mode: "text", chart: "recommended", selected: null };
    const actionRequest = (state.actionRequests || []).find((item) => item.runId === run.id) || null;
    const updateDisplay = (patch) => setState((prev) => updateRun(prev, run.id, (current) => ({ ...current, display: { ...current.display, ...patch } })));
    const exportCsv = () => {
      const gate = csvEligibility(run, state.scenarioContext);
      if (!gate.allowed) { setExportState("不可导出"); notify(gate.reason, "danger"); return; }
      const epoch = beginAsync();
      setExportState("导出中");
      window.setTimeout(() => {
        if (!asyncIsCurrent(epoch)) return;
        const currentGate = csvEligibility(run, state.scenarioContext);
        if (!currentGate.allowed) { setExportState("不可导出"); notify(currentGate.reason, "danger"); return; }
        try { downloadCsv(run); setExportState("已导出"); notify(`已导出当前完整结果，共 ${run.result.rows.length} 行`); }
        catch (_) { setExportState("失败"); notify("CSV 生成失败，原结果仍可用", "danger"); }
      }, WAIT);
    };
    const switchChart = (value) => {
      const transitionId = chartSwitchRef.current + 1;
      chartSwitchRef.current = transitionId;
      setChartFailed(false);
      setChartSwitching(true);
      updateDisplay({ chart: value });
      window.setTimeout(() => {
        if (chartSwitchRef.current !== transitionId) return;
        setChartSwitching(false);
        try {
          const view = chartView(run.result, value);
          if (!view.data.length || view.data.some((item) => item.value !== null && !Number.isFinite(Number(item.value)))) throw new Error("图表数据不可渲染");
          if (value === "vertical-bar" && !run.display?.chartFailureRecovered) throw new Error("图表容器绘制未完成");
        } catch (_) { setChartFailed(true); }
      }, 180);
    };
    const chart = display.chart === "recommended" ? "recommended" : display.chart;
    return <div className="run-surface"><div className="question-echo"><span><Icon name="user-round" /></span><div><small>原问题</small><strong>{run.question}</strong></div><StatusBadge status={run.status} /></div>
      <article className="answer-card"><header className="answer-head"><div><span className="eyebrow">查询结果</span><h2>{run.result.title}</h2></div><div className="answer-actions"><Button size="sm" variant="ghost" icon="bookmark" onClick={saveView}>保存视图</Button><Button size="sm" variant="ghost" icon="pin" onClick={pinView}>固定到仪表盘</Button></div></header>
        <ContextSummary run={run} onEvidence={() => openEvidence()} onContext={openContext} />
        {/上一可信|陈旧|刷新失败/.test([run.context?.freshness, run.context?.freshnessStatus, run.context?.refresh?.status, run.context?.refresh?.failureReason, run.context?.previous?.dataVersion].filter(Boolean).join(" · ")) ? <Notice tone="warning" title="当前权威组合带服务警告">{[run.context?.freshness, run.context?.refresh?.failureReason, run.context?.dataVersion ? `当前服务 ${run.context.dataVersion}` : null, run.context?.previous?.dataVersion ? `数据侧上一合格参考 ${run.context.previous.dataVersion}` : null].filter(Boolean).join("；")}。候选不会混入当前回答，此警告在文字、表格、图表和 CSV 中持续保留。</Notice> : null}
        <div className="display-toolbar"><DisplayModeSwitch value={display.mode} onChange={(mode) => updateDisplay({ mode })} /><span className="display-spacer"></span>{display.mode === "chart" ? <ChartMenu run={run} value={chart} onChange={switchChart} /> : null}</div>
        <div className="result-stage" data-result-id={run.result.id}>{display.mode === "text" ? <ResultText run={run} selectEvidence={(rowId) => openEvidence(rowId)} /> : display.mode === "table" ? <ResultTable run={run} selected={display.selected} onSelect={(id) => { updateDisplay({ selected: id }); openEvidence(id); }} onExport={exportCsv} exportState={exportState} /> : <ResultChart run={run} chartType={chart} selected={display.selected} onSelect={(id) => updateDisplay({ selected: id })} onEvidence={openEvidence} failed={chartFailed} onRetry={() => { updateDisplay({ chartFailureRecovered: true }); setChartFailed(false); }} onRestore={() => updateDisplay({ selected: null })} onExport={exportCsv} exportState={exportState} switching={chartSwitching} />}</div>
        <footer className="follow-section"><div><strong>继续追问</strong><small>明确加入、移除或覆盖对象范围。</small></div><div className="follow-content"><form className="follow-composer" onSubmit={(event) => { event.preventDefault(); const value = followText.trim(); if (!value) return; setFollowText(""); follow(value); }}><input aria-label="继续追问" value={followText} onChange={(event) => setFollowText(event.target.value)} placeholder="例如：把单位561加入组合" /><Button type="submit" size="sm" variant="primary" icon="arrow-up" disabled={!followText.trim()}>发送</Button></form>{actionRequest ? <div className="action-request-summary"><span><Icon name="send" size={15} /></span><div><strong>行动请求已提交</strong><small>{actionRequest.target} · {actionRequest.status} · {actionRequest.createdAt}</small></div><StatusBadge status={actionRequest.status} /><Button size="sm" variant="ghost" onClick={() => openAction(actionRequest)}>查看详情</Button></div> : null}<div className="view-actions"><Button size="sm" icon="file-search" onClick={() => openEvidence()}>查看证据</Button>{display.mode !== "table" ? <Button size="sm" icon="download" onClick={exportCsv}>导出 CSV</Button> : null}{!actionRequest ? <Button size="sm" icon="send" disabled={!isActionEligible(run, state.scenarioContext).eligible} title={!isActionEligible(run, state.scenarioContext).eligible ? isActionEligible(run, state.scenarioContext).reasons.join("；") : "发起行动请求"} onClick={() => openAction()}>发起行动请求</Button> : null}{applicableNextQuestions(run).slice(0, 2).map((item) => <Button size="sm" variant="ghost" key={item} onClick={() => follow(item)}>{item}</Button>)}</div></div></footer>
      </article></div>;
  }

  function BlockedRun({ run, retry, navigate, editQuestion }) {
    const dataIssue = run.recoveryOwner === "data";
    const inspect = () => {
      if (dataIssue) return window.open(D.DATA_ENGINEERING_ENTRY, "_blank", "noopener,noreferrer");
      if (run.recoveryRoute === "ask") return editQuestion();
      if (run.recoveryRoute === "agent" || run.recoveryRoute === "history") return navigate(run.recoveryRoute);
      window.open(D.ONTOLOGY_ENTRY, "_blank", "noopener,noreferrer");
    };
    const ownerLabel = dataIssue ? "数据工程" : run.recoveryOwner === "agent" || run.recoveryRoute === "agent" ? "Agent 配置" : "本体管理";
    const primary = run.recoveryRoute === "ask"
      ? <Button variant="primary" icon="pencil" onClick={editQuestion}>修改问题</Button>
      : <Button variant="primary" icon="arrow-up-right" onClick={inspect}>查看{ownerLabel}</Button>;
    const gateIssues = run.gateIssues || [];
    return <div className="run-surface"><div className="question-echo"><span><Icon name="user-round" /></span><div><small>原问题</small><strong>{run.question}</strong></div><StatusBadge status={run.status} /></div><EmptyState icon="octagon-alert" title={run.failure || "当前无法回答"} description={run.recovery} primaryAction={primary} secondaryAction={run.recoveryRoute === "ask" ? <Button onClick={() => navigate("history")}>查看历史</Button> : run.retryable ? <Button icon="refresh-cw" onClick={retry}>{run.recoveryRoute === "agent" ? "重新匹配" : "重新检查"}</Button> : <Button onClick={() => navigate("history")}>查看历史</Button>} />{gateIssues.length > 1 ? <section className="gate-issue-panel"><header><div><strong>本轮未通过项</strong><small>一次列出全部门禁问题，修复后重新检查。</small></div><Badge tone="danger">{gateIssues.length} 项</Badge></header><ol>{gateIssues.map((item, index) => <li key={`${item.gate}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{item.gate} · {item.owner || "智能问数"}</strong><p>{item.reason}</p><small>{item.recovery}</small></div></li>)}</ol></section> : null}</div>;
  }

  function HistoricalAnswer({ run, setState, rerun, openEvidence, openContext }) {
    const display = run.display || { mode: "text", chart: "recommended", selected: null };
    const [chartFailed, setChartFailed] = React.useState(false);
    const [chartRecovered, setChartRecovered] = React.useState(false);
    const updateDisplay = (patch) => setState((prev) => updateRun(prev, run.id, (current) => ({ ...current, display: { ...current.display, ...patch } })));
    const switchHistoricalChart = (chart) => {
      updateDisplay({ chart });
      if (chart === "vertical-bar" && !chartRecovered) setChartFailed(true);
      else setChartFailed(false);
    };
    return <div className="run-surface"><div className="question-echo"><span><Icon name="history" /></span><div><small>{run.clarificationRecord ? "澄清后的历史问题" : "历史问题"}</small><strong>{run.clarificationRecord?.finalUnderstanding || run.question}</strong>{run.clarificationRecord ? <small>原输入：{run.originalQuestion || run.question} · 已确认 {run.clarificationRecord.confirmedObject}</small> : null}</div><StatusBadge status={run.status} /></div><article className="answer-card"><header className="answer-head"><div><span className="eyebrow">历史固定结果</span><h2>{run.result?.title || run.question}</h2></div><Button size="sm" variant="primary" icon="refresh-cw" onClick={rerun}>按当前版本重新运行</Button></header>{run.context ? <ContextSummary run={run} onEvidence={openEvidence} onContext={openContext} /> : null}{run.result ? <><div className="display-toolbar"><DisplayModeSwitch value={display.mode} onChange={(mode) => updateDisplay({ mode })} /><span className="display-spacer"></span>{display.mode === "chart" ? <ChartMenu run={run} value={display.chart || "recommended"} onChange={switchHistoricalChart} /> : null}</div><div className="result-stage">{display.mode === "text" ? <ResultText run={run} selectEvidence={openEvidence} /> : display.mode === "table" ? <ResultTable run={run} selected={display.selected} onSelect={(id) => { updateDisplay({ selected: id }); openEvidence(id); }} allowExport={false} exportReason="历史轮次只读；请按当前权威上下文重新运行后导出" /> : <ResultChart run={run} chartType={display.chart || "recommended"} selected={display.selected} onSelect={(id) => updateDisplay({ selected: id })} onEvidence={openEvidence} failed={chartFailed} onRetry={() => { setChartRecovered(true); setChartFailed(false); }} onRestore={() => updateDisplay({ selected: null })} allowExport={false} exportReason="历史轮次只读；请按当前权威上下文重新运行后导出" />}</div></> : <Notice tone="warning" title={run.failure}>{run.recovery}</Notice>}<Notice tone="info" compact title="只读历史快照">可查看同一份历史结果的文字、表格和图表；不能导出、保存、固定或发起行动。</Notice></article></div>;
  }

  function RunSide({ run, openContext, openEvidence }) {
    if (!run) return null;
    const resources = (run.result?.resourceIds || []).map((id) => resourceFor(run.context, id)).filter(Boolean);
    if (VARIANT.id === "semantic") return <aside className="semantic-side"><header><div><h2>本轮语义路径</h2><p>仅显示实际使用的稳定资源。</p></div></header>{resources.length ? <div className="semantic-path">{resources.slice(0, 4).map((item, index) => <React.Fragment key={item.id}><button className="semantic-node used" onClick={() => openEvidence(null, item.id)}><span className="node-type">{item.type}</span><strong>{item.name}</strong><code>{item.id}</code><small>{run.past ? "历史固定引用" : "已发布"}</small></button>{index < Math.min(resources.length, 4) - 1 ? <span className="semantic-edge"><span>只读</span></span> : null}</React.Fragment>)}</div> : <EmptyState compact title="语义路径尚未形成" description="正式结果形成后，才显示本轮实际使用的稳定资源。" />}{run.past ? <Notice tone="info" compact title="原版本当前不可定位">保留稳定资源引用和历史证据，不会指向草稿、当前版本或同名资源。</Notice> : null}<Button size="sm" variant="ghost" onClick={openContext}>查看本轮上下文</Button></aside>;
    if (VARIANT.id === "analysis") return <aside className="analysis-rail"><section className="scope-summary"><header><h3>问题范围</h3><StatusBadge status={run.status} /></header><dl><dt>对象</dt><dd>{run.result?.scope?.join("、") || "待确认"}</dd><dt>层级</dt><dd>{run.templateId === "group-overview" ? "集团 / 板块" : "融资主体"}</dd><dt>排序</dt><dd>{run.templateId === "institution-priority" ? "问题余额贡献降序" : "业务默认"}</dd><dt>时间</dt><dd>{run.context?.asOf || "待装配"}</dd></dl></section><ol className="plan-list">{RUN_STEPS.map((item, index) => <li key={item} className={run.status === "成功" || index < run.step ? "done" : ""}><span><Icon name="check" size={12} /></span><strong>{item}</strong><small>{run.status === "成功" ? "已完成" : index === run.step ? "处理中" : "等待"}</small></li>)}</ol></aside>;
    const contextStatus = run.status === "处理中"
      ? "处理中"
      : run.past && run.status === "成功" && run.result
        ? "历史只读"
        : run.context?.ready && run.context?.evidenceComplete
          ? "完整"
          : "阻断";
    const template = D.RESULT_TEMPLATES[run.templateId];
    const plannedResources = (template?.resourceIds || []).map((id) => resourceFor(run.context, id)?.name || `${id}（未定位）`);
    const plannedLinks = (D.QUERY_LINK_PATHS[run.templateId] || []).map((item) => {
      const link = resourceFor(run.context, item.linkId);
      const from = resourceFor(run.context, item.from);
      const to = resourceFor(run.context, item.to);
      return link && from && to ? `${link.name}：${from.name} → ${to.name}` : `${item.linkId}：${item.from} → ${item.to}（未定位）`;
    });
    const scope = run.result?.scope?.join("、") || run.queryContext?.unitCodes?.map((code) => `单位${code}`).join("、") || "等待确认";
    const gatePassed = run.status === "处理中" || run.status === "成功" || (run.past && run.result);
    return <aside className="evidence-rail context-stage"><header className="context-stage-head"><div><span className="eyebrow">只读证明</span><h2>本轮上下文与语义证据</h2></div><StatusBadge status={contextStatus} /></header>
      <section className="context-stage-card is-complete"><header><span>01</span><div><strong>配置快照</strong><small>提交问题时固定</small></div></header><dl><dt>问数 Agent</dt><dd>{run.configSnapshot?.name || "未匹配"}</dd><dt>配置版本</dt><dd>{run.configSnapshot?.version || "未固定"}</dd><dt>加载证明</dt><dd>{run.configSnapshot?.loadProof || "待核验"}</dd></dl></section>
      <section className={`context-stage-card ${gatePassed ? "is-complete" : "is-blocked"}`}><header><span>02</span><div><strong>问题理解与计划</strong><small>{run.status === "处理中" ? "正在执行门禁" : gatePassed ? "已固定" : "门禁未通过"}</small></div></header><dl><dt>最终理解</dt><dd>{run.clarificationRecord?.finalUnderstanding || run.finalQuestion || run.question}</dd><dt>对象范围</dt><dd>{scope}</dd><dt>计划资源</dt><dd>{plannedResources.length ? plannedResources.join("、") : "未形成"}</dd><dt>关系路径</dt><dd>{plannedLinks.length ? plannedLinks.join("；") : "本题无需关系导航"}</dd><dt>门禁</dt><dd>{gatePassed ? "已通过，可继续执行" : run.failure || "未通过"}</dd></dl></section>
      <section className={`context-stage-card ${run.result ? "is-complete" : "is-pending"}`}><header><span>03</span><div><strong>结果与证据</strong><small>{run.result ? run.past ? "历史固定快照" : "回答已形成" : "等待正式结果"}</small></div></header><dl><dt>已发布语义</dt><dd>{run.context?.semanticVersion || "未形成"}</dd><dt>精确版本</dt><dd>{run.context?.versionId || "未形成"}</dd><dt>数据版本</dt><dd>{run.context?.dataVersion || "未形成"}</dd><dt>数据截至</dt><dd>{run.context?.asOf || "未形成"}</dd><dt>质量 / 新鲜度</dt><dd>{[run.context?.quality, run.context?.freshness].filter(Boolean).join(" · ") || "无法判断"}</dd><dt>实际资源 / 证据</dt><dd>{run.result ? `${run.result.resourceIds?.length || 0} 项资源 · ${makeEvidence(run).length} 项证据` : "等待"}</dd></dl></section>
      <div className="view-actions"><Button size="sm" variant="ghost" onClick={openContext}>查看详情</Button>{run.result ? <Button size="sm" variant="ghost" onClick={() => openEvidence()}>查看证据</Button> : null}</div>
    </aside>;
  }

  function PreRunSide({ state }) {
    const scopedConfig = configForScenario(state.activeConfig, state.scenarioContext);
    const runtime = runtimeForScenario(state, scopedConfig);
    const runtimeState = D.deriveConfigRuntimeState(scopedConfig, runtime, D.readOntologyBindingContext());
    if (VARIANT.id === "conversation") {
      const semantic = D.readPublishedOntologyContext();
      const capabilityProof = D.runtimeCapabilityProof(state.activeConfig);
      const semanticIssue = semantic.linkProblems?.length ? `已发布语义仍有 ${semantic.linkProblems.length} 条关系方向超出问数白名单` : semantic.contractProblems?.length ? "已发布语义资源仍需修订" : null;
      return <aside className="evidence-rail context-stage"><header className="context-stage-head"><div><span className="eyebrow">提问前</span><h2>本轮上下文与语义证据</h2></div><StatusBadge status={runtimeState.status} /></header>
        <section className="context-stage-card is-current"><header><span>01</span><div><strong>问数 Agent</strong><small>提交后自动匹配并固定</small></div></header><dl><dt>配置</dt><dd>{state.activeConfig.name}</dd><dt>配置状态</dt><dd>{state.activeConfig.status}</dd><dt>Skill / Tool</dt><dd>{capabilityProof.passed ? "加载证明完整" : "实际加载状态待核验"}</dd><dt>最近核验</dt><dd>{state.activeConfig.lastRuntimeVerificationAt || "尚无真实核验时间"}</dd></dl><Button size="sm" variant="ghost" onClick={() => go("agent")}>查看详情</Button></section>
        <section className={`context-stage-card ${semantic.discoverable ? "is-complete" : "is-blocked"}`}><header><span>02</span><div><strong>已发布语义</strong><small>{semantic.discoverable ? "精确版本可定位" : "尚未形成"}</small></div></header><dl><dt>精确版本</dt><dd>{semantic.semanticVersion || "尚未发布"}</dd><dt>版本身份</dt><dd>{semantic.versionId || "无法定位"}</dd><dt>正式消费组合</dt><dd>{semantic.formalAnswerable ? "已形成" : "尚未形成"}</dd></dl><Button size="sm" variant="ghost" onClick={() => go("semantics")}>查看详情</Button></section>
        <section className={`context-stage-card ${runtime?.ready ? "is-complete" : "is-blocked"}`}><header><span>03</span><div><strong>数据可信度</strong><small>{runtime?.ready ? "可用于本轮" : "无法进入正式问数"}</small></div></header><dl><dt>数据截至</dt><dd>{runtime?.asOf || "无法取得"}</dd><dt>质量</dt><dd>{runtime?.quality || "无法判断"}</dd><dt>新鲜度</dt><dd>{runtime?.freshness || "无法判断"}</dd><dt>正式问数</dt><dd>{runtimeState.status === "兼容" ? "可以运行" : "阻断"}</dd></dl></section>
        <Notice tone={runtimeState.status === "兼容" ? "success" : "warning"} compact title={runtimeState.status === "兼容" ? "当前可以正式问数" : "当前不可正式运行"}>{[runtimeState.reason, semanticIssue].filter(Boolean).join("；")}</Notice>
      </aside>;
    }
    if (VARIANT.id === "analysis") return <aside className="analysis-rail"><section className="context-summary"><header><h3>当前 Agent 与绑定语义</h3><StatusBadge status={runtimeState.status} /></header><dl><dt>配置</dt><dd>{state.activeConfig.name}</dd><dt>配置状态</dt><dd>{state.activeConfig.status}</dd><dt>场景</dt><dd>{state.activeConfig.scene}</dd><dt>白名单资源</dt><dd>{state.activeConfig.allowedResources.length} 项</dd></dl><Notice tone={runtimeState.status === "兼容" ? "success" : "warning"} compact title={runtimeState.status === "兼容" ? "可用于正式问数" : "当前不可正式运行"}>{runtimeState.reason}</Notice></section></aside>;
    const semantic = D.readPublishedOntologyContext();
    return <aside className="semantic-side"><header><div><h2>当前绑定链</h2><p>配置、已发布语义和正式消费组合分别核对。</p></div></header><div className="semantic-path binding-path"><button className="semantic-node used" onClick={() => go("agent")}><span className="node-type">问数配置</span><strong>{state.activeConfig.name}</strong><code>{state.activeConfig.version}</code><small>{state.activeConfig.status}</small></button><span className="semantic-edge"><span>绑定</span></span><button className={`semantic-node ${semantic.discoverable ? "used" : "invalid"}`} onClick={() => go("semantics")}><span className="node-type">已发布语义</span><strong>{semantic.semanticVersion || "尚未发布"}</strong><code>{semantic.versionId || "等待精确版本"}</code><small>{semantic.status}</small></button><span className="semantic-edge"><span>采用</span></span><button className="semantic-node invalid" onClick={() => go("semantics")}><span className="node-type">正式消费组合</span><strong>{semantic.formalAnswerable ? "可正式问数" : "尚未形成"}</strong><code>{semantic.dataVersion || "等待权威绑定"}</code><small>{semantic.answerabilityStatus}</small></button></div><Notice tone={semantic.formalAnswerable ? "success" : "warning"} compact title={semantic.formalAnswerable ? "上下文可用" : "当前不可正式回答"}>{semantic.answerabilityReason || "提交问题后将固定精确上下文。"}</Notice><div className="view-actions"><Button size="sm" variant="ghost" onClick={() => go("agent")}>查看配置</Button><Button size="sm" variant="ghost" onClick={() => go("semantics")}>查看语义</Button></div></aside>;
  }

  function AskPage({ state, setState, notify, openEvidence, openContext, setModal }) {
    const [clarify, setClarify] = React.useState(null);
    const [agentChoice, setAgentChoice] = React.useState(null);
    const current = state.currentRunId ? getRun(state, state.currentRunId) : null;
    const unitCodesForRun = (run) => {
      const fixed = run?.queryContext?.unitCodes || [];
      if (fixed.length) return [...new Set(fixed)];
      return [...new Set((run?.result?.scope || []).flatMap((label) => D.referencedUnitCodes(label)))];
    };
    const canonicalCostQuestion = (unitCodes) => {
      const units = unitCodes.map((code) => `单位${code}`);
      if (units.length === 1) return `${units[0]}平均融资成本及构成是什么？`;
      if (units.length === 2) return `${units[0]}和${units[1]}综合平均融资成本是多少？`;
      if (units.length === 3) return `${units[0]}、${units[1]}和${units[2]}综合平均融资成本是多少？`;
      return null;
    };
    const attachScenarioContext = (context, config) => {
      const scenario = state.scenarioContext || { id: state.currentScenario || null };
      return D.projectRuntimeContextForScenario(context, scenario, config);
    };
    const createRun = (question, templateId, inherited = null, selectedConfig = state.activeConfig, explicitQueryContext = null) => {
      const epoch = beginAsync();
      const scenario = state.scenarioContext || {};
      const configSnapshot = {
        ...clone(selectedConfig),
        sceneId: scenario.id || state.currentScenario || selectedConfig?.sceneId || null,
        sceneVersion: scenario.version || selectedConfig?.sceneVersion || null,
        sceneVersionStatus: scenario.status || selectedConfig?.sceneVersionStatus || "场景版本待读取"
      };
      const rawRuntime = D.readRuntimeContext();
      const ontology = attachScenarioContext(D.projectRuntimeContext(rawRuntime), configSnapshot);
      const recoveryOwner = rawRuntime?.recoveryOwner || "ontology";
      if (templateId === "trend-blocked") {
        const id = D.nextStableId("RUN");
        const blocked = { id, question, originalQuestion: explicitQueryContext?.originalQuestion || question, finalQuestion: question, templateId, status: "阻断", createdAt: now(), completedAt: now(), failure: "当前已发布指标没有可靠时间序列", recovery: "改问当前时点结果；后续只有明确发布的时间序列指标才开放趋势图。", retryable: false, recoveryRoute: "semantics", recoveryOwner: "ontology", context: ontology, configSnapshot };
        setState((prev) => ({ ...clearPendingViewRun(prev), serial: prev.serial + 1, currentRunId: id, draftQuestion: "", liveRuns: [blocked, ...prev.liveRuns] })); return;
      }
      const template = D.RESULT_TEMPLATES[templateId];
      const gate = D.validateRunContext(ontology, configSnapshot, template);
      const id = D.nextStableId("RUN");
      if (!gate.passed) {
        const issue = gate.issues[0];
        const blocked = { id, question, originalQuestion: explicitQueryContext?.originalQuestion || question, finalQuestion: inherited?.clarificationRecord?.finalUnderstanding || question, templateId, status: ontology.blocked ? "不可消费" : "阻断", createdAt: now(), completedAt: now(), failure: issue.reason, recovery: issue.recovery, gateIssues: clone(gate.issues), retryable: true, recoveryRoute: issue.gate === "配置" ? "agent" : "semantics", recoveryOwner: issue.gate === "配置" ? "agent" : recoveryOwner, context: ontology, configSnapshot, queryContext: clone(explicitQueryContext || { unitCodes: D.referencedUnitCodes(question), originalQuestion: question }), inheritance: inherited, clarificationRecord: inherited?.clarificationRecord || null };
        setState((prev) => ({ ...clearPendingViewRun(prev), serial: prev.serial + 1, currentRunId: id, draftQuestion: "", liveRuns: [blocked, ...prev.liveRuns] })); return;
      }
      const pendingView = state.pendingViewRun?.question === question ? state.pendingViewRun : null;
      const queryContext = clone(pendingView?.queryDefinition?.parameters ?? explicitQueryContext ?? { unitCodes: D.referencedUnitCodes(question), originalQuestion: question });
      const clarificationRecord = inherited?.clarificationRecord || null;
      const restoredDisplay = pendingView?.displayPreference
        ? { mode: pendingView.displayPreference.mode || "text", chart: chartType(pendingView.displayPreference.chart || "recommended"), selected: null }
        : { mode: "text", chart: "recommended", selected: null };
      const run = { id, question, originalQuestion: queryContext?.originalQuestion || question, finalQuestion: queryContext?.finalQuestion || question, templateId, status: "处理中", step: 0, createdAt: now(), completedAt: null, context: ontology, configSnapshot, queryContext, queryDefinitionSnapshot: clone(pendingView?.queryDefinition || null), sourceViewId: pendingView?.viewId || null, inheritance: inherited, clarificationRecord, result: null, display: restoredDisplay };
      setState((prev) => ({ ...prev, serial: prev.serial + 1, currentRunId: id, draftQuestion: "", pendingViewRun: null, liveRuns: [run, ...prev.liveRuns] }));
      RUN_STEPS.forEach((_, index) => window.setTimeout(() => {
        if (!asyncIsCurrent(epoch)) return;
        setState((prev) => {
          let completedSourceViewId = null;
          const next = updateRun(prev, id, (active) => {
        if (active.status !== "处理中") return active;
        if (index < RUN_STEPS.length - 1) return { ...active, step: index + 1 };
        const latest = attachScenarioContext(D.projectRuntimeContext(D.readRuntimeContext()), active.configSnapshot);
        if (!latest?.ready || latest.runtimeContextFingerprint !== active.context.runtimeContextFingerprint) return { ...active, status: "已废弃", completedAt: now(), failure: "运行中正式语义、数据或证据上下文发生变化", recovery: "已丢弃混合结果，请按新的完整上下文重新运行。", retryable: true };
        const resolvedResult = D.materializeResult ? D.materializeResult(templateId, active.context, active.id, active.queryContext) : clone(template);
        if (!resolvedResult) return { ...active, status: "阻断", completedAt: now(), failure: "固定结构化语义结果无法装配", recovery: "核对受控语义查询结果和证据后重新运行。", retryable: true };
        const output = D.verifyFixedResult(resolvedResult, active.context, active.configSnapshot);
        if (!output.passed) return { ...active, status: "阻断", completedAt: now(), failure: "回答输出未通过核验", recovery: `${output.issues[0]}。请核对结果与证据后重新运行。`, retryable: true };
        completedSourceViewId = active.sourceViewId || null;
        return { ...active, status: "成功", step: RUN_STEPS.length, completedAt: now(), result: resolvedResult };
          });
          if (!completedSourceViewId) return next;
          return { ...next, savedViews: next.savedViews.map((view) => view.id === completedSourceViewId ? { ...view, lastRunId: id } : view) };
        });
      }, WAIT * (index + 1)));
    };
    const ask = (question, inherited = null, explicitQueryContext = null) => {
      if (!question.trim()) return;
      if (hasAmbiguousUnit55(question)) return setClarify({ question, selected: null });
      if (/其他领域|预算|贷前|风险评分/.test(question)) {
        const id = D.nextStableId("RUN"); const blocked = { id, question, status: "阻断", createdAt: now(), completedAt: now(), failure: "没有适用于当前问题的已启用问数 Agent", recovery: "当前仅有融资问数场景可用；等待相应场景资料、已发布资源和配置完成。", retryable: false, recoveryRoute: "agent", scenarioContext: clone(state.scenarioContext) };
        setState((prev) => ({ ...clearPendingViewRun(prev), serial: prev.serial + 1, currentRunId: id, liveRuns: [blocked, ...prev.liveRuns], draftQuestion: "" })); return;
      }
      const templateId = D.resolveQuestion(question);
      if (!templateId) {
        const id = D.nextStableId("RUN");
        const blocked = { id, question, status: "阻断", createdAt: now(), completedAt: now(), failure: "暂时无法确认业务对象和问数意图", recovery: "请明确单位、集团或板块范围，并说明要查询融资成本、债务结构、规则命中或金融机构归因。", retryable: false, recoveryRoute: "ask" };
        setState((prev) => ({ ...clearPendingViewRun(prev), serial: prev.serial + 1, currentRunId: id, liveRuns: [blocked, ...prev.liveRuns], draftQuestion: "" }));
        return;
      }
      const requestedCodes = [...new Set(explicitQueryContext?.unitCodes?.length ? explicitQueryContext.unitCodes : D.referencedUnitCodes(question))];
      if (templateId === "rule-explain" && !(["553", "465", "561"].every((code) => requestedCodes.includes(code)) && requestedCodes.length === 3)) {
        const id = D.nextStableId("RUN");
        const blocked = { id, question, originalQuestion: explicitQueryContext?.originalQuestion || question, finalQuestion: explicitQueryContext?.finalQuestion || question, templateId, status: "阻断", createdAt: now(), completedAt: now(), failure: "当前规则解释需要明确三家单位范围", recovery: "请明确单位553、单位465和单位561；系统不会把单家问题套用到三家规则模板，也不会静默扩大对象范围。", retryable: false, recoveryRoute: "ask", recoveryOwner: "agent", queryContext: clone(explicitQueryContext || { unitCodes: requestedCodes, originalQuestion: question }), inheritance: inherited };
        setState((prev) => ({ ...clearPendingViewRun(prev), serial: prev.serial + 1, currentRunId: id, liveRuns: [blocked, ...prev.liveRuns], draftQuestion: "" }));
        return;
      }
      const template = D.RESULT_TEMPLATES[templateId];
      const rawRuntime = D.readRuntimeContext();
        const runtime = attachScenarioContext(D.projectRuntimeContext(rawRuntime), state.activeConfig);
      const enabled = state.enabledConfigs?.length ? state.enabledConfigs : [state.activeConfig];
      const matches = D.matchApplicableAgents(question, enabled, runtime, template);
      if (!matches.length) {
        const id = D.nextStableId("RUN");
        const blocked = { id, question, originalQuestion: explicitQueryContext?.originalQuestion || question, finalQuestion: explicitQueryContext?.finalQuestion || question, templateId, status: "阻断", createdAt: now(), completedAt: now(), failure: "没有适用于当前问题的已启用问数 Agent", recovery: "修改问题，或前往 Agent 配置核对场景、启用状态和资源白名单。", retryable: false, recoveryRoute: "agent", recoveryOwner: "agent", context: runtime, queryContext: clone(explicitQueryContext || { unitCodes: D.referencedUnitCodes(question), originalQuestion: question }), inheritance: inherited };
        setState((prev) => ({ ...clearPendingViewRun(prev), serial: prev.serial + 1, currentRunId: id, liveRuns: [blocked, ...prev.liveRuns], draftQuestion: "" }));
        return;
      }
      const queryContext = explicitQueryContext || { unitCodes: D.referencedUnitCodes(question), originalQuestion: question };
      if (matches.length > 1) { setAgentChoice({ question, inherited, templateId, matches, selectedId: null, queryContext }); return; }
      createRun(question, templateId, inherited, matches[0].config, queryContext);
    };
    const followFromCurrent = (text) => {
      if (!current?.result) return ask(text);
      const currentCodes = unitCodesForRun(current);
      const explicitCodes = D.referencedUnitCodes(text);
      const namedUnitCodes = [...text.matchAll(/(?:单位\s*|UNIT[-_ ]?)(\d+)/gi)].map((match) => match[1]);
      const approvedUnitCodes = ["553", "465", "561"];
      const unsupportedNamedCodes = [...new Set(namedUnitCodes.filter((code) => !approvedUnitCodes.includes(code)))];
      const addVerbPresent = /(?:加入|添加)/.test(text);
      const removeVerbPresent = /(?:去掉|移除|删除|清除)/.test(text);
      const replaceVerbPresent = /(?:改为|改成|替换为|替换成|覆盖为|覆盖成|设为|设置为|换成|换为)/.test(text) && (explicitCodes.length > 0 || /(?:范围|组合|另外两家)/.test(text));
      const negativeScopeCommand = /(?:不|不要|别|无需|禁止|取消).{0,6}(?:加入|添加|去掉|移除|删除|清除|改为|改成|替换|覆盖|设为|设置|换成|换为)/.test(text);
      const nonScopeObject = /(?:证据|图例|说明|记录|文本|标签|借据|贷款|数据|结果|视图|历史)/.test(text);
      const sourceTargetReplaceMatch = text.match(/^\s*(?:请)?(?:将|把)\s*(.+?)\s*(?:替换为|替换成)\s*(.+?)\s*[。！!？?]?\s*$/);
      const replaceMatch = sourceTargetReplaceMatch ? null : text.match(/(?:改为|改成|替换为|替换成|覆盖为|覆盖成|设为|设置为)\s*(.+?)\s*[。！!？?]?\s*$/);
      const replacementSourceCodes = sourceTargetReplaceMatch ? D.referencedUnitCodes(sourceTargetReplaceMatch[1]) : [];
      const replacementCodes = sourceTargetReplaceMatch
        ? D.referencedUnitCodes(sourceTargetReplaceMatch[2])
        : replaceMatch
          ? D.referencedUnitCodes(replaceMatch[1])
          : /(?:换成|换为)另外两家/.test(text) && currentCodes.length === 1
            ? approvedUnitCodes.filter((code) => !currentCodes.includes(code))
            : [];
      const addIntent = addVerbPresent && (explicitCodes.length > 0 || /第三家/.test(text));
      const removeIntent = removeVerbPresent && explicitCodes.length > 0;
      const replaceIntent = Boolean((replaceMatch || sourceTargetReplaceMatch || /(?:换成|换为)另外两家/.test(text)) && replacementCodes.length);
      const inheritedRuleQuestion = /(?:三家|这些单位).*(?:规则|命中)|(?:规则|命中).*(?:三家|这些单位)/.test(text) && currentCodes.length === 3 && explicitCodes.length === 0;
      const inheritedUnitComposition = currentCodes.length === 1 && explicitCodes.length === 0 && /(?:构成呢|成本构成|融资构成)/.test(text) && !/为什么/.test(text);
      const inheritedThreeUnitBreakdown = currentCodes.length === 3 && explicitCodes.length === 0 && /(?:这三家|三家).*(?:分别|各自)|(?:分别|各自).*(?:这三家|三家)/.test(text);
      const unsupportedSingleStructureWhy = currentCodes.length === 1 && /为什么/.test(text) && /(?:融资)?(?:结构|构成)/.test(text);
      const blockFollow = (failure, recovery) => {
        const id = D.nextStableId("RUN");
        const blocked = {
          id, question: text, originalQuestion: text, finalQuestion: text, status: "阻断", createdAt: now(), completedAt: now(),
          failure, recovery, retryable: false, recoveryRoute: "ask", recoveryOwner: "agent",
          context: clone(current.context), configSnapshot: clone(current.configSnapshot),
          queryContext: { unitCodes: clone(currentCodes), originalQuestion: text, sourceRunId: current.id, inheritedUnitCodes: clone(currentCodes), inheritedStableIds: currentCodes.map((code) => `UNIT-${code}`), clearedDisplayState: true },
          inheritance: { sourceRunId: current.id, inherited: ["场景", "明确对象范围"], overridden: ["问题意图"], cleared: ["展示模式", "图形选中项", "证据抽屉定位"], sourceSemanticVersion: current.context?.semanticVersion, sourceDataVersion: current.context?.dataVersion }
        };
        setState((prev) => ({ ...clearPendingViewRun(prev), serial: prev.serial + 1, currentRunId: id, draftQuestion: "", liveRuns: [blocked, ...prev.liveRuns] }));
      };
      if (unsupportedSingleStructureWhy) {
        blockFollow("当前固定结果不能回答单家融资结构的成因", "请改问该单位的成本及构成，或明确要核对哪一条已发布 Rule；系统不会套用三家规则模板或扩大对象范围。");
        return;
      }
      if (unsupportedNamedCodes.length) {
        blockFollow(`无法识别获准范围内的单位${unsupportedNamedCodes.join("、")}`, "请明确单位553、单位465或单位561；系统不会忽略已点名对象，也不会用其他单位替代。");
        return;
      }
      if ((addVerbPresent || removeVerbPresent || replaceVerbPresent) && (negativeScopeCommand || nonScopeObject)) {
        blockFollow("无法把当前表述确认为对象范围变更", "请使用肯定式指令，并明确写出要加入、移除或覆盖后的获准单位范围；证据、图例、说明、记录和业务明细不会作为范围操作处理。");
        return;
      }
      if (replaceVerbPresent && !replaceIntent) {
        blockFollow("无法确定覆盖后的完整对象范围", "请使用“当前范围改为单位…”并完整列出目标单位，或明确写出“将单位…替换为单位…”。");
        return;
      }
      if (removeVerbPresent && !removeIntent) {
        blockFollow("无法确定要清除的对象", "请明确当前组合中要移除的单位；不能清空全部对象范围，也不会根据历史文字猜测。");
        return;
      }
      const scopeIntentCount = [addIntent, removeIntent, replaceIntent].filter(Boolean).length;
      if (scopeIntentCount > 1) {
        blockFollow("一次追问包含多种对象范围操作", "请只选择加入、移除或覆盖其中一种操作，并明确点名操作后的获准单位范围。");
        return;
      }
      if (scopeIntentCount && !["unit-cost", "pair-cost", "triple-cost"].includes(current.templateId)) {
        blockFollow("当前结果不支持在原意图内直接变更单位组合", "请提出一条完整的新问题并明确对象范围；系统不会把规则解释、集团分析或机构归因静默改写为成本查询。");
        return;
      }
      let unitCodes = explicitCodes;
      let finalQuestion = text;
      let inheritedScope = false;
      let scopeOperation = null;
      if (replaceIntent) {
        if (!replacementCodes.length) {
          blockFollow("无法确定覆盖后的对象范围", "请明确点名单位553、单位465或单位561中的一个或多个单位；系统不会根据历史范围补全覆盖结果。");
          return;
        }
        if (sourceTargetReplaceMatch && (!replacementSourceCodes.length || replacementSourceCodes.some((code) => !currentCodes.includes(code)))) {
          blockFollow("替换来源不在当前对象范围内", "请从当前组合中选择要替换的单位，并明确写出替换后的获准单位；系统不会猜测来源对象。");
          return;
        }
        unitCodes = sourceTargetReplaceMatch
          ? [...new Set([...currentCodes.filter((code) => !replacementSourceCodes.includes(code)), ...replacementCodes])]
          : [...new Set(replacementCodes)];
        const unchanged = unitCodes.length === currentCodes.length && unitCodes.every((code) => currentCodes.includes(code));
        if (unchanged) {
          blockFollow("对象集合没有形成有效的唯一变更", "请明确一个与当前范围不同的完整对象集合；系统不会为无变化范围创建新运行。");
          return;
        }
        finalQuestion = canonicalCostQuestion(unitCodes) || text;
        scopeOperation = "replace";
      } else if (addIntent) {
        const complement = approvedUnitCodes.filter((code) => !currentCodes.includes(code));
        const additions = explicitCodes.length ? explicitCodes : /第三家/.test(text) && complement.length === 1 ? complement : [];
        if (!additions.length) {
          blockFollow("无法唯一确定要加入的单位", "请明确要加入单位553、单位465或单位561中的哪一家；系统不会自行扩大对象范围。");
          return;
        }
        unitCodes = [...new Set([...currentCodes, ...additions])];
        if (unitCodes.length > 3 || unitCodes.length === currentCodes.length) {
          blockFollow("对象集合没有形成有效的唯一变更", "请明确一个当前组合之外的单位；系统不会重复加入或扩大到获准范围之外。");
          return;
        }
        finalQuestion = canonicalCostQuestion(unitCodes) || text;
        inheritedScope = true;
        scopeOperation = "add";
      } else if (removeIntent) {
        const removals = [...new Set(explicitCodes)];
        if (!removals.length) {
          blockFollow("无法唯一确定要移除的单位", "请明确当前组合中要移除的单位；系统不会猜测或清空对象范围。");
          return;
        }
        if (removals.some((code) => !currentCodes.includes(code)) || currentCodes.length - removals.length < 1) {
          blockFollow("对象集合没有形成有效的唯一变更", "请明确当前组合中要移除的单位，并至少保留一个获准单位；系统不会产生无变化运行。");
          return;
        }
        unitCodes = currentCodes.filter((code) => !removals.includes(code));
        finalQuestion = canonicalCostQuestion(unitCodes) || text;
        inheritedScope = true;
        scopeOperation = "remove";
      } else if (inheritedRuleQuestion) {
        unitCodes = clone(currentCodes);
        finalQuestion = `为什么单位${unitCodes[0]}、单位${unitCodes[1]}和单位${unitCodes[2]}分别命中不同规则？`;
        inheritedScope = true;
      } else if (inheritedUnitComposition) {
        unitCodes = clone(currentCodes);
        finalQuestion = `单位${unitCodes[0]}的融资成本及构成是什么？`;
        inheritedScope = true;
      } else if (inheritedThreeUnitBreakdown) {
        unitCodes = clone(currentCodes);
        finalQuestion = `单位${unitCodes[0]}、单位${unitCodes[1]}和单位${unitCodes[2]}分别的平均融资成本是多少？`;
        inheritedScope = true;
      }
      const inheritance = {
        sourceRunId: current.id,
        inherited: scopeOperation === "replace" ? ["场景"] : inheritedScope ? ["场景", "明确对象范围"] : ["场景"],
        overridden: scopeOperation === "replace" ? ["对象范围（已显式覆盖）", "问题意图"] : inheritedScope ? ["对象集合变更", "问题意图"] : ["问题意图", "对象范围由新问题显式指定"],
        cleared: ["展示模式", "图形选中项", "证据抽屉定位"],
        sourceSemanticVersion: current.context?.semanticVersion,
        sourceDataVersion: current.context?.dataVersion
      };
      ask(finalQuestion, inheritance, {
        unitCodes,
        originalQuestion: text,
        finalQuestion,
        sourceRunId: current.id,
        inheritedUnitCodes: inheritedScope && scopeOperation !== "replace" ? currentCodes : [],
        inheritedStableIds: inheritedScope && scopeOperation !== "replace" ? currentCodes.map((code) => `UNIT-${code}`) : [],
        clearedDisplayState: true
      });
    };
    const retry = () => {
      if (!current) return;
      const retryQuestion = current.finalQuestion || current.question;
      const templateId = current.templateId || D.resolveQuestion(retryQuestion);
      const runtime = runtimeForScenario(state, state.activeConfig);
      const enabled = state.enabledConfigs?.length ? state.enabledConfigs : [state.activeConfig];
      const matches = D.matchApplicableAgents(retryQuestion, enabled, runtime, D.RESULT_TEMPLATES[templateId]);
      if (!matches.length) return ask(retryQuestion, current.inheritance, current.queryContext);
      if (matches.length > 1) return setAgentChoice({ question: retryQuestion, inherited: current.inheritance, templateId, matches, selectedId: null, queryContext: current.queryContext });
      createRun(retryQuestion, templateId, current.inheritance, matches[0].config, current.queryContext || { unitCodes: D.referencedUnitCodes(retryQuestion), originalQuestion: current.originalQuestion || retryQuestion });
    };
    const editCurrentQuestion = () => {
      if (!current) return;
      invalidateAsync();
      const original = current.originalQuestion || current.question || "";
      setState((prev) => ({ ...clearPendingViewRun(prev), currentRunId: null, draftQuestion: original }));
    };
    return <div className="page query-page"><PageHeader eyebrow="业务问数" title={VARIANT.id === "conversation" ? "问数工作台" : VARIANT.name} description={VARIANT.id === "conversation" ? "对话优先，证据随行；需要时展开结构化分析。" : VARIANT.id === "analysis" ? "并列查看问题范围、结构化结果、BI 与证据。" : "沿问题、已发布资源、关系和证据导航业务结果。"} actions={current ? <Button icon="plus" onClick={() => setState((prev) => ({ ...clearPendingViewRun(prev), currentRunId: null, draftQuestion: "" }))}>新问题</Button> : null} />
      {!current ? <div className="workspace-grid"><section className="analysis-center"><Composer state={state} setState={setState} ask={ask} notify={notify} /></section><PreRunSide state={state} /></div> : <div className="workspace-grid"><section className="analysis-center">{current.past ? <HistoricalAnswer run={current} setState={setState} rerun={retry} openEvidence={(rowId) => openEvidence(current, rowId)} openContext={() => openContext(current)} /> : current.status === "处理中" ? <RunProgress run={current} /> : current.status === "成功" ? <Answer run={current} state={state} setState={setState} notify={notify} openEvidence={(rowId, resourceId) => openEvidence(current, rowId, resourceId)} openContext={() => openContext(current)} saveView={() => setModal({ type: "save", run: current })} pinView={() => setModal({ type: "pin", run: current })} openAction={(request = null) => setModal({ type: "action", run: current, request, stage: request ? "details" : "confirm" })} follow={followFromCurrent} /> : <BlockedRun run={current} retry={retry} navigate={go} editQuestion={editCurrentQuestion} />}</section><RunSide run={current} openContext={() => openContext(current)} openEvidence={(rowId, resourceId) => openEvidence(current, rowId, resourceId)} /></div>}
      {clarify ? <Modal open title="确认查询对象" description="输入名称不完整，确认后才会固定对象范围。" onClose={() => setClarify(null)} footer={<><Button onClick={() => setClarify(null)}>取消</Button><Button variant="primary" disabled={!clarify.selected} onClick={() => {
        const selected = clarify.selected;
        const selectedCode = selected.replace("单位", "");
        const clarifiedQuestion = replaceAmbiguousUnit55(clarify.question, selected);
        const templateId = D.resolveQuestion(clarifiedQuestion);
        setClarify(null);
        const queryContext = { unitCodes: D.referencedUnitCodes(clarifiedQuestion).length ? D.referencedUnitCodes(clarifiedQuestion) : [selectedCode], originalQuestion: clarify.question };
        ask(clarifiedQuestion, {
          clarification: `已确认“单位55”指${selected}`,
          clarificationRecord: {
            ambiguousText: "单位55",
            candidates: ["单位553", "单位561"],
            confirmedObject: selected,
            finalUnderstanding: clarifiedQuestion.replace(/[？?。]$/, ""),
            deduplicatedObjects: [...new Set(D.referencedUnitCodes(clarifiedQuestion).map((code) => `单位${code}`))]
          }
        }, queryContext);
      }}>确认范围</Button></>}><div className="choice-list">{["单位553", "单位561"].map((item) => <label key={item} className={clarify.selected === item ? "selected" : ""}><input type="radio" name="clarify" onChange={() => setClarify({ ...clarify, selected: item })} /> <strong>{item}</strong><small>{item === "单位553" ? "单位编码 UNIT-553" : "单位编码 UNIT-561"}</small></label>)}</div></Modal> : null}
      {agentChoice ? <Modal open title="确认本轮问数配置" description="多个已启用配置均适用；确认后才固定本轮配置快照。" onClose={() => setAgentChoice(null)} footer={<><Button onClick={() => setAgentChoice(null)}>取消</Button><Button variant="primary" disabled={!agentChoice.selectedId} onClick={() => { const selected = agentChoice.matches.find((item) => item.config.id === agentChoice.selectedId)?.config; if (!selected) return; const payload = agentChoice; setAgentChoice(null); createRun(payload.question, payload.templateId, payload.inherited, selected, payload.queryContext); }}>确认配置</Button></>}><div className="choice-list">{agentChoice.matches.map((item) => <label key={item.config.id} className={agentChoice.selectedId === item.config.id ? "selected" : ""}><input type="radio" name="agent-choice" onChange={() => setAgentChoice({ ...agentChoice, selectedId: item.config.id })} /><strong>{item.config.name}</strong><small>{item.config.version} · {item.config.semanticVersion}</small><p>{item.reason}</p></label>)}</div></Modal> : null}
    </div>;
  }

  function SemanticPage({ state, notify }) {
    const context = D.readPublishedOntologyContext();
    const runtime = runtimeForScenario(state, state.activeConfig);
    const discoverable = context.discoverable ?? Boolean(context.versionId && context.resources?.length);
    const [type, setType] = React.useState("全部");
    const [query, setQuery] = React.useState("");
    const [selected, setSelected] = React.useState(null);
    const allowedResourceIds = new Set(state.activeConfig?.allowedResources || []);
    const resources = (discoverable ? context.resources : []).filter((item) => allowedResourceIds.has(item.id) && (type === "全部" || item.type === type) && `${item.name}${item.id}${item.definition || ""}`.toLowerCase().includes(query.toLowerCase()));
    const openOntology = (item) => {
      const href = D.buildOntologyDeepLink(context, item.id);
      if (!href) return notify("精确已发布版本或资源不可定位，不会改用当前版本中的同名资源", "danger");
      window.open(href, "_blank", "noopener,noreferrer");
    };
    const entity = resources.find((item) => item.id === "OBJ-FINANCING-ENTITY");
    const detail = resources.find((item) => item.id === "OBJ-FINANCING-DETAIL");
    const institution = resources.find((item) => item.id === "OBJ-FINANCIAL-INSTITUTION");
    return <div className="page"><PageHeader eyebrow="只读发现" title="语义资源" description="仅显示当前问数设置可引用的已发布业务对象、属性、关系、指标、规则和行动类型。" status={discoverable ? "可发现" : "阻断"} />
      {!discoverable ? <Notice tone="warning" title={context.status}>{context.reason}。{context.recovery}</Notice> : <><ContextBar semanticVersion={context.semanticVersion} /><Notice tone={runtime?.ready ? "success" : "warning"} compact title={runtime?.ready ? "当前上下文可用于正式问数" : "资源可查看，正式问数暂不可用"}>{runtime?.ready ? "已发布语义与当前数据上下文已核对。" : `${runtime?.reason || context.reason || "数据可信度上下文尚未完整"}。目录与资源详情仍保持只读可见。`}</Notice></>}
      <div className="workspace-toolbar"><label className="search-box"><Icon name="search" size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索业务名称、定义或资源编号" /></label><select value={type} onChange={(event) => setType(event.target.value)}>{["全部", "Object Type", "Property", "Link Type", "Metric", "Rule", "Action Type"].map((item) => <option key={item} value={item}>{({ "Object Type": "业务对象", Property: "属性", "Link Type": "关系", Metric: "指标", Rule: "规则", "Action Type": "行动类型" }[item] || item)}</option>)}</select><span className="toolbar-spacer"></span><span>{resources.length} 项</span></div>
      <div className="workspace-grid"><section className="semantic-canvas"><header><div><h2>智能问数语义消费清单</h2><p>{discoverable ? `已发布版本 ${context.semanticVersion}` : "等待已发布语义版本"}</p></div></header>{resources.length ? <div className="resource-grid">{resources.map((item) => <article className="resource-card" key={item.id}><header><span><Icon name={item.type === "Metric" ? "calculator" : item.type === "Rule" ? "shield-check" : item.type === "Link Type" ? "git-branch" : item.type === "Property" ? "list-tree" : item.type === "Action Type" ? "send" : "boxes"} /></span><StatusBadge status="已发布目录" /></header><h3>{item.name}</h3><code>{item.id}</code><p>{item.scope || item.definition || "上游未提供业务范围说明"}</p><footer><span>{({ "Object Type": "业务对象", Property: "属性", "Link Type": "关系", Metric: "指标", Rule: "规则", "Action Type": "行动类型" }[item.type] || item.type)}{item.unit ? ` · ${item.unit}` : ""}</span><button onClick={() => setSelected(item)}>查看详情<Icon name="chevron-right" size={14} /></button></footer></article>)}</div> : <EmptyState title={discoverable ? "没有匹配资源" : "尚无可发现的已发布语义资源"} description={discoverable ? "调整搜索或资源类型后重试。" : "本体管理完成发布后，当前消费清单内的资源才会显示。"} compact />}</section>
        <aside className="semantic-side"><header><div><h2>获准关系路径</h2><p>只沿已发布关系的获准方向导航。</p></div></header>{discoverable && entity && detail && institution ? <div className="semantic-path"><button className="semantic-node used" onClick={() => setSelected(entity)}><span className="node-type">业务对象</span><strong>{entity.name}</strong><code>{entity.id}</code></button><span className="semantic-edge"><span>主体可反向取得明细</span></span><button className="semantic-node used" onClick={() => setSelected(detail)}><span className="node-type">业务对象</span><strong>{detail.name}</strong><code>{detail.id}</code></button><span className="semantic-edge"><span>仅明细到机构</span></span><button className="semantic-node used" onClick={() => setSelected(institution)}><span className="node-type">业务对象</span><strong>{institution.name}</strong><code>{institution.id}</code></button></div> : <EmptyState compact title="关系路径不可用" description="已发布资源可定位后才显示业务导航路径。" />}<Notice tone={context.linkProblems?.length ? "warning" : "neutral"} compact title={context.linkProblems?.length ? "当前发布关系不兼容" : "导航限制"}>{context.linkProblems?.[0]?.reason || "不允许机构反查融资明细，也不允许负责人反查主体。"}</Notice></aside></div>
      {selected ? <Drawer open title={selected.name} description={`${selected.id}`} onClose={() => setSelected(null)} footer={<><Button onClick={() => setSelected(null)}>关闭</Button><Button variant="primary" icon="arrow-up-right" disabled={!discoverable} onClick={() => openOntology(selected)}>查看详情</Button></>}><FactGrid columns={2}><Fact label="资源编号" value={selected.id} mono /><Fact label="目录状态" value="位于精确已发布版本" /><Fact label="生命周期状态" value={selected.lifecycleStatus || "上游未提供"} /><Fact label="维护方" value={selected.owner || "本体管理"} /><Fact label="适用范围" value={selected.scope || "上游未提供"} /><Fact label="单位" value={selected.unit || "不适用"} /><Fact label="时间语义" value={selected.time || "上游未提供"} /><Fact label="业务有效期" value={selected.effectivePeriod || "上游未提供"} /><Fact label="替代与变更" value={selected.replacementFact || "上游未提供"} /><Fact label="正式问数" value={runtime?.ready ? "可用" : "暂不可用"} /></FactGrid><Notice tone="info" title="只读引用">定义、发布和版本由本体管理负责；智能问数只保存绑定和稳定引用。</Notice></Drawer> : null}
    </div>;
  }

  function HistoryPage({ state, setState, navigate }) {
    const [filter, setFilter] = React.useState("全部");
    const [selected, setSelected] = React.useState(null);
    const detailRef = React.useRef(null);
    const runs = allRuns(state).filter((run) => filter === "全部" || run.status === filter);
    const open = (run) => { setState((prev) => ({ ...clearPendingViewRun(prev), currentRunId: run.id })); navigate("ask"); };
    const selectRun = (run) => {
      setSelected(run);
      if (matchMedia("(max-width: 700px)").matches) window.setTimeout(() => detailRef.current?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }), 0);
    };
    return <div className="page"><PageHeader eyebrow="运行记录" title="历史会话" description="每轮保留原问题、固定上下文、状态、结果和证据；不会被当前版本改写。" actions={<Button variant="primary" icon="plus" onClick={() => { setState((prev) => ({ ...clearPendingViewRun(prev), currentRunId: null })); navigate("ask"); }}>新问题</Button>} />
      <div className="horizontal-scroll-frame history-tabs-frame"><Tabs items={["全部", "成功", "阻断", "已废弃"].map((id) => ({ id, label: id }))} activeId={filter} onChange={setFilter} /><span className="horizontal-scroll-cue" aria-hidden="true"><Icon name="move-horizontal" size={13} />左右滑动</span></div>
      <div className="history-detail"><div className="history-list">{runs.length ? runs.map((run) => <button key={run.id} className={selected?.id === run.id ? "selected" : ""} onClick={() => selectRun(run)}><span className="history-icon"><Icon name={run.status === "成功" ? "circle-check" : run.status === "已废弃" ? "refresh-cw-off" : "octagon-alert"} /></span><div><strong>{run.clarificationRecord?.finalUnderstanding || run.question}</strong><p>{run.clarificationRecord ? `原输入：${run.originalQuestion || run.question} · 已确认 ${run.clarificationRecord.confirmedObject}` : run.result?.title || run.failure}</p><small>{run.createdAt} · {run.context?.semanticVersion || "无正式结果"}</small></div><StatusBadge status={run.status} /></button>) : <EmptyState compact icon="history" title={filter === "全部" ? "暂无历史会话" : `暂无${filter}记录`} description="提交问题后，运行状态、上下文和证据会在这里保留。" primaryAction={<Button size="sm" variant="primary" onClick={() => navigate("ask")}>去问数</Button>} />}</div>
        <section className="resource-detail" ref={detailRef}>{selected ? <><header><div><h2>{selected.clarificationRecord?.finalUnderstanding || selected.question}</h2><p>{selected.id} · {selected.createdAt}</p></div><StatusBadge status={selected.status} /></header>{selected.context ? <ContextBar semanticVersion={selected.context.semanticVersion} dataVersion={selected.context.dataVersion} dataAsOf={selected.context.asOf} quality={selected.context.quality || "无法判断"} freshness={selected.context.freshness || "无法判断"} /> : null}{selected.clarificationRecord ? <Notice tone="info" title="对象范围已澄清"><FactGrid columns={2}><Fact label="原始输入" value={selected.originalQuestion || selected.question} /><Fact label="歧义片段" value={selected.clarificationRecord.ambiguousText} /><Fact label="候选对象" value={selected.clarificationRecord.candidates.join("、")} /><Fact label="用户确认" value={selected.clarificationRecord.confirmedObject} /><Fact label="最终问题理解" value={selected.clarificationRecord.finalUnderstanding} /><Fact label="去重后对象" value={selected.clarificationRecord.deduplicatedObjects.join("、")} /></FactGrid></Notice> : null}<p>{selected.result?.summary || selected.failure}</p>{selected.recovery ? <Notice tone="warning" title="恢复方式">{selected.recovery}</Notice> : null}{selected.past ? <Notice tone="info" compact title="历史快照只读">继续查看不会改变当前版本；重新运行将创建新的正式轮次。</Notice> : null}<div className="view-actions"><Button variant="primary" onClick={() => open(selected)}>{selected.status === "成功" ? "查看历史结果" : selected.status === "已废弃" ? "按当前版本重新运行" : "查看详情"}</Button></div></> : <EmptyState compact title="选择一条历史记录" description="查看当时的版本、状态、结果与恢复方式。" />}</section></div>
    </div>;
  }

  function ViewsPage({ state, setState, navigate, notify, setModal }) {
    const [tab, setTab] = React.useState("views");
    const [mode, setMode] = React.useState(state.ui.viewMode || "cards");
    const [selected, setSelected] = React.useState(null);
    const [parameterEdit, setParameterEdit] = React.useState(null);
    const [openViewMenuId, setOpenViewMenuId] = React.useState(null);
    const semanticContext = D.readPublishedOntologyContext();
    const views = state.savedViews.map((view) => ({ ...view, runtimeState: viewRuntimeState(view, semanticContext, state.activeConfig, state.scenarioContext) }));
    const lastRunFor = (view) => getRun(state, view.lastRunId);
    const canPin = (view) => pinEligibility(lastRunFor(view), view, state.scenarioContext).allowed;
    const parameterRule = (view) => ({
      "unit-cost": { minimum: 1, maximum: 1, options: ["553", "465", "561"] },
      "pair-cost": { minimum: 2, maximum: 2, options: ["553", "465", "561"] },
      "triple-cost": { minimum: 3, maximum: 3, options: ["553", "465", "561"] }
    }[view.templateId] || { minimum: 0, maximum: 0, options: [] });
    const hasAlternativeParameters = (view) => {
      const rule = parameterRule(view);
      const current = D.referencedUnitCodes(view.question).sort().join("|");
      if (!rule.options.length || rule.minimum !== rule.maximum) return false;
      const combinations = [];
      const collect = (start, chosen) => {
        if (chosen.length === rule.minimum) { combinations.push(chosen); return; }
        for (let index = start; index < rule.options.length; index += 1) collect(index + 1, [...chosen, rule.options[index]]);
      };
      collect(0, []);
      return combinations.some((codes) => [...codes].sort().join("|") !== current);
    };
    React.useEffect(() => {
      if (selected && selected.recordType !== "pin" && !state.savedViews.some((view) => view.id === selected.id)) setSelected(null);
    }, [state.savedViews, selected]);
    React.useEffect(() => {
      if (!openViewMenuId) return undefined;
      const menuRoot = document.querySelector(`[data-view-menu="${openViewMenuId}"]`);
      const trigger = menuRoot?.querySelector(".view-more-trigger");
      const enabledItems = () => [...(menuRoot?.querySelectorAll('[role="menuitem"]:not(:disabled)') || [])];
      const closeMenu = (restoreFocus = false) => {
        setOpenViewMenuId(null);
        if (restoreFocus) window.setTimeout(() => trigger?.focus(), 0);
      };
      const handlePointerDown = (event) => {
        if (menuRoot && !menuRoot.contains(event.target)) closeMenu(false);
      };
      const handleKeyDown = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeMenu(true);
          return;
        }
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        const items = enabledItems();
        if (!items.length) return;
        event.preventDefault();
        const currentIndex = items.indexOf(document.activeElement);
        const nextIndex = event.key === "Home" ? 0
          : event.key === "End" ? items.length - 1
          : event.key === "ArrowDown" ? (currentIndex + 1 + items.length) % items.length
          : (currentIndex - 1 + items.length) % items.length;
        items[nextIndex].focus();
      };
      document.addEventListener("pointerdown", handlePointerDown);
      document.addEventListener("keydown", handleKeyDown);
      window.setTimeout(() => enabledItems()[0]?.focus(), 0);
      return () => {
        document.removeEventListener("pointerdown", handlePointerDown);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }, [openViewMenuId]);
    const rerun = (view) => {
      if (view.runtimeState?.status !== "可运行") { notify(view.runtimeState?.reason || "当前视图暂不能运行", "danger"); return; }
      const restoredDisplay = { mode: view.displayPreference?.mode || "text", chart: view.displayPreference?.chart || "recommended", selected: null };
      setState((prev) => ({ ...prev, draftQuestion: view.question, currentRunId: null, pendingViewRun: { viewId: view.id, question: view.question, queryDefinition: clone(view.queryDefinition), displayPreference: clone(view.displayPreference), restoredDisplay } }));
      navigate("ask"); notify(`已载入“${view.name}”的查询定义和展示偏好，请确认后运行`);
    };
    const openParameterEdit = (view) => {
      if (view.runtimeState?.status !== "可运行") { notify(view.runtimeState?.reason || "当前视图暂不能运行", "danger"); return; }
      const rule = parameterRule(view);
      const referenced = D.referencedUnitCodes(view.question);
      const selectedUnits = rule.options.filter((code) => referenced.includes(code));
      setParameterEdit({ view, rule, selectedUnits: selectedUnits.length ? selectedUnits : rule.options.slice(0, rule.minimum) });
    };
    const toggleParameterUnit = (code) => setParameterEdit((current) => {
      if (!current) return current;
      const selectedUnits = current.selectedUnits.includes(code)
        ? current.selectedUnits.filter((item) => item !== code)
        : [...current.selectedUnits, code];
      return { ...current, selectedUnits };
    });
    const parameterQuestion = (templateId, unitCodes, fallback) => {
      const units = unitCodes.map((code) => `单位${code}`);
      if (templateId === "unit-cost") return `${units[0]}平均融资成本及构成是什么？`;
      if (templateId === "pair-cost") return `${units[0]}和${units[1]}综合平均融资成本是多少？`;
      if (templateId === "triple-cost") return `${units.slice(0, -1).join("、")}和${units[units.length - 1]}综合平均融资成本是多少？`;
      if (templateId === "institution-priority") return `${units[0]}的异常贷款应优先与哪些金融机构协商？`;
      return fallback;
    };
    const confirmParameters = () => {
      if (!parameterEdit) return;
      const { view, rule, selectedUnits } = parameterEdit;
      if (selectedUnits.length < rule.minimum || selectedUnits.length > rule.maximum) return;
      const question = parameterQuestion(view.templateId, selectedUnits, view.question);
      const queryDefinition = clone(view.queryDefinition);
      if (selectedUnits.length) queryDefinition.objectScope = selectedUnits.map((code) => `单位${code}`);
      queryDefinition.parameters = { ...(queryDefinition.parameters || {}), unitCodes: clone(selectedUnits), originalQuestion: question };
      setState((prev) => ({ ...prev, draftQuestion: question, currentRunId: null, pendingViewRun: { viewId: view.id, question, queryDefinition, displayPreference: clone(view.displayPreference), parameterConfirmed: true } }));
      setParameterEdit(null);
      navigate("ask");
      notify("参数已载入，请核对问题后提交运行");
    };
    const copyView = (view) => {
      setState((prev) => {
        const source = prev.savedViews.find((item) => item.id === view.id) || view;
        return { ...prev, savedViews: [{ ...clone(source), id: D.nextStableId("VIEW"), name: `${source.name} 副本`, createdAt: now(), status: source.status, issue: source.issue, lastRunId: null }, ...prev.savedViews], serial: prev.serial + 1 };
      });
      notify(view.status === "需修订" ? "视图已复制，需修订状态保持不变；副本尚未运行" : "视图已复制；副本尚未运行");
    };
    const remove = (view) => setModal({ type: "delete-view", view });
    const openHistory = (view) => {
      const run = getRun(state, view.lastRunId);
      if (!run) { notify("该视图尚无可定位的历史运行", "warning"); return; }
      setState((prev) => ({ ...clearPendingViewRun(prev), currentRunId: run.id }));
      navigate("ask");
    };
    const preparePin = (view) => {
      const run = getRun(state, view.lastRunId);
      setModal({ type: "pin", view, run, stage: "confirm" });
    };
    const runViewMenuAction = (action) => {
      setOpenViewMenuId(null);
      action();
    };
    return <div className="page"><PageHeader eyebrow="复用查询" title="问数视图" description="保存并重复使用常用查询。问数视图保存查询条件和展示方式，运行时会根据当前正式版本重新取得结果。" actions={<Segmented items={[{ id: "cards", label: "卡片", icon: "layout-grid" }, { id: "list", label: "列表", icon: "list" }]} activeId={mode} onChange={(value) => { setMode(value); setState((prev) => ({ ...prev, ui: { ...prev.ui, viewMode: value } })); }} />} />
      <div className="horizontal-scroll-frame views-tabs-frame"><Tabs items={[{ id: "views", label: "已保存查询", count: state.savedViews.length }, { id: "pins", label: "固定引用", count: state.pins.length }]} activeId={tab === "actions" ? "views" : tab} onChange={setTab} /><span className="horizontal-scroll-cue" aria-hidden="true"><Icon name="move-horizontal" size={13} />左右滑动</span></div>
      {tab !== "pins" ? (views.length ? <div className={`view-collection ${mode}`}>{views.map((view) => {
        const lastRun = lastRunFor(view);
        return <article className={`saved-view ${openViewMenuId === view.id ? "is-menu-open" : ""}`} key={view.id}><header><span><Icon name="panels-top-left" /></span><StatusBadge status={view.runtimeState.status} /></header><h3>{view.name}</h3><p>{view.question}</p><FactGrid columns={2}><Fact label="查询对象" value={view.queryDefinition.objectScope?.join("、") || "运行时参数"} /><Fact label="默认展示" value={`${displayModeLabel(view.displayPreference.mode)} · ${chartLabel(view.displayPreference.chart)}`} /><Fact label="最近运行" value={lastRun?.completedAt || "尚未运行"} /><Fact label="当前状态" value={view.runtimeState.status} /></FactGrid>{view.runtimeState.status !== "可运行" ? <Notice tone="warning" compact>{view.runtimeState.reason}</Notice> : null}<footer><span>{lastRun ? `最近结果：${lastRun.status}` : "尚无运行结果"}</span><div className="view-primary-actions"><Button size="sm" variant="primary" disabled={view.runtimeState.status !== "可运行"} title={view.runtimeState.status !== "可运行" ? view.runtimeState.reason : "按当前正式版本运行"} onClick={() => rerun(view)}>运行</Button>{hasAlternativeParameters(view) ? <Button size="sm" disabled={view.runtimeState.status !== "可运行"} title={view.runtimeState.status !== "可运行" ? view.runtimeState.reason : "调整对象参数后运行"} onClick={() => openParameterEdit(view)}>换参数运行</Button> : null}<div className="view-more" data-view-menu={view.id}><button type="button" className="view-more-trigger" aria-label={`${view.name}更多操作`} aria-haspopup="menu" aria-expanded={openViewMenuId === view.id} onClick={() => setOpenViewMenuId((current) => current === view.id ? null : view.id)}><Icon name="ellipsis" size={15} />更多</button>{openViewMenuId === view.id ? <div className="view-more-menu" role="menu" aria-label={`${view.name}更多操作`}><button role="menuitem" onClick={() => runViewMenuAction(() => setSelected(view))}>查看设置</button>{view.lastRunId ? <button role="menuitem" onClick={() => runViewMenuAction(() => openHistory(view))}>查看历史结果</button> : null}<button role="menuitem" onClick={() => runViewMenuAction(() => copyView(view))}>复制</button>{canPin(view) ? <button role="menuitem" onClick={() => runViewMenuAction(() => preparePin(view))}>固定到仪表盘</button> : null}<button role="menuitem" className="danger" onClick={() => runViewMenuAction(() => remove(view))}>删除</button></div> : null}</div></div></footer></article>;
      })}</div> : <EmptyState icon="panels-top-left" title="暂无问数视图" description="完成一次正式问数后，可将查询条件和展示偏好保存为问数视图。" primaryAction={<Button variant="primary" onClick={() => navigate("ask")}>去问数</Button>} />) : null}
      {tab === "pins" ? (state.pins.length ? <div className={`view-collection ${mode}`}>{state.pins.map((pin) => {
        const sourceView = state.savedViews.find((view) => view.id === pin.viewId) || null;
        const snapshot = pin.deliverySnapshot || {};
        return <article className="saved-view fixed-reference" key={pin.id}><header><span><Icon name="pin" /></span><StatusBadge status={pin.status} /></header><h3>{pin.title}</h3><p>{sourceView?.question || "已接收的问数视图引用"}</p><FactGrid columns={2}><Fact label="来源视图" value={sourceView?.name || pin.viewId || "未保留"} /><Fact label="固定结果" value={snapshot.fixedResultIdentity?.fixedResultId || "未保留"} mono /><Fact label="语义 / 数据版本" value={[snapshot.semanticVersion, snapshot.dataVersion].filter(Boolean).join(" · ") || "未保留"} /><Fact label="接收时间" value={pin.receivedAt || snapshot.capturedAt || "未保留"} /></FactGrid><Notice tone="info" compact>{pin.note || "仅表示报告中心接收视图引用，不表示仪表盘已经发布。"}</Notice><footer><span>{snapshot.evidenceIds?.length ? `${snapshot.evidenceIds.length} 项证据引用` : "只读交付快照"}</span><div className="view-primary-actions"><Button size="sm" onClick={() => setSelected({ ...pin, recordType: "pin" })}>查看详情</Button></div></footer></article>;
      })}</div> : <EmptyState icon="pin" title="暂无固定引用" description="成功运行并满足跨模块合同后，才可将问数视图引用交付报告中心。" primaryAction={<Button variant="primary" onClick={() => navigate("ask")}>去问数</Button>} />) : null}
      {selected && selected.recordType !== "pin" ? <Drawer open title={selected.name} description="查看设置" onClose={() => setSelected(null)} footer={<><Button onClick={() => setSelected(null)}>关闭</Button>{canPin(selected) ? <Button onClick={() => preparePin(selected)}>固定到仪表盘</Button> : null}{hasAlternativeParameters(selected) ? <Button disabled={selected.runtimeState.status !== "可运行"} title={selected.runtimeState.status !== "可运行" ? selected.runtimeState.reason : "调整对象参数后运行"} onClick={() => openParameterEdit(selected)}>换参数运行</Button> : null}<Button variant="primary" disabled={selected.runtimeState.status !== "可运行"} title={selected.runtimeState.status !== "可运行" ? selected.runtimeState.reason : "运行"} onClick={() => rerun(selected)}>运行</Button></>}><section className="panel"><div className="panel-head"><div><h2>查询定义</h2><p>决定对象、资源、筛选、排序和时间策略。</p></div></div><div className="panel-body"><FactGrid columns={2}><Fact label="对象" value={selected.queryDefinition.objectScope?.join("、") || "运行时参数"} /><Fact label="稳定资源身份" value={`${selected.queryDefinition.resourceIds.length} 项`} /><Fact label="分组" value={selected.queryDefinition.grouping?.join("、") || "无"} /><Fact label="排序" value={selected.queryDefinition.sorting} /><Fact label="时间策略" value={selected.queryDefinition.timePolicy} /><Fact label="Top N" value={selected.queryDefinition.topN || "无"} /><Fact label="保存时语义版本" value={selected.semanticVersion || "历史视图未保留"} /><Fact label="精确版本身份" value={selected.semanticVersionId || "历史视图未保留"} mono /></FactGrid></div></section><section className="panel"><div className="panel-head"><div><h2>展示偏好</h2><p>不能改变查询口径和数据结果。</p></div></div><div className="panel-body"><FactGrid columns={2}><Fact label="形态" value={displayModeLabel(selected.displayPreference.mode)} /><Fact label="图表" value={chartLabel(selected.displayPreference.chart)} /><Fact label="图例" value={selected.displayPreference.legend ? "显示" : "隐藏"} /><Fact label="排序方向" value={selected.displayPreference.direction} /></FactGrid></div></section>{selected.runtimeState.status !== "可运行" ? <Notice tone="warning" title={selected.runtimeState.status === "需修订" ? "需修订后运行" : "等待正式上下文"}>{selected.runtimeState.reason}</Notice> : <Notice tone="success" compact title="稳定身份仍可定位">展示偏好不会修改查询口径或数据结果。</Notice>}</Drawer> : null}
      {selected?.recordType === "pin" ? <Drawer open title={selected.title} description={selected.id} onClose={() => setSelected(null)} footer={<Button onClick={() => setSelected(null)}>关闭</Button>}><Notice tone="info" title="接收不等于仪表盘发布">{selected.note || "报告中心拥有卡片、布局、编排和发布生命周期。"}</Notice><section className="panel"><div className="panel-head"><div><h2>交付快照</h2><p>提交时固定的查询定义、展示建议、结果身份和证据，只读保留。</p></div><StatusBadge status={selected.status} /></div><div className="panel-body"><FactGrid columns={2}><Fact label="快照状态" value={selected.deliverySnapshot?.snapshotStatus || "只读交付快照"} /><Fact label="固定时间" value={selected.deliverySnapshot?.capturedAt || selected.submittedAt || selected.receivedAt || "未保留"} /><Fact label="查询范围" value={selected.deliverySnapshot?.queryDefinition?.objectScope?.join("、") || "未保留"} /><Fact label="展示建议" value={selected.deliverySnapshot?.displaySuggestion ? `${displayModeLabel(selected.deliverySnapshot.displaySuggestion.mode)} · ${chartLabel(selected.deliverySnapshot.displaySuggestion.chart)}` : "未保留"} /><Fact label="固定结果身份" value={selected.deliverySnapshot?.fixedResultIdentity?.fixedResultId || selected.deliverySnapshot?.fixedResult?.fixedResultId || "未保留"} mono /><Fact label="精确语义版本" value={selected.deliverySnapshot?.semanticVersion || "未保留"} /><Fact label="精确版本身份" value={selected.deliverySnapshot?.versionId || "未保留"} mono /><Fact label="数据版本" value={selected.deliverySnapshot?.dataVersion || "未保留"} mono /><Fact label="数据截至" value={selected.deliverySnapshot?.asOf || "未保留"} /><Fact label="质量与新鲜度" value={[selected.deliverySnapshot?.quality, selected.deliverySnapshot?.freshness].filter(Boolean).join(" · ") || "未保留"} /><Fact label="证据引用" value={`${selected.deliverySnapshot?.evidenceIds?.length || 0} 项`} /></FactGrid></div></section></Drawer> : null}
      {parameterEdit ? <Modal open title="设置运行参数" description="先调整查询对象，再载入问数工作台确认提交；展示偏好不会反向修改查询口径。" onClose={() => setParameterEdit(null)} footer={<><Button onClick={() => setParameterEdit(null)}>取消</Button><Button variant="primary" disabled={parameterEdit.selectedUnits.length < parameterEdit.rule.minimum || parameterEdit.selectedUnits.length > parameterEdit.rule.maximum} onClick={confirmParameters}>载入并继续</Button></>}><FactGrid columns={2}><Fact label="来源视图" value={parameterEdit.view.name} /><Fact label="时间策略" value={parameterEdit.view.queryDefinition.timePolicy} /></FactGrid>{parameterEdit.rule.options.length > 1 ? <div className="choice-list">{parameterEdit.rule.options.map((code) => <label key={code} className={parameterEdit.selectedUnits.includes(code) ? "selected" : ""}><input type="checkbox" checked={parameterEdit.selectedUnits.includes(code)} onChange={() => toggleParameterUnit(code)} /><strong>单位{code}</strong><small>稳定对象身份 UNIT-{code}</small></label>)}</div> : <Notice tone="neutral" title="当前查询没有可替换的对象参数">本视图仍会在提交前显示完整对象范围和查询定义。</Notice>}<Notice tone={parameterEdit.selectedUnits.length === parameterEdit.rule.minimum && parameterEdit.selectedUnits.length === parameterEdit.rule.maximum ? "info" : "warning"}>当前已选 {parameterEdit.selectedUnits.length} 项；此查询需要选择 {parameterEdit.rule.minimum} 项。</Notice></Modal> : null}
    </div>;
  }

  function CapabilityRows({ required = [], observed = [], expectedStatus, emptyLabel }) {
    const observedById = new Map(observed.map((item) => [item.id, item]));
    if (!required.length) return <EmptyState compact title={emptyLabel || "当前没有配置项"} />;
    return <div className="skill-list">{required.map((item) => {
      const actual = observedById.get(item.id);
      const verified = Boolean(actual && actual.version === item.version && actual.status === expectedStatus);
      const status = verified ? expectedStatus : expectedStatus === "已加载" ? "待核验" : "可用性待核验";
      return <div key={item.id} title={`${item.id} · 维护方 ${item.owner} · ${item.boundary}`}><span className={`skill-icon ${verified ? "ok" : "pending"}`}><Icon name={verified ? "check" : "clock-3"} size={13} /></span><strong>{item.name}</strong><span>要求 {item.version}</span><span>{actual ? `实际 ${actual.version}` : "尚无运行证明"}</span><StatusBadge status={status} /></div>;
    })}</div>;
  }

  function CapabilityGroups({ config }) {
    return <div className="capability-groups">
      <section className="capability-group"><header><div><strong>配置要求的 Skill</strong><small>负责发现、消歧和规划，不计算指标或判断规则。</small></div><Badge tone="neutral">{config.skills?.length || 0} 项</Badge></header><CapabilityRows required={config.skills} observed={config.observedSkills} expectedStatus="已加载" /></section>
      <section className="capability-group"><header><div><strong>允许使用的 Tool</strong><small>执行语义查询、证据读取和行动请求提交。</small></div><Badge tone="neutral">{config.tools?.length || 0} 项</Badge></header><CapabilityRows required={config.tools} observed={config.observedTools} expectedStatus="可用" /></section>
      <section className="capability-group"><header><div><strong>平台确定性能力</strong><small>不属于 LLM Skill，也不由模型自行执行。</small></div><Badge tone="neutral">{config.deterministicCapabilities?.length || 0} 项</Badge></header><div className="capability-chip-list">{(config.deterministicCapabilities || []).map((item) => <span key={item.id} title={`${item.id} · ${item.boundary}`}><Icon name="shield-check" size={14} /><strong>{item.name}</strong><small>平台执行</small></span>)}</div></section>
      <Notice tone={config.loadProof ? "success" : "warning"} compact title={config.loadProof ? "加载证明可核对" : "配置已要求，实际加载状态待核验"}>{config.loadProof ? `${config.loadProof} · 最近核验 ${config.lastRuntimeVerificationAt}` : "当前未取得运行承载返回的 Skill / Tool 实际版本、状态、加载证明和核验时间；正式问数会保持阻断。"}</Notice>
    </div>;
  }

  function AgentPage({ state, setState, notify }) {
    const [tab, setTab] = React.useState("active");
    const [activeValidation, setActiveValidation] = React.useState("未开始");
    const [activeValidationMessage, setActiveValidationMessage] = React.useState(null);
    const [consumptionValidation, setConsumptionValidation] = React.useState(() => state.candidateConsumptionValidation || { status: "未开始", attempts: [], activeRun: null });
    const [selectedCandidateQuestion, setSelectedCandidateQuestion] = React.useState(null);
    const deliveryInFlight = React.useRef(new Set());
    const stateRef = React.useRef(state);
    React.useEffect(() => { stateRef.current = state; }, [state]);
    const activeConfig = configForScenario(state.activeConfig, state.scenarioContext);
    const candidate = configForScenario(state.candidateConfig, state.scenarioContext);
    const runtime = runtimeForScenario(state, activeConfig);
    const candidateContext = candidateForScenario(state, candidate);
    const configState = D.deriveConfigRuntimeState(activeConfig, runtime, D.readOntologyBindingContext());
    React.useEffect(() => {
      setState((prev) => ({ ...prev, candidateConsumptionValidation: consumptionValidation }));
    }, [consumptionValidation]);
    const validateActive = () => {
      const validationConfig = configForScenario(state.activeConfig, state.scenarioContext);
      const validationConfigFingerprint = agentConfigInputFingerprint(validationConfig);
      const startedContext = runtimeForScenario(state, validationConfig);
      if (!startedContext?.ready) {
        const message = `${startedContext?.status || "上下文不完整"}：${startedContext?.reason || "无法完成配置验证"}`;
        setActiveValidation("失败");
        setActiveValidationMessage(message);
        notify(message, "danger");
        return;
      }
      const epoch = beginAsync();
      setActiveValidation("验证中");
      setActiveValidationMessage(null);
      window.setTimeout(() => {
        if (!asyncIsCurrent(epoch)) return;
        const latestState = stateRef.current;
        const currentConfig = configForScenario(latestState.activeConfig, latestState.scenarioContext);
        const currentRuntime = runtimeForScenario(latestState, currentConfig);
        if (!currentRuntime?.ready || currentRuntime.runtimeContextFingerprint !== startedContext.runtimeContextFingerprint || agentConfigInputFingerprint(currentConfig) !== validationConfigFingerprint) {
          setActiveValidation("失败");
          setActiveValidationMessage("验证期间正式上下文发生变化，现有配置继续保持需重验。请取得完整的新上下文后重新验证。");
          notify("验证期间正式上下文发生变化，现有配置继续保持需重验", "danger");
          return;
        }
        const check = D.validateFixedQuestionSet({ ...validationConfig, bindingVersionId: startedContext.versionId, semanticVersion: startedContext.semanticVersion, resourceContractFingerprint: startedContext.resourceContractFingerprint }, startedContext);
        if (!check.passed) { const message = check.issues[0] || "固定问题验证失败"; setActiveValidation("失败"); setActiveValidationMessage(message); notify(message, "danger"); return; }
        const verifiedAt = now();
        const validated = {
          ...configForScenario(stateRef.current.activeConfig, stateRef.current.scenarioContext),
          sceneId: startedContext.scenarioId,
          sceneVersion: startedContext.scenarioVersion,
          sceneVersionStatus: startedContext.scenarioReferenceStatus,
          bindingVersionId: startedContext.versionId,
          semanticVersion: startedContext.semanticVersion,
          bindingVersion: `${startedContext.semanticVersion} · ${startedContext.versionId}`,
          resourceContractFingerprint: startedContext.resourceContractFingerprint,
          compatibility: "兼容",
          validationRef: `配置验证-${Date.now().toString(36).toUpperCase()}`,
          c009Validation: {
            owner: "智能问数", status: "通过", checkedAt: verifiedAt,
            sceneId: startedContext.scenarioId, sceneVersion: startedContext.scenarioVersion,
            sceneVersionStatus: startedContext.scenarioReferenceStatus,
            versionId: startedContext.versionId, semanticVersion: startedContext.semanticVersion,
            dataVersion: startedContext.dataVersion, asOf: startedContext.asOf,
            t019EvidenceCode: startedContext.t019EvidenceCode,
            configFingerprint: stateRef.current.activeConfig.contentFingerprint,
            resourceContractFingerprint: startedContext.resourceContractFingerprint,
            runtimeContextFingerprint: startedContext.runtimeContextFingerprint,
            questionResults: check.questions
          }
        };
        setState((prev) => ({ ...prev, activeConfig: validated, enabledConfigs: (prev.enabledConfigs || []).map((item) => item.id === validated.id ? clone(validated) : item) }));
        setActiveValidation("通过");
        setActiveValidationMessage("当前配置已使用同一精确上下文完成核验。");
        notify("当前启用配置已通过精确上下文验证");
      }, WAIT * 2);
    };
    const validate = () => {
      const startedCandidate = configForScenario(state.candidateConfig, state.scenarioContext);
      const startedCandidateFingerprint = agentConfigInputFingerprint(startedCandidate);
      const startedContext = runtimeForScenario(state, startedCandidate);
      const epoch = beginAsync();
      const attempt = startedCandidate.validation.attempt + 1;
      const startedAt = now();
      setState((prev) => ({ ...prev, candidateConfig: { ...prev.candidateConfig, status: "验证中", validation: { ...prev.candidateConfig.validation, status: "验证中", attempt, startedAt, tests: [] } } }));
      window.setTimeout(() => setState((prev) => {
        if (!asyncIsCurrent(epoch)) return prev;
        const current = configForScenario(prev.candidateConfig, prev.scenarioContext);
        const currentRuntime = runtimeForScenario(prev, current);
        if (!startedContext?.ready || !currentRuntime?.ready || currentRuntime.runtimeContextFingerprint !== startedContext.runtimeContextFingerprint || agentConfigInputFingerprint(current) !== startedCandidateFingerprint) {
          const reason = startedContext?.reason || "验证期间正式上下文发生变化";
          return { ...prev, candidateConfig: { ...current, status: "验证失败", compatibility: "需重验", validation: { ...current.validation, status: "验证失败", overall: "失败", endedAt: now(), tests: [{ name: "运行上下文", status: "失败", reason }] } } };
        }
        const check = D.validateFixedQuestionSet(current, startedContext);
        const endedAt = now();
        if (!check.passed) return { ...prev, candidateConfig: { ...current, status: "验证失败", compatibility: "待验证", validation: { ...current.validation, status: "验证失败", overall: "失败", endedAt, tests: check.issues.map((reason, index) => ({ name: index === 0 ? "配置完整性" : "正式上下文兼容性", status: "失败", reason })) } } };
        const validationRun = {
          runId: `配置验证-${Date.now().toString(36).toUpperCase()}`,
          candidateId: current.id,
          candidateVersion: current.version,
          contentFingerprint: current.contentFingerprint,
          sceneId: startedContext.scenarioId,
          sceneVersion: startedContext.scenarioVersion,
          sceneVersionStatus: startedContext.scenarioReferenceStatus,
          versionId: startedContext.versionId,
          semanticVersion: startedContext.semanticVersion,
          dataVersion: startedContext.dataVersion,
          asOf: startedContext.asOf,
          t019EvidenceCode: startedContext.t019EvidenceCode,
          resourceContractFingerprint: startedContext.resourceContractFingerprint,
          runtimeContextFingerprint: startedContext.runtimeContextFingerprint,
          questionSetVersion: "融资问数固定问题集",
          startedAt,
          endedAt,
          overall: "通过",
          questionResults: check.questions,
          evidenceIds: check.questions.flatMap((item) => item.evidenceIds)
        };
        const tests = check.questions.map((item) => ({ name: item.question, status: item.status, reason: item.reason }));
        const c009Validation = {
          owner: "智能问数", status: "通过", checkedAt: endedAt,
          sceneId: startedContext.scenarioId, sceneVersion: startedContext.scenarioVersion,
          sceneVersionStatus: startedContext.scenarioReferenceStatus,
          versionId: startedContext.versionId, semanticVersion: startedContext.semanticVersion,
          dataVersion: startedContext.dataVersion, asOf: startedContext.asOf,
          t019EvidenceCode: startedContext.t019EvidenceCode,
          configFingerprint: current.contentFingerprint,
          resourceContractFingerprint: startedContext.resourceContractFingerprint,
          runtimeContextFingerprint: startedContext.runtimeContextFingerprint,
          validationRunId: validationRun.runId
        };
        return { ...prev, candidateConfig: { ...current, status: "待启用", compatibility: "兼容", c009Validation, validation: { ...current.validation, status: "通过", overall: "通过", endedAt, tests, validationRun } } };
      }), WAIT * 2);
    };
    const repair = () => setState((prev) => ({ ...prev, candidateConfig: { ...prev.candidateConfig, status: "待生成版本", compatibility: "待验证", observedSkills: [], observedTools: [], loadProof: null, lastRuntimeVerificationAt: null, validation: { ...prev.candidateConfig.validation, status: "未开始", repaired: true, tests: [], validationRun: null } } }));
    const generate = () => {
      const generationConfig = configForScenario(state.activeConfig, state.scenarioContext);
      const runtime = runtimeForScenario(state, generationConfig);
      if (!runtime.ready) { notify(`${runtime.status}：${runtime.reason}`, "danger"); return; }
      setState((prev) => {
        const revision = (prev.candidateConfig.candidateRevision || 0) + 1;
        const stamp = Date.now().toString(36).toUpperCase();
        return { ...prev, candidateConfig: { ...configForScenario(prev.candidateConfig, prev.scenarioContext), id: `IQ-AGENT-FINANCING-${stamp}`, name: `融资问数 Agent 配置 ${revision + 1}`, status: "候选", compatibility: "待验证", candidateRevision: revision, version: `融资问数配置 ${revision + 1}.0`, promptVersion: `企业融资问数约束 ${revision + 1}.0`, whitelistVersion: `融资语义白名单 ${revision + 1}.0`, sceneId: runtime.scenarioId, sceneVersion: runtime.scenarioVersion, sceneVersionStatus: runtime.scenarioReferenceStatus, bindingVersionId: runtime.versionId, semanticVersion: runtime.semanticVersion, bindingVersion: `${runtime.semanticVersion} · ${runtime.versionId}`, resourceContractFingerprint: runtime.resourceContractFingerprint, contentFingerprint: `配置指纹 ${stamp}`, c009Validation: null, validation: { status: "未开始", attempt: prev.candidateConfig.validation.attempt || 0, repaired: true, tests: [], validationRun: null } } };
      });
      notify("候选版本已生成，原验证结果已失效");
    };
    const canEnable = candidate.status === "待启用" && candidate.compatibility === "兼容" && candidate.validation?.overall === "通过" && candidate.validation?.validationRun?.contentFingerprint === candidate.contentFingerprint;
    const enable = () => {
      const current = configForScenario(state.candidateConfig, state.scenarioContext);
      const runtime = runtimeForScenario(state, current);
      const validationRun = current.validation?.validationRun;
      const exactPairUnchanged = Boolean(
        runtime?.ready && validationRun?.runtimeContextFingerprint === runtime.runtimeContextFingerprint &&
        validationRun?.sceneId === runtime.scenarioId && validationRun?.sceneVersion === runtime.scenarioVersion
      );
      if (!canEnable || !exactPairUnchanged) {
        setState((prev) => ({ ...prev, candidateConfig: { ...prev.candidateConfig, status: "验证失败", compatibility: exactPairUnchanged ? "需重验" : "版本不一致", validation: { ...prev.candidateConfig.validation, status: "验证失败", overall: "失败", tests: [{ name: "启用前精确上下文复核", status: "失败", reason: "验证后的权威上下文已变化，请重新生成或验证候选。" }] } } }));
        notify("候选未启用，现有配置继续服务", "danger");
        return;
      }
      setState((prev) => {
        const activated = { ...clone(configForScenario(prev.candidateConfig, prev.scenarioContext)), status: "已启用", compatibility: "兼容", enabledAt: now(), previousActiveVersion: prev.activeConfig.version, validationRef: prev.candidateConfig.validation.validationRun.runId };
        const enabledConfigs = [activated];
        return { ...prev, activeConfig: activated, enabledConfigs, serial: prev.serial + 1, candidateConfig: configForScenario(D.bindConfigSnapshot(D.CANDIDATE_CONFIG, runtime, false), prev.scenarioContext) };
      });
      setTab("active");
      notify("新配置已启用；上一配置已停止接收新问题");
    };
    const patchDeliveryState = (current, runId, patch) => ({
        ...current,
        activeRun: current.activeRun?.id === runId ? { ...current.activeRun, ...patch } : current.activeRun,
        attempts: (current.attempts || []).map((item) => item.id === runId ? { ...item, ...patch } : item)
    });
    const updateDeliveryState = (runId, patch) => {
      setConsumptionValidation((current) => patchDeliveryState(current, runId, patch));
      setState((prev) => ({ ...prev, candidateConsumptionValidation: patchDeliveryState(prev.candidateConsumptionValidation || { status: "未开始", attempts: [], activeRun: null }, runId, patch) }));
    };
    const cancelDelivery = (runId, reason = "提交已取消，可重新提交核对") => {
      deliveryInFlight.current.delete(runId);
      updateDeliveryState(runId, { deliveryStatus: "提交已取消", deliveryError: reason });
    };
    const markDeliveryUncertain = (runId, reason = "提交过程已离开当前页面，无法确认本体管理是否接收；请核对后重新提交") => {
      deliveryInFlight.current.delete(runId);
      updateDeliveryState(runId, { deliveryStatus: "状态待核对", deliveryError: reason });
    };
    const deliverCandidateValidation = (run) => {
      if (!run || run.status !== "通过" || !run.evidenceBundle || !run.questions?.length) {
        notify("只有整体通过且证据完整的候选验证可以提交核对", "danger");
        return;
      }
      const currentState = stateRef.current;
      const currentConfig = configForScenario(currentState.activeConfig, currentState.scenarioContext);
      const currentCandidate = candidateForScenario(currentState, currentConfig);
      const currentInputFingerprint = candidateValidationInputFingerprint(currentCandidate, currentConfig);
      if (!currentCandidate?.ready || currentInputFingerprint !== run.inputFingerprint || run.sceneId !== currentCandidate.scenarioId || run.sceneVersion !== currentCandidate.scenarioVersion) {
        notify("候选双版本、场景版本或 Agent 配置快照已变化，请重新运行完整题集", "danger");
        return;
      }
      if (!run.candidateKey || !run.deliveryIssuedAt || !run.deliveryExpiresAtEpoch) {
        notify("本次运行缺少固定候选身份或有效期，请重新运行完整题集", "danger");
        return;
      }
      if (Date.now() > run.deliveryExpiresAtEpoch) {
        updateDeliveryState(run.id, { deliveryStatus: "提交失败", deliveryError: "本次验证引用已过期，请创建新的验证运行" });
        notify("本次验证引用已过期，请创建新的验证运行", "danger");
        return;
      }
      if (deliveryInFlight.current.has(run.id) || run.deliveryStatus === "提交中") return;
      const epoch = beginAsync();
      deliveryInFlight.current.add(run.id);
      updateDeliveryState(run.id, { deliveryStatus: "提交中", deliveryError: null });
      const ontologyWindow = window.open(D.ONTOLOGY_ENTRY, "ontology-management-review");
      const finishFailure = (message) => {
        deliveryInFlight.current.delete(run.id);
        if (!asyncIsCurrent(epoch)) {
          markDeliveryUncertain(run.id, "提交期间页面状态已变化，无法确认本体管理是否接收；请核对后重新提交");
          return;
        }
        updateDeliveryState(run.id, { deliveryStatus: "提交失败", deliveryError: message });
        notify(`${message}；候选未进入正式问数`, "danger");
      };
      const exactCandidate = (context) => Boolean(
        context && context.candidateKey === run.candidateKey && context.semanticVersionId === run.versionId &&
        context.semanticVersion === run.semanticVersion && context.dataVersion === run.dataVersion && context.asOf === run.asOf &&
        context.scenarioId === run.sceneId && context.scenarioVersion === run.sceneVersion
      );
      const submitToOwner = (bridge, ownerContext) => {
        try {
          if (!asyncIsCurrent(epoch)) { cancelDelivery(run.id); return; }
          if (Date.now() > run.deliveryExpiresAtEpoch) throw new Error("本次验证引用已过期，请创建新的验证运行");
          const scopedOwnerContext = candidateForScenario(stateRef.current, run.configSnapshot, ownerContext);
          if (!exactCandidate(scopedOwnerContext)) throw new Error("本体管理当前候选与本次验证身份、双版本或场景版本不一致");
          const requiredItemIds = D.CANDIDATE_VALIDATION_QUESTIONS.map((item) => item.id);
          const questionSetEvidenceLocator = `智能问数/${run.id}/题集`;
          const requirement = {
            sourceModule: "智能问数", contractCode: "C008", decisionRef: "D064",
            candidateKey: run.candidateKey, semanticVersionId: run.versionId, semanticVersion: run.semanticVersion,
            dataVersion: run.dataVersion, asOf: run.asOf, questionSetVersion: run.questionSetVersion,
            questionSetEvidenceLocator, requiredItemIds, issuedAt: run.deliveryIssuedAt
          };
          if (!bridge.deliverValidationRequirement(requirement)) throw new Error("本体管理拒绝了题集要求；请核对候选是否已变化");
          const refreshed = candidateForScenario(stateRef.current, run.configSnapshot, bridge.candidateContext?.());
          if (!asyncIsCurrent(epoch)) { markDeliveryUncertain(run.id, "题集要求可能已被本体管理接收，但验证引用尚未确认；请核对后重新提交"); return; }
          if (Date.now() > run.deliveryExpiresAtEpoch) throw new Error("本次验证引用已过期，请创建新的验证运行");
          if (!exactCandidate(refreshed) || !refreshed.validationRequirementFingerprint) throw new Error("题集要求提交后候选身份发生变化或未形成固定指纹");
          const reference = {
            sourceModule: "智能问数", contractCode: "C008", decisionRef: "D064",
            candidateKey: run.candidateKey,
            semanticVersionId: run.versionId, semanticVersion: run.semanticVersion,
            dataVersion: run.dataVersion, asOf: run.asOf, questionSetVersion: run.questionSetVersion,
            questionSetEvidenceLocator, validationRequirementFingerprint: refreshed.validationRequirementFingerprint,
            status: "passed", completedAt: run.endedAt, expiresAtEpoch: run.deliveryExpiresAtEpoch,
            runId: run.id, retryOf: run.retryOf || null, evidenceLocator: `智能问数/${run.id}/${run.evidenceBundle}`,
            items: run.questions.map((item) => ({ id: item.id, status: item.status === "通过" ? "passed" : "failed", evidenceLocator: item.evidenceIds?.length ? `智能问数/${run.id}/${item.id}` : null }))
          };
          if (Date.now() > run.deliveryExpiresAtEpoch) throw new Error("本次验证引用已过期，请创建新的验证运行");
          if (!bridge.deliverValidationReference(reference)) throw new Error("本体管理拒绝了验证引用；请使用关联重试形成新运行");
          if (!asyncIsCurrent(epoch)) { markDeliveryUncertain(run.id, "本体管理可能已接收验证引用，但本页未取得最终确认；请核对后重新提交"); return; }
          if (Date.now() > run.deliveryExpiresAtEpoch) {
            markDeliveryUncertain(run.id, "验证引用在最终确认前已过期；请在本体管理核对是否接收，并创建新的验证运行");
            return;
          }
          deliveryInFlight.current.delete(run.id);
          updateDeliveryState(run.id, { deliveryStatus: "已提交核对", deliveryError: null, deliveredAt: now() });
          notify("验证引用已提交本体管理核对；正式组合尚未切换");
        } catch (error) {
          finishFailure(error.message);
        }
      };
      const waitForOwner = (attempt = 0) => {
        if (!asyncIsCurrent(epoch)) { cancelDelivery(run.id); return; }
        if (!ontologyWindow || ontologyWindow.closed) { finishFailure("未能打开本体管理接收页面"); return; }
        try {
          const bridge = ontologyWindow.ontologyReview;
          if (bridge && typeof bridge.candidateContext === "function" && typeof bridge.deliverValidationRequirement === "function" && typeof bridge.deliverValidationReference === "function") {
            submitToOwner(bridge, bridge.candidateContext());
            return;
          }
        } catch (_) {
          // The same-origin owner page may still be loading.
        }
        if (attempt >= 24) { finishFailure("本体管理接收入口尚未就绪"); return; }
        window.setTimeout(() => waitForOwner(attempt + 1), 120);
      };
      window.setTimeout(() => waitForOwner(), 80);
    };
    const deliveryNotice = (run) => {
      if (!run?.deliveryStatus) return null;
      if (run.deliveryStatus === "提交中") return <Notice tone="info" compact title="正在提交核对">正在固定候选身份、双版本和题集证据，并等待本体管理接收入口响应。</Notice>;
      if (run.deliveryStatus === "已提交核对") return <Notice tone="info" compact title="已提交核对">已在 {run.deliveredAt} 提交只读引用；等待本体管理核对，正式消费组合尚未因此改变。</Notice>;
      if (run.deliveryStatus === "状态待核对") return <Notice tone="warning" compact title="提交状态待核对">{run.deliveryError || "无法确认本体管理是否已经接收"}。重新提交前会再次核对候选身份、双版本和有效期。</Notice>;
      if (run.deliveryStatus === "提交已取消") return <Notice tone="warning" compact title="提交已取消">{run.deliveryError || "本次提交未继续"}。候选未因此进入正式问数。</Notice>;
      return <Notice tone="danger" compact title={run.deliveryStatus}>{run.deliveryError || "提交未完成"}；可在确认候选未变化后重试提交。</Notice>;
    };
    const runCandidateConsumptionValidation = () => {
      const validationConfig = configForScenario(state.activeConfig, state.scenarioContext);
      const fixedContext = candidateForScenario(state, validationConfig);
      if (!fixedContext.ready) {
        notify(`${fixedContext.status}：${fixedContext.reason}`, "danger");
        return;
      }
      const epoch = beginAsync();
      const questionSetVersion = "融资消费验证题集 · 第1版";
      const inputFingerprint = candidateValidationInputFingerprint(fixedContext, validationConfig);
      const previousRun = [consumptionValidation.activeRun, ...(consumptionValidation.attempts || [])].find((item) =>
        item?.inputFingerprint === inputFingerprint && item?.questionSetVersion === questionSetVersion
      ) || null;
      const attempt = (consumptionValidation.attempts?.length || 0) + 1;
      const startedAt = now();
      const running = {
        id: `CV-${Date.now().toString(36).toUpperCase()}`,
        attempt,
        retryOf: previousRun?.id || null,
        status: "处理中",
        overall: "处理中",
        questionSetVersion,
        versionId: fixedContext.versionId,
        semanticVersion: fixedContext.semanticVersion,
        dataVersion: fixedContext.dataVersion,
        asOf: fixedContext.asOf,
        updateId: fixedContext.updateId,
        eligibilityEvidence: clone(fixedContext.eligibilityEvidence),
        eligibilityEvidenceSummary: fixedContext.eligibilityEvidenceSummary,
        candidateKey: fixedContext.candidateKey,
        candidateInputFingerprint: fixedContext.inputFingerprint,
        inputFingerprint,
        sceneId: fixedContext.scenarioId,
        sceneVersion: fixedContext.scenarioVersion,
        sceneVersionStatus: fixedContext.scenarioReferenceStatus,
        configSnapshot: clone(validationConfig),
        configSnapshotFingerprint: agentConfigInputFingerprint(validationConfig),
        startedAt,
        endedAt: null,
        questions: []
      };
      setConsumptionValidation((current) => ({ ...current, status: "处理中", activeRun: running }));
      window.setTimeout(() => {
        if (!asyncIsCurrent(epoch)) return;
        const latestState = stateRef.current;
        const latestConfig = configForScenario(latestState.activeConfig, latestState.scenarioContext);
        const latest = candidateForScenario(latestState, latestConfig);
        const latestInputFingerprint = candidateValidationInputFingerprint(latest, latestConfig);
        const mixed = !latest.ready || latestInputFingerprint !== inputFingerprint;
        const forcedStates = fixedContext.phase === "verify_failed" && !previousRun
          ? { "CVQ-05": "超时", "CVQ-06": "未知" }
          : {};
        const check = mixed ? null : D.validateCandidateFixedQuestionSet(fixedContext, running.id, { forcedStates, configSnapshot: validationConfig });
        const questions = mixed
          ? D.CANDIDATE_VALIDATION_QUESTIONS.map((item) => ({
            ...clone(item), status: "版本不一致", completedAt: now(), objectScope: [], objectIdentities: [],
            resourceIds: clone(D.RESULT_TEMPLATES[item.templateId]?.resourceIds || []), fixedResultIdentity: null,
            evidenceIds: [], evidenceMapping: [], responsibility: "智能问数 · 候选固定题验证",
            reason: "验证期间候选上下文发生变化，已废弃本题结果"
          }))
          : check.questions;
        const failed = mixed || !check?.passed;
        const endedAt = now();
        const completed = {
          ...running,
          status: failed ? "未通过" : "通过",
          overall: failed ? (mixed ? "混版" : "未知") : "通过",
          endedAt,
          questions,
          reason: mixed ? "验证期间候选双版本、场景版本或 Agent 配置快照发生变化，本次结果已废弃" : failed ? check.issues[0] || "固定题未形成完整逐题证据" : "全部必测题均使用同一候选双版本、场景版本和 Agent 配置快照完成",
          evidenceBundle: failed ? null : `CV-EVIDENCE-${running.id}`,
          evidenceIds: failed ? [] : [...new Set(questions.flatMap((item) => item.evidenceIds || []))],
          deliveryIssuedAt: failed ? null : endedAt,
          deliveryExpiresAtEpoch: failed ? null : Date.now() + 30 * 60 * 1000,
          responsibility: "智能问数形成运行与证据；本体管理独立核对门禁并唯一提交正式绑定"
        };
        const finish = (current) => ({
          status: completed.status,
          activeRun: completed,
          attempts: [completed, ...(current.attempts || []).filter((item) => item.id !== completed.id)]
        });
        setConsumptionValidation(finish);
        setState((prev) => ({
          ...prev,
          candidateConsumptionValidation: finish(prev.candidateConsumptionValidation || { status: "未开始", attempts: [], activeRun: null })
        }));
        notify(failed ? "候选消费验证未通过；当前正式组合不变" : "候选消费验证整体通过；等待本体管理独立核对", failed ? "danger" : "success");
      }, WAIT * 2);
    };
    const enabledConfigs = state.enabledConfigs?.length ? state.enabledConfigs : [state.activeConfig];
    return <div className="page"><PageHeader eyebrow="运行约束" title="问数 Agent 配置" description="管理问数服务的提示词、能力与工具、语义绑定、白名单资源和配置版本。" />
      <div className="horizontal-scroll-frame agent-tabs-frame"><Tabs items={[{ id: "active", label: "已启用配置", count: enabledConfigs.length }, { id: "candidate", label: "配置候选", count: 1 }, { id: "consumption", label: "候选消费验证", count: candidateContext.ready ? 1 : 0 }, { id: "skills", label: "能力与工具", count: D.SKILLS.length + D.TOOLS.length }]} activeId={tab} onChange={setTab} /><span className="horizontal-scroll-cue" aria-hidden="true"><Icon name="move-horizontal" size={13} />左右滑动</span></div>
      {tab === "active" ? <div className="active-config"><div className="active-hero"><span><Icon name="badge-check" /></span><div><span className="eyebrow">当前已启用</span><h2>{state.activeConfig.name}</h2><p>{state.activeConfig.scene}</p></div><StatusBadge status={configState.status} /></div>{configState.status !== "兼容" ? <Notice tone={configState.tone === "danger" ? "danger" : "warning"} title={configState.status === "当前组合不可消费" ? "当前数据暂不可用于正式问数" : configState.status === "上游未形成" ? "等待已发布语义与正式绑定" : configState.status === "加载待核验" ? "能力与工具待运行核验" : "当前配置需要重新验证"} action={<Button size="sm" variant="primary" loading={activeValidation === "验证中"} onClick={validateActive}>{activeValidation === "失败" ? "重新验证" : "验证当前配置"}</Button>}>{configState.reason}。配置仍保持启用，但正式问数会在完整门禁通过前阻断。</Notice> : <Notice tone="success" compact title="当前配置可用于正式问数">当前正式语义、数据版本、Skill 和 Tool 均已核对。</Notice>}{activeValidationMessage ? <Notice tone={activeValidation === "通过" ? "success" : "danger"} compact title={activeValidation === "通过" ? "最近核验通过" : "最近核验未通过"}>{activeValidationMessage}</Notice> : null}{enabledConfigs.length > 1 ? <Notice tone="info" title="存在多个适用配置">提交问题后将按场景、资源白名单和当前版本匹配；多项均适用时由用户确认。</Notice> : null}<div className="config-grid"><section className="panel"><div className="panel-head"><div><h2>配置快照</h2><p>配置、提示词、白名单和语义绑定必须属于同一版本。</p></div></div><div className="panel-body"><FactGrid columns={2}><Fact label="配置版本" value={state.activeConfig.version} /><Fact label="提示词版本" value={state.activeConfig.promptVersion} /><Fact label="资源白名单版本" value={state.activeConfig.whitelistVersion} /><Fact label="语义绑定" value={state.activeConfig.bindingVersion} /><Fact label="维护方" value="智能问数" /><Fact label="当前核验" value={configState.status} /><Fact label="白名单资源" value={`${state.activeConfig.allowedResources.length} 项稳定资源身份`} /><Fact label="支持问题" value="单位与组合成本、集团板块、规则解释、机构归因" /><Fact label="可用后续操作" value={state.activeConfig.allowedActions.join("、")} /></FactGrid></div></section><section className="panel capability-panel"><div className="panel-head"><div><h2>能力与工具</h2><p>要求配置与实际运行证明分开核对。</p></div></div><div className="panel-body"><CapabilityGroups config={state.activeConfig} /></div></section></div><Notice tone="info" title="使用边界">其他模块或共用运行环境不能临时增加提示词、Skill、Tool、会话记忆或未确认的最新版本。Metric 和 Rule 始终由正式语义查询求值。</Notice></div> : null}
      {tab === "candidate" ? <div className="config-grid"><section className="panel"><div className="panel-head"><div><h2>{candidate.name}</h2><p>候选配置与已启用配置隔离。</p></div><StatusBadge status={candidate.status} /></div><div className="panel-body"><FactGrid columns={2}><Fact label="配置版本" value={candidate.version || "待生成"} /><Fact label="提示词版本" value={candidate.promptVersion || "待生成"} /><Fact label="资源白名单版本" value={candidate.whitelistVersion || "待生成"} /><Fact label="精确绑定" value={candidate.bindingVersionId || "待生成"} /></FactGrid><CapabilityGroups config={candidate} /><Notice tone="neutral" compact title="与候选数据验证分开">这里核对 Agent 配置能否使用当前正式组合，不代表候选数据业务验证通过，也不会触发权威组合切换。</Notice></div></section><section className="panel"><div className="panel-head"><div><h2>Agent 配置兼容性验证</h2><p>在当前正式组合内逐题核对固定问题、结果、资源范围和证据。</p></div></div><div className="panel-body">{candidate.status === "待生成版本" ? <><Notice tone="warning" title="修复完成，尚未形成候选版本">生成版本后才可验证；旧验证结果不会沿用。</Notice><Button variant="primary" icon="file-plus-2" onClick={generate}>生成候选版本</Button></> : candidate.validation.status === "未开始" ? <EmptyState compact title={candidate.version ? "候选尚未验证" : "候选配置不完整"} description={candidate.version ? "验证将固定当前正式组合，逐题核对结果身份和证据。" : "先运行检查取得失败原因，再修复候选内容。"} primaryAction={<Button variant="primary" onClick={validate}>运行验证</Button>} /> : candidate.validation.status === "验证中" ? <div className="recommendation-state"><span className="spinner large"></span><strong>正在验证配置</strong><p>固定当前正式语义和数据版本后逐题核对。</p></div> : candidate.validation.status === "验证失败" ? <><Notice tone="danger" title="验证失败">{candidate.validation.tests[0]?.reason}</Notice>{candidate.version ? <Button variant="primary" icon="refresh-cw" onClick={validate}>重新验证</Button> : <Button variant="primary" icon="wrench" onClick={repair}>修复配置要求</Button>}</> : <><Notice tone="success" title="验证通过，等待显式启用">六个固定问题、结果和证据均已通过；启用前将再次复核。</Notice><div className="validation-checks">{candidate.validation.tests.map((test) => <span key={test.name}><Icon name="check" size={13} />{test.name}</span>)}</div><Button variant="primary" icon="power" disabled={!canEnable} onClick={enable}>启用配置</Button></>}</div></section></div> : null}
      {tab === "consumption" ? <div className="candidate-validation-page"><section className="panel"><div className="panel-head"><div><h2>候选输入</h2><p>只读取已具备消费验证资格的候选双版本，不进入正式问数。</p></div><StatusBadge status={candidateContext.ready ? "具备条件" : candidateContext.status} /></div><div className="panel-body">{candidateContext.ready ? <><FactGrid columns={2}><Fact label="候选语义版本" value={candidateContext.semanticVersion} /><Fact label="精确版本身份" value={candidateContext.versionId} mono /><Fact label="候选数据版本" value={candidateContext.dataVersion} mono /><Fact label="数据截至" value={candidateContext.asOf} /><Fact label="资格状态" value={candidateContext.phaseLabel} /><Fact label="资格证据" value={candidateContext.eligibilityEvidenceSummary || "上游未提供定位"} mono /></FactGrid><Notice tone="info" title="固定后运行">开始后固定候选语义版本、候选数据版本和题集版本；发生换版、超时或未知时整体验证不通过。</Notice></> : <EmptyState icon="shield-alert" title={candidateContext.status} description={`${candidateContext.reason}。${candidateContext.recovery}`} primaryAction={<Button variant="primary" icon="arrow-up-right" onClick={() => window.open(D.ONTOLOGY_ENTRY, "_blank", "noopener,noreferrer")}>前往本体管理</Button>} />}</div></section><section className="panel"><div className="panel-head"><div><h2>固定题验证运行</h2><p>运行与证据归智能问数；整体通过也不表示权威组合已经采用。</p></div><Button variant="primary" icon="play" loading={consumptionValidation.status === "处理中"} disabled={!candidateContext.ready || consumptionValidation.status === "处理中"} onClick={runCandidateConsumptionValidation}>{consumptionValidation.activeRun ? "重新运行" : "开始验证"}</Button></div><div className="panel-body">{consumptionValidation.status === "处理中" ? <div className="recommendation-state"><span className="spinner large"></span><strong>正在验证候选双版本</strong><p>逐题固定结果身份、状态和证据；不会读取当前正式回答。</p></div> : consumptionValidation.activeRun ? <><Notice tone={consumptionValidation.activeRun.status === "通过" ? "success" : "danger"} title={`整体${consumptionValidation.activeRun.overall}`}>{consumptionValidation.activeRun.reason}。{consumptionValidation.activeRun.status === "通过" ? "本体管理仍需独立核对后决定是否采用。" : "当前正式组合继续服务；本次候选不得进入回答。"}</Notice>{deliveryNotice(consumptionValidation.activeRun)}<FactGrid columns={2}><Fact label="题集版本" value={consumptionValidation.activeRun.questionSetVersion} /><Fact label="运行状态" value={consumptionValidation.activeRun.status} /><Fact label="开始时间" value={consumptionValidation.activeRun.startedAt} /><Fact label="结束时间" value={consumptionValidation.activeRun.endedAt || "处理中"} /><Fact label="关联重试" value={consumptionValidation.activeRun.retryOf || "首次运行"} mono /><Fact label="证据包" value={consumptionValidation.activeRun.evidenceBundle || "未形成完整证据包"} /></FactGrid><div className="candidate-question-list">{consumptionValidation.activeRun.questions.map((item, index) => <article key={`${item.id}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{item.question}</strong><small>{item.reason}</small></div><StatusBadge status={item.status} /><Button size="sm" variant="ghost" onClick={() => setSelectedCandidateQuestion(item)}>查看详情</Button></article>)}</div>{consumptionValidation.activeRun.status === "通过" ? <div className="view-actions"><Button variant="primary" icon="send" loading={consumptionValidation.activeRun.deliveryStatus === "提交中"} onClick={() => deliverCandidateValidation(consumptionValidation.activeRun)}>{consumptionValidation.activeRun.deliveryStatus === "提交中" ? "正在提交" : consumptionValidation.activeRun.deliveryStatus ? "重新提交核对" : "提交本体管理核对"}</Button><small>只提交验证要求和只读结果引用，不采用候选或切换正式组合。</small></div> : null}</> : <EmptyState compact title="尚未运行候选消费验证" description="取得合格候选输入后，才能固定双版本并执行完整题集。" />}</div></section></div> : null}
      {tab === "skills" ? <div className="capability-directory"><section><div className="section-title"><div><h2>Skill</h2><p>帮助理解问题、消歧和规划，不承担正式计算。</p></div></div><div className="resource-grid">{D.SKILLS.map((skill) => <article className="resource-card" key={skill.id}><header><span><Icon name="sparkles" /></span><StatusBadge status="配置可要求" /></header><h3>{skill.name}</h3><code>{skill.id} · {skill.version}</code><p>{skill.boundary}</p><footer><span>{skill.source}</span><span>维护方：{skill.owner}</span></footer></article>)}</div></section><section><div className="section-title"><div><h2>受控 Tool</h2><p>执行正式查询、证据读取和标准行动请求。</p></div></div><div className="resource-grid">{D.TOOLS.map((tool) => <article className="resource-card" key={tool.id}><header><span><Icon name="wrench" /></span><StatusBadge status="白名单允许" /></header><h3>{tool.name}</h3><code>{tool.id} · {tool.version}</code><p>{tool.boundary}</p><footer><span>受控 Tool</span><span>维护方：{tool.owner}</span></footer></article>)}</div></section><section><div className="section-title"><div><h2>平台确定性能力</h2><p>由产品运行层确定性执行，不包装为 LLM Skill。</p></div></div><div className="resource-grid">{D.PLATFORM_CAPABILITIES.map((item) => <article className="resource-card" key={item.id}><header><span><Icon name="shield-check" /></span><StatusBadge status="平台执行" /></header><h3>{item.name}</h3><code>{item.id}</code><p>{item.boundary}</p><footer><span>平台确定性能力</span><span>维护方：{item.owner}</span></footer></article>)}</div></section></div> : null}
      {selectedCandidateQuestion ? <Drawer open title={selectedCandidateQuestion.question} description={`${selectedCandidateQuestion.id} · ${selectedCandidateQuestion.status}`} onClose={() => setSelectedCandidateQuestion(null)} footer={<Button onClick={() => setSelectedCandidateQuestion(null)}>关闭</Button>}><Notice tone={selectedCandidateQuestion.status === "通过" ? "success" : "warning"} title="验证结论">{selectedCandidateQuestion.reason}</Notice><section className="panel"><div className="panel-head"><div><h2>输入与预期</h2><p>该题只属于候选验证，不进入正式问数历史、CSV 或行动请求。</p></div></div><div className="panel-body"><FactGrid columns={2}><Fact label="候选语义版本" value={consumptionValidation.activeRun?.semanticVersion || "无法定位"} /><Fact label="候选数据版本" value={consumptionValidation.activeRun?.dataVersion || "无法定位"} mono /><Fact label="对象范围" value={selectedCandidateQuestion.objectScope?.join("、") || "未形成"} /><Fact label="对象稳定身份" value={selectedCandidateQuestion.objectIdentities?.join("、") || "未形成"} mono /><Fact label="预期验证点" value={selectedCandidateQuestion.expected} /><Fact label="完成时间" value={selectedCandidateQuestion.completedAt || "未完成"} /></FactGrid></div></section><section className="panel"><div className="panel-head"><div><h2>结果与证据</h2><p>逐项映射到固定结果身份和已发布稳定资源。</p></div></div><div className="panel-body"><FactGrid columns={2}><Fact label="固定结果身份" value={selectedCandidateQuestion.fixedResultIdentity?.fixedResultId || "未形成"} mono /><Fact label="稳定资源" value={`${selectedCandidateQuestion.resourceIds?.length || 0} 项`} /><Fact label="证据映射" value={`${selectedCandidateQuestion.evidenceMapping?.length || 0} 项`} /><Fact label="责任位置" value={selectedCandidateQuestion.responsibility} /></FactGrid>{selectedCandidateQuestion.evidenceMapping?.length ? <div className="candidate-evidence-map">{selectedCandidateQuestion.evidenceMapping.map((item, index) => <div key={`${item.resultItemId}-${item.evidenceId}-${index}`}><code>{item.resultItemId}</code><Icon name="arrow-right" size={12} /><code>{item.evidenceId}</code><span>{item.resourceId}</span></div>)}</div> : <Notice tone="warning" compact title="未形成逐项证据">修复候选输入后重新运行完整题集；不得用其他版本或同名资源补齐。</Notice>}</div></section><Notice tone="info" title="采用边界">本题成功不代表候选整体通过；整体通过也不表示正式绑定已切换。本体管理仍需独立核对并唯一提交。</Notice></Drawer> : null}
    </div>;
  }

  function EvidenceDrawer({ payload, onClose, notify }) {
    const run = payload?.run;
    if (!run) return null;
    const evidence = makeEvidence(run).map((item) => {
      const href = D.buildOntologyDeepLink(run.context, item.resourceId);
      return { ...item, openDisabled: !href, openReason: href ? "" : "原精确版本当前不可定位" };
    });
    const selected = evidence.find((item) => item.rowId === payload.rowId || item.resourceId === payload.resourceId || item.id === payload.rowId) || null;
    const [focus, setFocus] = React.useState(selected?.id || null);
    const [tab, setTab] = React.useState("conclusion");
    const openResource = (item) => {
      const href = D.buildOntologyDeepLink(run.context, item.resourceId);
      if (!href) return notify("该轮次未保留可验证的精确版本资源入口，不会改用当前版本中的同名资源", "danger");
      window.open(href, "_blank", "noopener,noreferrer");
    };
    const selectedEvidence = evidence.find((item) => item.id === focus);
    return <Drawer open size="lg" title="回答证据" description={`${run.id} · ${run.result?.title || run.question}`} onClose={onClose} footer={<Button onClick={onClose}>关闭</Button>}>
      <div className="horizontal-scroll-frame evidence-tabs-frame"><Tabs className="evidence-tabs" items={[{ id: "conclusion", label: "结论证据", count: evidence.length }, { id: "scope", label: "对象范围" }, { id: "context", label: "上下文与版本" }, { id: "quality", label: "质量与新鲜度" }]} activeId={tab} onChange={setTab} /><span className="horizontal-scroll-cue" aria-hidden="true"><Icon name="move-horizontal" size={13} />左右滑动</span></div>
      {tab === "conclusion" ? <><EvidenceList items={evidence} selectedId={focus} onSelect={(id) => setFocus(id)} onOpen={(id, item) => openResource(item)} />{selectedEvidence ? <section className="resource-detail"><header><div><h2>{selectedEvidence.title}</h2><p>{selectedEvidence.id}</p></div><Button size="sm" variant="ghost" iconAfter="arrow-up-right" disabled={!D.buildOntologyDeepLink(run.context, selectedEvidence.resourceId)} title={!D.buildOntologyDeepLink(run.context, selectedEvidence.resourceId) ? "原精确版本当前不可定位" : "查看精确已发布资源"} onClick={() => openResource(selectedEvidence)}>查看详情</Button></header><FactGrid columns={2}><Fact label="稳定资源身份" value={selectedEvidence.resourceId} mono /><Fact label="精确值" value={selectedEvidence.summary} /><Fact label="已发布语义版本" value={run.context.semanticVersion} /><Fact label="数据版本" value={run.context.dataVersion} /><Fact label="数据截至" value={run.context.asOf} /><Fact label="质量" value={run.context.quality} /></FactGrid>{selectedEvidence.warning ? <Notice tone="warning" compact title="口径提示">{selectedEvidence.warning}</Notice> : null}</section> : <EmptyState compact title="选择一项结论证据" description="查看精确值、稳定资源身份和版本定位。" />}</> : null}
      {tab === "scope" ? <section className="panel"><div className="panel-head"><div><h2>本轮固定对象范围</h2><p>图形临时选中项和展示 Top N 不改变以下范围。</p></div><StatusBadge status="完整" /></div><div className="panel-body"><FactGrid columns={2}><Fact label="对象集合" value={run.result?.scope?.join("、") || "未形成"} /><Fact label="对象数量" value={`${run.result?.scope?.length || 0} 项`} /><Fact label="原问题" value={run.originalQuestion || run.question} /><Fact label="最终问题理解" value={run.clarificationRecord?.finalUnderstanding || run.finalQuestion || run.question} /><Fact label="澄清结果" value={run.clarificationRecord ? `${run.clarificationRecord.ambiguousText} → ${run.clarificationRecord.confirmedObject}` : "本轮无需澄清"} /><Fact label="去重后对象" value={run.clarificationRecord?.deduplicatedObjects?.join("、") || run.result?.scope?.join("、") || "未形成"} /><Fact label="继承范围" value={run.inheritance?.inherited?.join("、") || "本轮未继承历史范围"} /><Fact label="覆盖与清除" value={run.inheritance ? `${run.inheritance.overridden?.join("、") || "无覆盖"}；已清除 ${run.inheritance.cleared?.join("、") || "无"}` : "本轮无历史继承"} /></FactGrid></div></section> : null}
      {tab === "context" ? <section className="panel"><div className="panel-head"><div><h2>同一消费上下文</h2><p>这些字段在本轮运行开始时固定，不能静默换版。</p></div><StatusBadge status={run.context?.evidenceComplete ? "完整" : "阻断"} /></div><div className="panel-body"><FactGrid columns={2}><Fact label="精确版本身份" value={run.context?.versionId || "无法定位"} mono /><Fact label="已发布语义版本" value={run.context?.semanticVersion || "无法定位"} /><Fact label="可消费数据版本" value={run.context?.dataVersion || "无法定位"} /><Fact label="数据截至时间" value={run.context?.asOf || "无法定位"} /><Fact label="权威绑定" value={run.context?.t019Ref || "无法定位"} /><Fact label="绑定证据" value={run.context?.t019EvidenceCode || "无法定位"} mono /><Fact label="生成时间" value={run.completedAt || "未形成"} /></FactGrid></div></section> : null}
      {tab === "quality" ? <section className="panel"><div className="panel-head"><div><h2>质量与新鲜度</h2><p>只读引用与本轮数据版本匹配的数据工程可信上下文。</p></div><StatusBadge status={run.context?.allowConsumption === false ? "不可消费" : run.context?.quality} /></div><div className="panel-body"><FactGrid columns={2}><Fact label="质量状态" value={run.context?.quality || "无法判断"} /><Fact label="质量证据" value={run.context?.qualityEvidenceId || "上游未提供"} mono /><Fact label="新鲜度" value={run.context?.freshness || "无法判断"} /><Fact label="新鲜度判定依据" value={run.context?.freshnessBasis || "上游未提供"} /><Fact label="新鲜度证据" value={run.context?.freshnessEvidenceId || "上游未提供"} mono /><Fact label="最近成功刷新" value={run.context?.lastSuccessfulAt || "未提供"} /><Fact label="数据证据定位" value={run.context?.evidenceIds?.length ? `${run.context.evidenceIds.length} 项，只读保留` : "历史快照未保留可重新定位证据"} /><Fact label="证据类别" value={run.context?.evidenceCategories ? Object.entries(run.context.evidenceCategories).map(([key, okay]) => `${({ version: "版本", source: "来源", quality: "质量", members: "成员", relationships: "关系", refresh: "刷新" }[key] || key)}${okay ? "完整" : "缺失"}`).join("、") : "上游未提供"} /><Fact label="候选状态" value={run.context?.candidate?.status || "没有可证明的候选状态"} /><Fact label="数据侧上一合格参考" value={run.context?.previous?.dataVersion || "暂无可证明引用"} /><Fact label="是否允许消费" value={run.context?.allowConsumption === false ? "否" : "是"} /></FactGrid>{run.context?.dataReason ? <Notice tone="warning" title="数据提示">{run.context.dataReason}</Notice> : null}</div></section> : null}
    </Drawer>;
  }

  function ContextDrawer({ run, onClose }) {
    if (!run) return null;
    const historicalResult = Boolean(run.past && run.status === "成功" && run.result);
    const resultReady = Boolean(run.status === "成功" && run.result && (run.context?.evidenceComplete || historicalResult));
    const groups = [
      ["配置上下文", Boolean(run.configSnapshot?.version && run.configSnapshot?.promptVersion && run.configSnapshot?.whitelistVersion && (run.past || D.runtimeCapabilityProof(run.configSnapshot).passed)), `场景 ${run.configSnapshot?.scene || "未固定"}；Agent ${run.configSnapshot?.name || "未固定"}；Skill ${run.configSnapshot?.skills?.length || 0} 项、Tool ${run.configSnapshot?.tools?.length || 0} 项；${run.past ? "历史加载证明已固定" : run.configSnapshot?.loadProof || "实际加载状态待核验"}`],
      ["语义上下文", Boolean(run.context?.versionId && run.context?.semanticVersion), `${run.context?.semanticVersion || "未固定"}；实际使用 ${(run.result?.resourceIds || []).length} 项稳定资源`],
      ["查询上下文", Boolean(run.question && (run.result?.scope?.length || run.queryContext?.unitCodes?.length)), `${run.originalQuestion || run.question} → ${run.finalQuestion || run.question}；对象 ${run.result?.scope?.join("、") || run.queryContext?.unitCodes?.map((code) => `单位${code}`).join("、") || "待确认"}`],
      ["数据可信度上下文", historicalResult ? Boolean(run.context?.t019Ref && run.context?.dataVersion && run.context?.asOf && run.context?.quality && run.context?.freshness) : Boolean(run.context?.t019Ref && run.context?.dataVersion && run.context?.asOf && run.context?.quality && run.context?.freshnessStatus && !/未知|无法判断/.test(run.context.freshnessStatus)), `${run.context?.t019Ref || "未固定"}；${run.context?.dataVersion || "未固定"}；截至 ${run.context?.asOf || "未固定"}${historicalResult ? "；历史只读" : ""}`],
      ["结果与证据上下文", resultReady, `${run.result?.rows?.length || 0} 项结构化结果；${makeEvidence(run).length} 项证据`],
      ["会话继承上下文", true, run.inheritance ? `来源 ${run.inheritance.sourceRunId || "澄清"}；继承 ${run.inheritance.inherited?.join("、") || run.inheritance.clarification}；覆盖 ${run.inheritance.overridden?.join("、") || "无"}；清除 ${run.inheritance.cleared?.join("、") || "无"}` : "本轮未继承历史范围"],
      ["Action 上下文", resultReady, run.result?.scope?.length === 1 ? `单一目标 ${run.result.scope[0]}；图形选中不写入目标` : resultReady ? "组合结果不自动选择行动目标" : "结果未形成，行动上下文不可用"]
    ];
    const complete = groups.every(([, okay]) => okay);
    return <Drawer open title="本轮上下文摘要" description="业务可读的固定上下文证明；不显示提示词全文、模型思维过程或内部查询语言。" onClose={onClose} footer={<Button onClick={onClose}>关闭</Button>}><ol className="context-checks">{groups.map(([title, okay, detail]) => <li className={okay ? "done" : "blocked"} key={title}><span><Icon name={okay ? "check" : "x"} size={12} /></span><div><strong>{title}</strong><small>{detail}</small></div><StatusBadge status={okay ? historicalResult ? "历史固定" : "完整" : "阻断"} /></li>)}</ol>{historicalResult ? <Notice tone="info" title="历史上下文只读">以上证明属于原运行，不恢复当前消费资格；当前精确版本不可定位时不会指向当前版本或同名资源。</Notice> : !complete ? <Notice tone="danger" title="上下文不完整">缺失项未补齐前不会让模型继续组织正式回答。</Notice> : null}<Notice tone="neutral" title="优先级">任务边界 → 已启用配置 → 已发布语义定义 → 权威绑定与固定结果 → 本轮范围 → 显式继承 → 展示状态。</Notice></Drawer>;
  }

  function ActionModal({ payload, setPayload, state, setState, notify }) {
    const run = payload?.run; if (!run) return null;
    const requestTokenRef = React.useRef(0);
    const payloadRef = React.useRef(payload);
    React.useEffect(() => {
      payloadRef.current = payload;
    }, [payload]);
    React.useEffect(() => () => {
      requestTokenRef.current += 1;
    }, []);
    const gate = isActionEligible(run, state.scenarioContext);
    const target = gate.target;
    const eligible = gate.eligible;
    const readOnlyRequest = payload.request || null;
    const submit = () => {
      const currentGate = isActionEligible(run, state.scenarioContext);
      if (!currentGate.eligible) { setPayload({ ...payload, stage: "failed", failedOnce: true, error: currentGate.reasons.join("；") }); return; }
      const epoch = beginAsync();
      const requestToken = requestTokenRef.current + 1;
      requestTokenRef.current = requestToken;
      setPayload({ ...payload, stage: "submitting" });
      window.setTimeout(() => {
        if (!asyncIsCurrent(epoch) || requestTokenRef.current !== requestToken) return;
        if (!payload.failedOnce) { setPayload((current) => current?.type === "action" && current.run?.id === run.id && current.stage === "submitting" ? { ...current, stage: "failed", failedOnce: true, error: "提交前连接失败，请检查后重试；请求尚未发送" } : current); return; }
        const finalGate = isActionEligible(run, state.scenarioContext);
        if (!finalGate.eligible) { setPayload((current) => current?.type === "action" && current.run?.id === run.id && current.stage === "submitting" ? { ...current, stage: "failed", failedOnce: true, error: finalGate.reasons.join("；") } : current); return; }
        const activePayload = payloadRef.current;
        if (activePayload?.type !== "action" || activePayload.run?.id !== run.id || activePayload.stage !== "submitting") return;
        setState((prev) => {
          if (requestTokenRef.current !== requestToken) return prev;
          const request = { id: D.nextStableId("AR"), target, targetStableId: finalGate.actionContext.singleTargetStableId, createdAt: now(), status: "待接收", runId: run.id, actionType: finalGate.actionResource.id, context: clone(run.context), runtimeContextFingerprint: run.context.runtimeContextFingerprint, actionContext: clone(finalGate.actionContext), evidenceIds: makeEvidence(run).map((item) => item.id).filter(Boolean) };
          setPayload((current) => current?.type === "action" && current.run?.id === run.id && current.stage === "submitting" ? { ...current, stage: "success", request } : current);
          return { ...prev, serial: prev.serial + 1, actionRequests: [request, ...prev.actionRequests] };
        });
      }, WAIT * 2);
    };
    const close = () => { requestTokenRef.current += 1; setPayload(null); };
    return <Modal open title={payload.stage === "details" ? "行动请求详情" : "发起融资优化行动请求"} description={payload.stage === "details" ? "只读查看本次提交结果；后续处理由决策中心负责。" : "提交只创建行动请求；后续人工确认和待办由决策中心继续处理。"} onClose={close} footer={payload.stage === "confirm" ? <><Button onClick={close}>取消</Button><Button variant="primary" disabled={!eligible} onClick={submit}>确认提交</Button></> : payload.stage === "failed" ? <><Button onClick={close}>关闭</Button><Button variant="primary" onClick={submit}>重试提交</Button></> : payload.stage === "success" || payload.stage === "details" ? <Button variant="primary" onClick={close}>关闭</Button> : null}>
      {payload.stage === "confirm" ? <><FactGrid columns={2}><Fact label="目标主体" value={target || "需要单一融资主体"} /><Fact label="行动类型" value={gate.actionResource?.name || "当前版本无法定位"} /><Fact label="来源运行" value={run.id} /><Fact label="语义版本" value={run.context.semanticVersion} /><Fact label="数据版本" value={run.context.dataVersion} /><Fact label="证据" value={`${makeEvidence(run).length} 项`} /></FactGrid>{eligible ? <Notice tone="warning" title="提交前确认">目标只来自本轮已确认对象范围；图形临时选中项不会成为行动目标。</Notice> : <Notice tone="danger" title="无法提交">{gate.reasons.join("；")}。请修复后基于完整上下文重新运行。</Notice>}</> : null}
      {payload.stage === "submitting" ? <div className="recommendation-state"><span className="spinner large"></span><strong>正在提交请求</strong><p>保持目标、双版本和证据不变。</p></div> : null}
      {payload.stage === "failed" ? <Notice tone="danger" title="提交失败">{payload.error}。未形成已接收记录，原回答与证据仍可用。</Notice> : null}
      {payload.stage === "success" ? <div className="recommendation-state"><Icon name="circle-check-big" /><strong>请求已提交，等待接收</strong><p>只有取得决策中心回执后才会标记已接收；这不表示已完成人工确认或创建待办。</p><code>{payload.request.id}</code></div> : null}
      {payload.stage === "details" && readOnlyRequest ? <><FactGrid columns={2}><Fact label="请求标识" value={readOnlyRequest.id} mono /><Fact label="提交状态" value={readOnlyRequest.status} /><Fact label="目标主体" value={readOnlyRequest.target} /><Fact label="目标稳定身份" value={readOnlyRequest.targetStableId} mono /><Fact label="来源运行" value={readOnlyRequest.runId} mono /><Fact label="行动类型" value={readOnlyRequest.actionType} mono /><Fact label="语义版本" value={readOnlyRequest.context?.semanticVersion || "无法定位"} /><Fact label="数据版本" value={readOnlyRequest.context?.dataVersion || "无法定位"} mono /><Fact label="数据截至" value={readOnlyRequest.context?.asOf || "无法定位"} /><Fact label="证据" value={`${readOnlyRequest.evidenceIds?.length || 0} 项`} /></FactGrid><Notice tone="info" title="边界说明">当前仅保留本次提交返回的状态；没有决策中心回执时不会显示已接收，也不在智能问数中推演人工确认、提醒或待办状态。</Notice></> : null}
    </Modal>;
  }

  function App() {
    const [state, setState] = React.useState(() => D.loadState(VARIANT.storageKey));
    const [route, setRoute] = React.useState(routeState);
    const [toasts, setToasts] = React.useState([]);
    const [evidence, setEvidence] = React.useState(null);
    const [contextRun, setContextRun] = React.useState(null);
    const [modal, setModal] = React.useState(null);
    const [resetOpen, setResetOpen] = React.useState(false);
    const [dataOpen, setDataOpen] = React.useState(false);
    const [upstreamRevision, setUpstreamRevision] = React.useState(0);
    const scrollPositions = React.useRef({});
    const previousPage = React.useRef(route.page);
    React.useEffect(() => D.saveState(VARIANT.storageKey, state), [state]);
    React.useEffect(() => { if (!location.hash) go("ask"); const handler = () => setRoute(routeState()); addEventListener("hashchange", handler); return () => removeEventListener("hashchange", handler); }, []);
    React.useEffect(() => {
      const refresh = () => setUpstreamRevision((value) => value + 1);
      const visible = () => { if (document.visibilityState === "visible") refresh(); };
      const storage = (event) => {
        if (!event.key || [D.ONTOLOGY_STORAGE_KEY, D.C017_PROJECTION_STORAGE_KEY].includes(event.key)) refresh();
      };
      addEventListener("focus", refresh);
      addEventListener("pageshow", refresh);
      addEventListener("storage", storage);
      document.addEventListener("visibilitychange", visible);
      return () => {
        removeEventListener("focus", refresh);
        removeEventListener("pageshow", refresh);
        removeEventListener("storage", storage);
        document.removeEventListener("visibilitychange", visible);
      };
    }, []);
    React.useEffect(() => {
      setEvidence(null);
      setContextRun(null);
      setModal(null);
      setResetOpen(false);
      setDataOpen(false);
    }, [route.page, route.id, route.params.toString()]);
    React.useEffect(() => {
      const main = document.querySelector(".main");
      const prior = previousPage.current;
      if (main && prior !== route.page) scrollPositions.current[prior] = main.scrollTop;
      window.setTimeout(() => {
        const nextMain = document.querySelector(".main");
        if (!nextMain) return;
        nextMain.scrollTop = scrollPositions.current[route.page] || 0;
        if (prior !== route.page) nextMain.focus({ preventScroll: true });
      }, 0);
      previousPage.current = route.page;
    }, [route.page, route.id]);
    const notify = (message, tone = "success") => { const id = `toast-${Date.now()}`; setToasts((items) => [...items, { id, title: message, tone }]); window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 3200); };
    const navigate = (page, id) => go(page, id);
    const confirmReset = () => { invalidateAsync(); setState(D.resetState(VARIANT.storageKey)); setEvidence(null); setContextRun(null); setModal(null); setResetOpen(false); go("ask"); notify("已恢复工作区初始状态"); };
    const pin = (run, explicitView = null) => {
      const view = explicitView || state.savedViews.find((item) => item.lastRunId === run?.id);
      if (!view && run) { setModal({ type: "save", run, thenPin: true }); return; }
      const gate = pinEligibility(run, view, state.scenarioContext);
      if (!gate.allowed) { notify(gate.reason, "danger"); setModal((current) => current ? { ...current, stage: "blocked", error: gate.reason } : current); return; }
      let submission = { accepted: false, reason: "当前状态已变化，请重新核对后提交" };
      setState((prev) => {
        const currentView = prev.savedViews.find((item) => item.id === view.id) || view;
        const currentRun = getRun(prev, run.id) || run;
        const finalGate = pinEligibility(currentRun, currentView, prev.scenarioContext);
        if (!finalGate.allowed) { submission = { accepted: false, reason: finalGate.reason }; return prev; }
        submission = { accepted: true, reason: "" };
        const pinRecord = createPinRecord(prev, currentView, currentRun);
        return { ...prev, pins: [pinRecord, ...prev.pins], serial: prev.serial + 1 };
      });
      window.setTimeout(() => {
        if (submission.accepted) { setModal(null); notify("视图引用已提交，等待报告中心接收"); }
        else notify(submission.reason, "danger");
      }, 0);
    };
    const saveAndMaybePin = (run, name, thenPin) => {
      let outcome = { pinned: false, reason: "" };
      setState((prev) => {
        const currentRun = getRun(prev, run.id) || run;
        const created = viewFromRun(currentRun, D.nextStableId("VIEW"), name);
        const next = { ...prev, serial: prev.serial + 1, savedViews: [created, ...prev.savedViews] };
        const finalGate = thenPin ? pinEligibility(currentRun, created, prev.scenarioContext) : { allowed: false, reason: "" };
        outcome = { pinned: Boolean(thenPin && finalGate.allowed), reason: finalGate.reason || "" };
        if (outcome.pinned) {
          const pinRecord = createPinRecord(prev, created, currentRun, 2);
          return { ...next, serial: prev.serial + 2, pins: [pinRecord, ...prev.pins] };
        }
        return next;
      });
      window.setTimeout(() => {
        setModal(null);
        if (!thenPin) notify("问数视图已保存");
        else if (outcome.pinned) notify("视图已保存，引用已提交并等待报告中心接收");
        else notify(`视图已保存，但未提交：${outcome.reason || "当前状态未通过提交前复核"}`, "warning");
      }, 0);
    };
    const deleteView = (view) => { setState((prev) => ({ ...prev, savedViews: prev.savedViews.filter((item) => item.id !== view.id) })); setModal(null); notify("问数视图已删除", "warning"); };
    const modalPinView = modal?.type === "pin" ? (modal.view || state.savedViews.find((item) => item.lastRunId === modal.run?.id)) : null;
    const modalPinGate = modal?.type === "pin" ? pinEligibility(modal.run, modalPinView, state.scenarioContext) : null;
    let page = null;
    if (route.page === "ask") page = <AskPage state={state} setState={setState} notify={notify} openEvidence={(run, rowId, resourceId) => setEvidence({ run, rowId, resourceId })} openContext={setContextRun} setModal={setModal} />;
    if (route.page === "semantics") page = <SemanticPage state={state} notify={notify} />;
    if (route.page === "history") page = <HistoryPage state={state} setState={setState} navigate={navigate} />;
    if (route.page === "views") page = <ViewsPage state={state} setState={setState} navigate={navigate} notify={notify} setModal={setModal} />;
    if (route.page === "agent") page = <AgentPage state={state} setState={setState} notify={notify} />;
    return <><Shell state={state} route={route} navigate={navigate} onReset={() => setResetOpen(true)} onDataScenario={() => setDataOpen(true)}>{page}</Shell>
      {evidence ? <EvidenceDrawer payload={evidence} onClose={() => setEvidence(null)} notify={notify} /> : null}
      {contextRun ? <ContextDrawer run={contextRun} onClose={() => setContextRun(null)} /> : null}
      {modal?.type === "action" ? <ActionModal payload={modal} setPayload={setModal} state={state} setState={setState} notify={notify} /> : null}
      {modal?.type === "save" ? <SaveViewModal payload={modal} onClose={() => setModal(null)} onSave={(name) => saveAndMaybePin(modal.run, name, modal.thenPin)} /> : null}
      {modal?.type === "pin" ? <Modal open title="固定到仪表盘" description="智能问数只交付视图引用、展示建议、当前结果和可信度。" onClose={() => setModal(null)} footer={<><Button onClick={() => setModal(null)}>取消</Button><Button variant="primary" disabled={Boolean(modalPinView) && !modalPinGate?.allowed} title={!modalPinView ? "先保存问数视图，再提交引用" : !modalPinGate?.allowed ? modalPinGate?.reason : "提交视图引用"} onClick={() => pin(modal.run, modalPinView)}>{modalPinView ? "提交引用" : "保存并提交"}</Button></>}><FactGrid columns={2}><Fact label="问数视图" value={modalPinView?.name || "尚未保存"} /><Fact label="来源运行" value={modal.run?.id || "没有当前运行"} /><Fact label="语义版本" value={modal.run?.context?.semanticVersion || "无法定位"} /><Fact label="数据版本" value={modal.run?.context?.dataVersion || "无法定位"} /><Fact label="数据截至" value={modal.run?.context?.asOf || "无法定位"} /><Fact label="证据" value={modal.run?.result ? `${makeEvidence(modal.run).length} 项` : "未形成"} /></FactGrid>{!modalPinView ? <Notice tone="info" title="先形成可复用问数视图">保存后仍会再次核对当前结果、双版本、质量和证据，再向报告中心提交引用。</Notice> : modalPinGate?.allowed ? <Notice tone="info" title="提交不等于接收或发布">取得报告中心回执后才显示已接收；卡片、布局、编排和发布生命周期仍由报告中心拥有。</Notice> : <Notice tone="warning" title="当前不能提交">{modalPinGate?.reason}。查询定义和历史结果不会被改写。</Notice>}</Modal> : null}
      {modal?.type === "delete-view" ? <Modal open title="删除问数视图" description={`将删除“${modal.view.name}”；既有历史结果和报告中心已接收引用不被改写。`} onClose={() => setModal(null)} footer={<><Button onClick={() => setModal(null)}>取消</Button><Button variant="danger" onClick={() => deleteView(modal.view)}>确认删除</Button></>}><Notice tone="warning">此操作只删除智能问数中的用户自建视图。</Notice></Modal> : null}
      {resetOpen ? <Modal open title="重置状态" description="恢复当前工作区初始状态，可重新走完整业务流程。" onClose={() => setResetOpen(false)} footer={<><Button onClick={() => setResetOpen(false)}>取消</Button><Button variant="danger" icon="rotate-ccw" onClick={confirmReset}>确认重置</Button></>}><Notice tone="warning" title="将清除本模块运行内容">清除当前运行、历史会话、问数视图、固定引用和待接收请求；保留启用配置，并重新核对上游正式上下文。不修改本体管理、数据工程或其他模块状态。</Notice></Modal> : null}
      {dataOpen ? <DataContextModal onClose={() => setDataOpen(false)} notify={notify} upstreamRevision={upstreamRevision} /> : null}
      <ToastRegion toasts={toasts} onDismiss={(id) => setToasts((items) => items.filter((item) => item.id !== id))} />
    </>;
  }

  function SaveViewModal({ payload, onClose, onSave }) {
    const [name, setName] = React.useState(payload.run.result?.title || "新问数视图");
    return <Modal open title={payload.thenPin ? "保存并提交到仪表盘" : "保存为问数视图"} description={payload.thenPin ? "先保存查询定义和展示偏好，再提交视图引用。" : "查询定义与展示偏好将分开保存。"} onClose={onClose} footer={<><Button onClick={onClose}>取消</Button><Button variant="primary" disabled={!name.trim()} onClick={() => onSave(name.trim())}>{payload.thenPin ? "保存并提交" : "保存视图"}</Button></>}><label className="form-field"><span>视图名称</span><input value={name} onChange={(event) => setName(event.target.value)} /></label><FactGrid columns={2}><Fact label="查询定义" value="对象、资源、筛选、分组、业务排序和时间策略" /><Fact label="展示偏好" value={`${displayModeLabel(payload.run.display.mode)} · ${chartLabel(payload.run.display.chart)}`} /></FactGrid><Notice tone="neutral">展示偏好不会修改查询口径或当前结果。</Notice></Modal>;
  }

  function DataContextModal({ onClose, notify, upstreamRevision }) {
    const [context, setContext] = React.useState(() => D.readOntologyContext());
    React.useEffect(() => setContext(D.readOntologyContext()), [upstreamRevision]);
    const dataIssue = context.recoveryOwner === "data";
    const ownerEntry = dataIssue ? D.DATA_ENGINEERING_ENTRY : D.ONTOLOGY_ENTRY;
    const ownerLabel = dataIssue ? "前往数据工程" : "前往本体管理";
    const check = () => { const next = D.readOntologyContext(); setContext(next); notify(next.ready ? "已重新读取同一权威上下文" : `${next.status}：${next.reason}`, next.ready ? "success" : "warning"); };
    return <Modal open size="lg" title="数据与语义状态" description="只读核对本体管理的权威消费组合和数据可信度；本模块不维护消费指针。" onClose={onClose} footer={<><Button onClick={onClose}>关闭</Button><Button variant="primary" icon="refresh-cw" onClick={check}>重新读取</Button></>}>
      {context.ready ? <><ContextBar semanticVersion={context.semanticVersion} dataVersion={context.dataVersion} dataAsOf={context.asOf} quality={context.quality || "无法判断"} freshness={context.freshness || "无法判断"} warnings={[...(context.dataTrust?.qualityWarnings || []), ...(context.refresh?.failureReason ? [context.refresh.failureReason] : [])]} /><div className="data-lanes"><article className="current"><header><strong>当前权威组合</strong><StatusBadge status={context.allowConsumption ? "可消费" : "不可消费"} /></header><h3>{context.semanticVersion}</h3><code>{context.versionId}</code><p>{context.dataVersion} · 截至 {context.asOf}</p><small>最近成功刷新：{context.lastSuccessfulAt || "上游未提供"}</small></article><Icon name="arrow-right" /><article className="candidate"><header><strong>候选刷新</strong><StatusBadge status={context.candidate?.status || "未开始"} /></header><h3>{context.candidate?.dataVersion || "没有待处理候选"}</h3><p>{context.refresh?.failureReason || "候选刷新中或失败时不会进入正式回答。"}</p><small>数据侧上一合格版本：{context.previous?.dataVersion || "暂无可证明引用"}</small></article></div></> : <EmptyState icon="database-zap" title={context.status} description={`${context.reason}。${context.recovery}`} primaryAction={<Button variant="primary" onClick={() => window.open(ownerEntry, "_blank", "noopener,noreferrer")}>{ownerLabel}</Button>} />}
      <Notice tone="info">T007 发布、C028 请求、C029 结果与 T018 资格、T019 权威采用是不同事实。候选 T007、C028 处理中、C029 失败或未知，以及未被 T019 采用的版本均不会进入正式回答。</Notice>
    </Modal>;
  }

  ReactDOM.createRoot(document.getElementById("root")).render(<App />);
})();
