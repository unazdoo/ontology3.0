(function mountBusinessObjectExplorer(global) {
  "use strict";

  const MODULE_ID = "m07";
  const MODULE_ROUTE = "#module/m07";
  const HANDOFF_CHANNEL = "ofw.m07.prototype.handoff.v1";
  const STORAGE_KEY = "ofw.m07.v1.3.1.saved-explorations";
  const RECENT_KEY = "ofw.m07.v1.3.1.recent-objects";
  const ROUTES = new Set(["discover", "explore"]);
  const PRESERVED_QUERY_KEYS = [
    "embedded", "resource", "scenarioId", "scenarioVersion", "scenarioRunId",
    "formedAt", "status", "contextCreatedAt", "contextStatus",
    "scenarioFormedAt", "scenarioStatus", "v"
  ];

  const LENSES = Object.freeze([
    { id: "catalog", label: "对象目录", short: "结果表", icon: "table-properties" },
    { id: "object360", label: "对象全貌", short: "属性与证据", icon: "scan-face" },
    { id: "graph", label: "关系网络", short: "关联与路径", icon: "share-2" },
    { id: "temporal", label: "时序分析", short: "变化与事件", icon: "chart-no-axes-combined" },
    { id: "spatial", label: "地图", short: "位置与范围", icon: "map" },
    { id: "compare", label: "对比分析", short: "指标与差异", icon: "columns-3" }
  ]);

  const QUALITY = Object.freeze({
    passed: { label: "可直接使用", short: "可用", tone: "success", icon: "circle-check" },
    warning: { label: "需关注", short: "关注", tone: "warning", icon: "triangle-alert" },
    blocked: { label: "信息不足", short: "不足", tone: "danger", icon: "circle-dashed" }
  });

  const TYPE_META = Object.freeze({
    "m01.object-type.financing-group": { label: "集团融资", group: "融资管理", icon: "landmark", color: "#286b73" },
    "m01.object-type.financing-entity": { label: "融资主体", group: "融资管理", icon: "building-2", color: "#3574b9" },
    "m01.object-type.financing-detail": { label: "融资明细", group: "融资管理", icon: "rows-3", color: "#5c6f82" },
    "m01.object-type.financing-owner": { label: "业务负责人", group: "融资管理", icon: "user-round", color: "#7262a8" },
    "m01.object-type.financing-rule-result": { label: "规则结果", group: "融资管理", icon: "badge-alert", color: "#b65847" },
    "m01.object-type.financial-institution": { label: "金融机构", group: "融资管理", icon: "landmark", color: "#27806e" },
    "m01.object-type.budget-context": { label: "预算监测", group: "预算监督", icon: "calculator", color: "#71632b" },
    "m01.object-type.budget-unit": { label: "预算单元", group: "预算监督", icon: "receipt-text", color: "#9a6e26" },
    "m01.object-type.enterprise-assessment-context": { label: "风险评估", group: "债务风险", icon: "shield-alert", color: "#9b4b45" },
    "m01.object-type.enterprise": { label: "企业", group: "债务风险", icon: "factory", color: "#456da8" },
    "m01.object-type.loan-assessment-context": { label: "贷前调查", group: "贷前评估", icon: "clipboard-check", color: "#4c6f83" },
    "m01.object-type.loan-applicant": { label: "申请主体", group: "贷前评估", icon: "briefcase-business", color: "#377a87" },
    "m01.object-type.investment-portfolio": { label: "投资组合", group: "投后评价", icon: "pie-chart", color: "#665d96" },
    "m01.object-type.financial-product": { label: "金融产品", group: "投后评价", icon: "badge-dollar-sign", color: "#386eb3" },
    "m01.object-type.investment-holding": { label: "投资持仓", group: "投后评价", icon: "chart-candlestick", color: "#28786c" },
    "m01.object-type.issuer-candidate": { label: "发行主体", group: "投后评价", icon: "building", color: "#9a6840" },
    "m01.object-type.manager-candidate": { label: "管理机构", group: "投后评价", icon: "contact-round", color: "#7c5d90" },
    "m01.object-type.validation-location": { label: "位置对象", group: "投后评价", icon: "map-pin", color: "#b45d46" },
    "m07.object-type.report": { label: "分析报告", group: "分析交付", icon: "file-chart-column", color: "#4d6897" },
    "m07.object-type.report-evidence": { label: "证据包", group: "分析交付", icon: "folder-search-2", color: "#56788a" }
  });

  const PROPERTY_LABELS = Object.freeze({
    actualAmount: "实际执行", applicantCount: "申请主体数", assessmentAsOf: "评估时点",
    authorityStatus: "权威状态", averageFinancingCost: "平均融资成本", balance: "融资余额",
    budgetAmount: "预算金额", budgetUnitCount: "预算单元数", candidateFor: "关联对象",
    candidateRole: "业务角色", categoryLevel1: "产品大类", categoryLevel2: "产品类型",
    condition: "判断条件", contentVersion: "内容版本", coverage: "覆盖率", crs: "坐标系",
    currency: "币种", dataAsOf: "数据截至", dataCompleteness: "资料完整度",
    dataVersion: "数据版本", debtRatio: "资产负债率", derivation: "形成方式",
    displayName: "显示名称", entityCount: "融资主体数", evaluatedAt: "求值时间",
    evidencePackId: "证据包", evidenceStatus: "证据状态", evidenceType: "证据类型",
    executionRate: "预算执行率", financingBalance: "融资余额", floatingRateRatio: "浮动利率占比",
    formats: "交付格式", geometry: "空间位置", grain: "数据粒度", industry: "所属产业",
    labelUsage: "标签用途", loanCount: "融资笔数", metricLabel: "指标名称",
    modelVersion: "模型版本", observedValue: "观测值", ontologyVersion: "本体版本",
    outcomeLabelStatus: "结果标签", ownerRef: "负责人", priorityRank: "优先级",
    publishedSemanticVersionId: "语义版本", quality: "质量", rateType: "利率形式",
    recordCount: "记录数", region: "区域", reportId: "报告编号", reportRef: "关联报告",
    reviewPriority: "复核优先级", reviewStatus: "复核状态", riskScore: "风险评分",
    riskTier: "风险分档", ruleCode: "规则编号", ruleId: "规则引用", ruleMetricLabel: "规则指标",
    ruleMetricValue: "规则指标值", ruleName: "规则名称", scenario: "业务域",
    seedReportId: "来源报告", selectionStatus: "选择状态", shortTermDebtRatio: "短期债务占比",
    snapshotCount: "快照数", sourceCode: "来源编码", sourceObjectId: "对象定义",
    sourceRefs: "来源引用", sourceRows: "来源记录数", sourceScope: "来源范围",
    spatialApplicability: "空间适用性", status: "当前状态", termType: "期限类型",
    threshold: "阈值", unitRef: "主体引用", validFrom: "有效期起", validTo: "有效期止",
    verificationRunId: "核验运行", version: "版本", weightedAverageCost: "加权融资成本"
  });

  const LINK_LABELS = Object.freeze({
    "m01.link-type.portfolio-has-holding": "包含持仓",
    "m01.link-type.holding-refers-product": "对应产品",
    "m01.link-type.issuedByCandidate": "发行主体候选",
    "m01.link-type.managedByCandidate": "管理机构候选",
    "m01.link-type.validation-related-location": "位置关联"
  });

  const MODULE_TARGETS = Object.freeze({
    query: { label: "就此提问", detail: "在智能问数中沿用当前对象与时间范围", icon: "sparkles", route: "#module/query" },
    modeling: { label: "打开模型目标", detail: "将当前对象、数据版本与 Lens 带入模型优化", icon: "activity", route: "#module/modeling" },
    report: { label: "加入报告", detail: "把当前视图与证据交给报告中心", icon: "file-plus-2", route: "#module/report" },
    dashboard: { label: "查看驾驶舱", detail: "在管理视图中定位当前对象", icon: "layout-dashboard", route: "#dashboard" }
  });

  const CHART_COLORS = ["#2878bd", "#1c8a78", "#b66b35", "#7865a8", "#b34f59", "#5a7185", "#8a7b2c", "#337f96"];

  const app = document.getElementById("app");
  const discoverView = document.getElementById("discover-view");
  const exploreView = document.getElementById("explore-view");
  const typeFacets = document.getElementById("type-facets");
  const savedList = document.getElementById("saved-list");
  const previewPane = document.getElementById("preview-pane");
  const discoveryResults = document.getElementById("discovery-results");
  const objectSearch = document.getElementById("object-search");
  const qualityFilter = document.getElementById("quality-filter");
  const workspaceContext = document.getElementById("workspace-context");
  const lensNav = document.getElementById("lens-nav");
  const pathPane = document.getElementById("path-pane");
  const canvasHeader = document.getElementById("canvas-header");
  const canvasStage = document.getElementById("canvas-stage");
  const inspectorPane = document.getElementById("inspector-pane");
  const drawer = document.getElementById("drawer");
  const scrim = document.getElementById("scrim");
  const saveDialog = document.getElementById("save-dialog");
  const saveForm = document.getElementById("save-form");
  const toastRegion = document.getElementById("toast-region");

  let resource = null;
  let state = null;
  let indexes = null;
  let pendingWorkspaceContext = null;
  let pendingM08Return = null;
  let returnedModelResult = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function icon(name, className = "") {
    return `<i data-lucide="${escapeHtml(name)}"${className ? ` class="${escapeHtml(className)}"` : ""}></i>`;
  }

  function refreshIcons(root = document) {
    if (global.lucide?.createIcons) {
      global.lucide.createIcons({ root, attrs: { "stroke-width": 1.8 } });
    }
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function hashString(input) {
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function formatNumber(value, maximumFractionDigits = 2) {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value ?? "—");
    return new Intl.NumberFormat("zh-CN", { maximumFractionDigits }).format(number);
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  }

  function formatValue(property) {
    if (!property) return "—";
    if (property.value == null) {
      const stateLabels = {
        missing: "缺失", redacted: "已脱敏", not_provided: "未提供",
        quality_blocked: "质量阻断", not_applicable: "不适用"
      };
      return stateLabels[property.state] || "无法评价";
    }
    if (Array.isArray(property.value)) return property.value.join("、") || "—";
    if (typeof property.value === "object") {
      if (property.value.type === "Point" && Array.isArray(property.value.coordinates)) {
        return `${formatNumber(property.value.coordinates[0], 4)}, ${formatNumber(property.value.coordinates[1], 4)}`;
      }
      return Object.entries(property.value).map(([key, value]) => `${key}: ${value}`).join(" · ");
    }
    const value = typeof property.value === "number" ? formatNumber(property.value) : String(property.value);
    return `${value}${property.unit ? ` ${property.unit}` : ""}`;
  }

  function typeMeta(objectOrType) {
    const id = typeof objectOrType === "string" ? objectOrType : objectOrType?.objectTypeId;
    return TYPE_META[id] || { label: id?.split(".").at(-1) || "业务对象", group: "其他对象", icon: "box", color: "#607386" };
  }

  function qualityMeta(value) {
    return QUALITY[value] || QUALITY.warning;
  }

  function propertyEntries(item) {
    return Object.entries(item?.properties || {}).filter(([key]) => key !== "scenario");
  }

  function propertyLabel(key) {
    return PROPERTY_LABELS[key] || key.replace(/([a-z])([A-Z])/g, "$1 $2");
  }

  function propertyValue(item, key) {
    return item?.properties?.[key]?.value;
  }

  function linkLabel(link) {
    return link.label || LINK_LABELS[link.linkTypeId] || link.linkTypeId?.split(".").at(-1) || "关联";
  }

  function normalizeDateRange(range = {}) {
    const min = resource?.source?.dateRange?.from || "2024-12-31";
    const max = resource?.source?.dateRange?.to || "2026-08-15";
    let start = range.start || range.from || min;
    let end = range.end || range.to || max;
    if (start < min) start = min;
    if (end > max) end = max;
    if (start > end) [start, end] = [end, start];
    return { start, end, label: `${start} 至 ${end}` };
  }

  function buildIndexes(data) {
    const byId = new Map();
    const byCanonicalId = new Map();
    data.objects.forEach((item) => {
      byId.set(item.id, item);
      if (item.canonicalObjectRef?.id) byCanonicalId.set(item.canonicalObjectRef.id, item);
      if (item.objectRef?.id) byCanonicalId.set(item.objectRef.id, item);
    });
    const linksByObject = new Map();
    data.links.forEach((link) => {
      [link.from, link.to].forEach((id) => {
        if (!linksByObject.has(id)) linksByObject.set(id, []);
        linksByObject.get(id).push(link);
      });
    });
    const seriesByObject = new Map();
    data.series.forEach((series) => {
      if (!seriesByObject.has(series.ownerObjectId)) seriesByObject.set(series.ownerObjectId, []);
      seriesByObject.get(series.ownerObjectId).push(series);
    });
    const eventsByObject = new Map();
    data.events.forEach((event) => {
      const ownerId = event.objectId || event.ownerObjectId;
      if (!ownerId) return;
      if (!eventsByObject.has(ownerId)) eventsByObject.set(ownerId, []);
      eventsByObject.get(ownerId).push(event);
    });
    return { byId, byCanonicalId, linksByObject, seriesByObject, eventsByObject };
  }

  function resolveObject(value) {
    if (!value || !indexes) return null;
    if (typeof value === "object") {
      return indexes.byId.get(value.id) || indexes.byCanonicalId.get(value.id) || null;
    }
    return indexes.byId.get(value) || indexes.byCanonicalId.get(value) || null;
  }

  function activeObject() {
    return resolveObject(state?.activeId) || resource?.objects?.[0] || null;
  }

  function canonicalObjectRef(item = activeObject()) {
    if (!item) return null;
    const fallbackResource = resource.portfolioResources?.find((entry) => entry.scenarioId === item.scenarioId) || {};
    return {
      id: item.canonicalObjectRef?.id || item.objectRef?.id || item.id,
      title: item.canonicalObjectRef?.title || item.title,
      objectTypeRef: item.canonicalObjectRef?.objectTypeRef || item.objectRef?.objectTypeRef || item.objectTypeId,
      scenarioId: item.canonicalObjectRef?.scenarioId || item.objectRef?.scenarioId || item.scenarioId,
      dataVersionId: item.canonicalObjectRef?.dataVersionId || fallbackResource.dataVersionId || null,
      ontologyVersionId: item.canonicalObjectRef?.ontologyVersionId || fallbackResource.ontologyVersionId || null,
      bindingId: item.canonicalObjectRef?.bindingId || fallbackResource.bindingId || null
    };
  }

  function objectLinks(item = activeObject()) {
    return indexes.linksByObject.get(item?.id) || [];
  }

  function objectSeries(item = activeObject()) {
    return indexes.seriesByObject.get(item?.id) || [];
  }

  function objectEvents(item = activeObject()) {
    return indexes.eventsByObject.get(item?.id) || [];
  }

  function relatedObject(link, objectId) {
    return resolveObject(link.from === objectId ? link.to : link.from);
  }

  function selectedObjects() {
    return state.selectedIds.map(resolveObject).filter(Boolean);
  }

  function objectSetObjects() {
    const selected = selectedObjects();
    return selected.length ? selected : filteredObjects();
  }

  function searchableText(item) {
    const properties = propertyEntries(item).flatMap(([key, property]) => [key, propertyLabel(key), formatValue(property)]);
    return [item.id, item.title, item.subtitle, typeMeta(item).label, typeMeta(item).group, item.canonicalObjectRef?.id, ...properties]
      .filter(Boolean).join(" ").toLocaleLowerCase("zh-CN");
  }

  function filteredObjects() {
    const query = state.search.trim().toLocaleLowerCase("zh-CN");
    return resource.objects
      .filter((item) => state.typeFilter === "all" || item.objectTypeId === state.typeFilter)
      .filter((item) => state.quality === "all" || item.quality === state.quality)
      .filter((item) => !query || searchableText(item).includes(query))
      .sort((left, right) => {
        const qualityOrder = { blocked: 0, warning: 1, passed: 2 };
        const qualityDelta = qualityOrder[left.quality] - qualityOrder[right.quality];
        return qualityDelta || left.title.localeCompare(right.title, "zh-CN");
      });
  }

  function currentRoute() {
    const raw = global.location.hash.replace(/^#\/?/, "").split(/[?&]/)[0];
    return ROUTES.has(raw) ? raw : "discover";
  }

  function parseCsv(value) {
    return value ? value.split(",").map((item) => decodeURIComponent(item)).filter(Boolean) : [];
  }

  function readStateFromUrl() {
    const params = new URLSearchParams(global.location.search);
    const requestedObject = resolveObject(params.get("object"));
    const recent = loadRecent().map(resolveObject).find(Boolean);
    const preferred = requestedObject || recent || resolveObject("investment::holding-02") || resource.objects[0];
    const requestedSet = parseCsv(params.get("set")).map(resolveObject).filter(Boolean).map((item) => item.id);
    const range = normalizeDateRange({ start: params.get("from"), end: params.get("to") });
    const requestedLens = params.get("lens");
    return {
      route: currentRoute(),
      lens: LENSES.some((item) => item.id === requestedLens) ? requestedLens : "catalog",
      search: params.get("q") || "",
      typeFilter: TYPE_META[params.get("type")] ? params.get("type") : "all",
      quality: ["all", ...Object.keys(QUALITY)].includes(params.get("quality")) ? params.get("quality") : "all",
      selectedIds: [...new Set(requestedSet)],
      activeId: preferred?.id || null,
      previewId: preferred?.id || null,
      timeRange: range,
      objectTab: ["properties", "relations", "events", "evidence"].includes(params.get("tab")) ? params.get("tab") : "properties",
      graphExpanded: [...new Set(parseCsv(params.get("expanded")).map(resolveObject).filter(Boolean).map((item) => item.id))],
      graphSelectedId: resolveObject(params.get("graphSelected"))?.id || preferred?.id || null,
      timelineSeriesIds: parseCsv(params.get("series")),
      compareChart: ["bar", "dot", "radar"].includes(params.get("chart")) ? params.get("chart") : "bar",
      compareMetric: params.get("metric") || null,
      mapZoom: Math.min(2.2, Math.max(0.8, Number(params.get("mapZoom")) || 1)),
      mapLinks: params.get("mapLinks") !== "off",
      pathSearch: ""
    };
  }

  function serializeState(nextState = state) {
    const current = new URLSearchParams(global.location.search);
    const params = new URLSearchParams();
    PRESERVED_QUERY_KEYS.forEach((key) => {
      if (current.has(key)) params.set(key, current.get(key));
    });
    if (nextState.search) params.set("q", nextState.search);
    if (nextState.typeFilter !== "all") params.set("type", nextState.typeFilter);
    if (nextState.quality !== "all") params.set("quality", nextState.quality);
    if (nextState.selectedIds.length) params.set("set", nextState.selectedIds.join(","));
    if (nextState.route === "explore" && nextState.activeId) params.set("object", nextState.activeId);
    if (nextState.route === "explore") params.set("lens", nextState.lens);
    if (nextState.timeRange.start) params.set("from", nextState.timeRange.start);
    if (nextState.timeRange.end) params.set("to", nextState.timeRange.end);
    if (nextState.objectTab !== "properties") params.set("tab", nextState.objectTab);
    if (nextState.graphExpanded.length) params.set("expanded", nextState.graphExpanded.join(","));
    if (nextState.graphSelectedId && nextState.graphSelectedId !== nextState.activeId) params.set("graphSelected", nextState.graphSelectedId);
    if (nextState.timelineSeriesIds.length) params.set("series", nextState.timelineSeriesIds.join(","));
    if (nextState.compareChart !== "bar") params.set("chart", nextState.compareChart);
    if (nextState.compareMetric) params.set("metric", nextState.compareMetric);
    if (nextState.mapZoom !== 1) params.set("mapZoom", nextState.mapZoom.toFixed(2));
    if (!nextState.mapLinks) params.set("mapLinks", "off");
    return `${global.location.pathname}${params.size ? `?${params.toString()}` : ""}#${nextState.route}`;
  }

  function updateUrl(mode = "replace") {
    const next = serializeState();
    const method = mode === "push" ? "pushState" : "replaceState";
    global.history[method]({ ofwM07: true, route: state.route }, "", next);
  }

  function stateTouchesContext(patch) {
    return ["selectedIds", "activeId", "timeRange", "lens", "search", "typeFilter", "quality", "route"].some((key) => Object.hasOwn(patch, key));
  }

  function setState(patch, options = {}) {
    const contextChanged = stateTouchesContext(patch);
    state = { ...state, ...patch };
    if (patch.activeId && !patch.previewId) state.previewId = patch.activeId;
    updateUrl(options.history || "replace");
    if (options.render !== false) render();
    if (contextChanged && options.emit !== false) emitWorkspaceContextUpdate();
  }

  function objectSetRef() {
    const objects = objectSetObjects();
    const canonicalRefs = objects.map(canonicalObjectRef).filter(Boolean);
    const signature = canonicalRefs.map((item) => `${item.objectTypeRef}:${item.id}`).sort().join("|");
    const explicit = state.selectedIds.length > 0;
    return {
      id: `object-set:m07:${hashString(signature || "empty")}`,
      title: state.selectedIds.length ? `已选 ${objects.length} 个对象` : `当前结果 ${objects.length} 个对象`,
      count: objects.length,
      selectionMode: explicit ? "EXPLICIT" : "FILTERED",
      filters: explicit ? null : {
        query: state.search || "",
        objectTypeId: state.typeFilter,
        quality: state.quality
      },
      ...(explicit ? {
        objectIds: canonicalRefs.map((item) => item.id),
        objectRefs: canonicalRefs
      } : {})
    };
  }

  function currentEvidenceRefs(item = activeObject()) {
    if (!item) return [];
    const refs = [
      ...(item.sourceRefs || []),
      ...propertyEntries(item).flatMap(([, property]) => property.sourceRefs || []),
      ...objectLinks(item).flatMap((link) => link.sourceRefs || []),
      ...objectSeries(item).flatMap((series) => [series.id, series.versionRef, ...(series.points || []).flatMap((point) => point.sourceRefs || [])])
    ].filter(Boolean);
    return [...new Set(refs)].slice(0, 40);
  }

  function workspaceContextPatch() {
    const ref = state.route === "explore" ? canonicalObjectRef() : null;
    return {
      objectSetRef: objectSetRef(),
      activeObjectRef: ref,
      timeRange: { ...state.timeRange },
      lensRef: state.route === "explore"
        ? { moduleId: MODULE_ID, lensId: state.lens, route: "#explore" }
        : { moduleId: MODULE_ID, lensId: "discover", route: "#discover" },
      dataVersionRef: ref?.dataVersionId ? { id: ref.dataVersionId } : null,
      ontologyVersionRef: ref?.ontologyVersionId ? { id: ref.ontologyVersionId } : null,
      evidenceRefs: ref ? currentEvidenceRefs() : [],
      sourceModuleId: MODULE_ID
    };
  }

  function emitWorkspaceContextUpdate() {
    if (global.parent === global) return;
    global.parent.postMessage({ type: "OFW_WORKSPACE_CONTEXT_UPDATE", patch: workspaceContextPatch() }, global.location.origin);
  }

  function applyWorkspaceContext(context) {
    if (!resource || !context) {
      pendingWorkspaceContext = clone(context);
      return;
    }
    const objectIds = context.objectSetRef?.objectRefs?.map((item) => item.id)
      || context.objectSetRef?.objectIds
      || context.objectSetRef?.ids
      || [];
    const explicitSet = context.objectSetRef?.selectionMode === "EXPLICIT" || context.objectSetRef?.explicit === true;
    const selectedIds = explicitSet ? objectIds.map(resolveObject).filter(Boolean).map((item) => item.id) : [];
    const active = resolveObject(context.activeObjectRef || context.objectRef);
    const lensId = context.lensRef?.lensId || context.lens;
    const patch = {};
    if (explicitSet) patch.selectedIds = [...new Set(selectedIds)];
    if (!explicitSet && context.objectSetRef?.selectionMode === "FILTERED") {
      const filters = context.objectSetRef.filters || {};
      patch.selectedIds = [];
      if (typeof filters.query === "string") patch.search = filters.query;
      if (filters.objectTypeId === "all" || TYPE_META[filters.objectTypeId]) patch.typeFilter = filters.objectTypeId;
      if (["all", ...Object.keys(QUALITY)].includes(filters.quality)) patch.quality = filters.quality;
    }
    if (active) patch.activeId = active.id;
    if (context.timeRange) patch.timeRange = normalizeDateRange(context.timeRange);
    if (LENSES.some((item) => item.id === lensId)) patch.lens = lensId;
    const explicitlyExploring = context.route === "#explore" || context.lensRef?.route === "#explore" || LENSES.some((item) => item.id === lensId);
    if (active || explicitlyExploring) patch.route = "explore";
    if (!Object.keys(patch).length) return;
    state = { ...state, ...patch, previewId: active?.id || state.previewId };
    updateUrl("replace");
    render();
  }

  function loadSaved() {
    try {
      const value = JSON.parse(global.localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  }

  function persistSaved(items) {
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 16)));
  }

  function loadRecent() {
    try {
      const value = JSON.parse(global.localStorage.getItem(RECENT_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  }

  function rememberObject(item) {
    if (!item) return;
    const next = [item.id, ...loadRecent().filter((id) => id !== item.id)].slice(0, 8);
    global.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  }

  function toast(message, tone = "info") {
    const node = document.createElement("div");
    node.className = `toast ${tone}`;
    node.innerHTML = `${icon(tone === "success" ? "circle-check" : tone === "warning" ? "triangle-alert" : "info")}<span>${escapeHtml(message)}</span>`;
    toastRegion.append(node);
    refreshIcons(node);
    global.setTimeout(() => node.remove(), 3200);
  }

  function qualityChip(value, compact = false) {
    const meta = qualityMeta(value);
    return `<span class="quality-chip ${meta.tone}"><span class="status-dot"></span>${escapeHtml(compact ? meta.short : meta.label)}</span>`;
  }

  function objectGlyph(item, size = "normal") {
    const meta = typeMeta(item);
    return `<span class="object-glyph ${size}" style="--object-color:${meta.color}">${icon(meta.icon)}</span>`;
  }

  function render() {
    if (!resource || !state) return;
    app.dataset.route = state.route;
    app.dataset.lens = state.lens;
    discoverView.hidden = state.route !== "discover";
    exploreView.hidden = state.route !== "explore";
    document.querySelectorAll("[data-route]").forEach((button) => {
      const active = button.dataset.route === state.route;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    if (state.route === "discover") renderDiscover();
    else renderExplore();
    syncBreadcrumb();
    refreshIcons();
    app.setAttribute("aria-busy", "false");
  }

  function renderDiscover() {
    const filtered = filteredObjects();
    document.getElementById("stat-objects").textContent = formatNumber(resource.objects.length, 0);
    document.getElementById("stat-links").textContent = formatNumber(resource.links.length, 0);
    document.getElementById("stat-series").textContent = formatNumber(resource.series.length, 0);
    objectSearch.value = state.search;
    qualityFilter.querySelectorAll("[data-quality]").forEach((button) => button.classList.toggle("active", button.dataset.quality === state.quality));
    renderTypeFacets();
    renderSavedExplorations();
    renderDiscoveryResults(filtered);
    renderPreview();
    const type = state.typeFilter === "all" ? null : typeMeta(state.typeFilter);
    document.getElementById("result-title").textContent = state.search ? `“${state.search}”的搜索结果` : type?.label || "全部对象";
    document.getElementById("result-count").textContent = `${filtered.length} 个结果`;
    const selectedCount = state.selectedIds.length;
    document.getElementById("selection-summary").textContent = selectedCount ? `已选择 ${selectedCount} 个对象` : `将探索当前 ${filtered.length} 个结果`;
    document.getElementById("clear-selection").hidden = !selectedCount;
    document.getElementById("explore-selection").disabled = !filtered.length && !selectedCount;
  }

  function renderTypeFacets() {
    const counts = new Map();
    resource.objects.forEach((item) => counts.set(item.objectTypeId, (counts.get(item.objectTypeId) || 0) + 1));
    const groups = new Map();
    [...counts.keys()].forEach((typeId) => {
      const meta = typeMeta(typeId);
      if (!groups.has(meta.group)) groups.set(meta.group, []);
      groups.get(meta.group).push({ typeId, ...meta, count: counts.get(typeId) });
    });
    const groupOrder = ["融资管理", "预算监督", "债务风险", "贷前评估", "投后评价", "分析交付", "其他对象"];
    typeFacets.innerHTML = `<button class="facet-button all ${state.typeFilter === "all" ? "active" : ""}" type="button" data-type="all"><span>${icon("boxes")}<strong>全部对象</strong></span><b>${resource.objects.length}</b></button>${[...groups.entries()]
      .sort((left, right) => groupOrder.indexOf(left[0]) - groupOrder.indexOf(right[0]))
      .map(([group, items]) => `<section class="facet-group"><h3>${escapeHtml(group)}</h3>${items
        .sort((left, right) => left.label.localeCompare(right.label, "zh-CN"))
        .map((item) => `<button class="facet-button ${state.typeFilter === item.typeId ? "active" : ""}" type="button" data-type="${escapeHtml(item.typeId)}"><span>${icon(item.icon)}<strong>${escapeHtml(item.label)}</strong></span><b>${item.count}</b></button>`).join("")}</section>`).join("")}`;
  }

  function renderSavedExplorations() {
    const saved = loadSaved();
    document.getElementById("saved-count").textContent = saved.length;
    if (!saved.length) {
      savedList.innerHTML = `<div class="empty-compact">${icon("bookmark")}<span>尚无保存记录</span></div>`;
      return;
    }
    savedList.innerHTML = saved.slice(0, 6).map((item) => `<div class="saved-row"><button type="button" data-open-saved="${escapeHtml(item.id)}"><span>${icon("bookmark-check")}</span><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.objectSetRef?.title || "对象集")} · ${escapeHtml(LENSES.find((lens) => lens.id === item.lens)?.label || "探索")}</small></div></button><button class="saved-delete" type="button" data-delete-saved="${escapeHtml(item.id)}" title="删除" aria-label="删除${escapeHtml(item.name)}">${icon("x")}</button></div>`).join("");
  }

  function primaryMetric(item) {
    const preferred = ["riskScore", "averageFinancingCost", "executionRate", "dataCompleteness", "balance", "debtRatio", "scopeStatus", "evidenceStatus"];
    const key = preferred.find((candidate) => item.properties?.[candidate]);
    if (key) return { label: propertyLabel(key), value: formatValue(item.properties[key]) };
    const first = propertyEntries(item).find(([, property]) => property.value != null && typeof property.value !== "object");
    return first ? { label: propertyLabel(first[0]), value: formatValue(first[1]) } : { label: "对象标识", value: item.canonicalObjectRef?.id || item.id };
  }

  function renderDiscoveryResults(items) {
    if (!items.length) {
      discoveryResults.innerHTML = `<div class="empty-state"><span>${icon("search-x")}</span><h2>没有匹配的对象</h2><p>调整搜索词或清除筛选后继续查找。</p><button class="button primary" type="button" data-reset-discovery>清除筛选</button></div>`;
      return;
    }
    const selected = new Set(state.selectedIds);
    const allSelected = items.every((item) => selected.has(item.id));
    const table = `<div class="result-table-wrap"><table class="result-table"><thead><tr><th class="check-cell"><label class="check-control"><input type="checkbox" data-select-all ${allSelected ? "checked" : ""}><span></span></label></th><th>业务对象</th><th>对象类型</th><th>关键值</th><th>质量</th><th>关系</th><th>数据截至</th><th></th></tr></thead><tbody>${items.map((item) => {
      const metric = primaryMetric(item);
      const links = objectLinks(item).length;
      const asOf = propertyValue(item, "dataAsOf") || propertyValue(item, "assessmentAsOf") || resource.portfolioResources?.find((entry) => entry.scenarioId === item.scenarioId)?.dataAsOf;
      return `<tr class="${state.previewId === item.id ? "previewing" : ""}" data-preview-object="${escapeHtml(item.id)}"><td class="check-cell"><label class="check-control"><input type="checkbox" data-select-object="${escapeHtml(item.id)}" ${selected.has(item.id) ? "checked" : ""}><span></span></label></td><td><div class="object-cell">${objectGlyph(item, "small")}<div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.subtitle || item.canonicalObjectRef?.id || item.id)}</small></div></div></td><td><span class="type-label">${escapeHtml(typeMeta(item).label)}</span></td><td><div class="metric-cell"><strong>${escapeHtml(metric.value)}</strong><small>${escapeHtml(metric.label)}</small></div></td><td>${qualityChip(item.quality, true)}</td><td>${links}</td><td>${escapeHtml(formatDate(asOf))}</td><td><button class="row-arrow" type="button" data-open-object="${escapeHtml(item.id)}" aria-label="打开${escapeHtml(item.title)}">${icon("arrow-right")}</button></td></tr>`;
    }).join("")}</tbody></table></div>`;
    const cards = `<div class="result-cards">${items.map((item) => {
      const metric = primaryMetric(item);
      return `<article class="result-card ${state.previewId === item.id ? "previewing" : ""}" data-preview-object="${escapeHtml(item.id)}"><header><label class="check-control"><input type="checkbox" data-select-object="${escapeHtml(item.id)}" ${selected.has(item.id) ? "checked" : ""}><span></span></label>${objectGlyph(item, "small")}<div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(typeMeta(item).label)}</small></div>${qualityChip(item.quality, true)}</header><div class="mobile-metric"><span>${escapeHtml(metric.label)}</span><strong>${escapeHtml(metric.value)}</strong></div><button class="mobile-open" type="button" data-open-object="${escapeHtml(item.id)}">查看对象 ${icon("arrow-right")}</button></article>`;
    }).join("")}</div>`;
    discoveryResults.innerHTML = table + cards;
  }

  function keyProperties(item, limit = 5) {
    const preferred = ["riskScore", "riskTier", "averageFinancingCost", "balance", "executionRate", "budgetAmount", "actualAmount", "dataCompleteness", "debtRatio", "categoryLevel2", "scopeStatus", "evidenceStatus", "snapshotCount"];
    const entries = propertyEntries(item);
    return [...preferred.map((key) => entries.find(([candidate]) => candidate === key)).filter(Boolean), ...entries.filter(([key]) => !preferred.includes(key))]
      .filter(([, property]) => property.value != null && typeof property.value !== "object")
      .slice(0, limit);
  }

  function renderPreview() {
    const item = resolveObject(state.previewId) || activeObject();
    if (!item) {
      previewPane.innerHTML = "";
      return;
    }
    const links = objectLinks(item);
    const series = objectSeries(item);
    const metrics = keyProperties(item, 4);
    previewPane.innerHTML = `<div class="preview-scroll"><header class="preview-header"><div class="preview-icon">${objectGlyph(item, "large")}</div><span class="type-label">${escapeHtml(typeMeta(item).label)}</span><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.subtitle || "")}</p>${qualityChip(item.quality)}</header><section class="preview-metrics">${metrics.map(([key, property]) => `<div><span>${escapeHtml(propertyLabel(key))}</span><strong>${escapeHtml(formatValue(property))}</strong></div>`).join("") || `<div><span>对象标识</span><strong>${escapeHtml(item.canonicalObjectRef?.id || item.id)}</strong></div>`}</section><section class="preview-footprint"><div><strong>${links.length}</strong><span>关系</span></div><div><strong>${series.length}</strong><span>时序</span></div><div><strong>${currentEvidenceRefs(item).length}</strong><span>证据</span></div></section>${links.length ? `<section class="preview-relations"><h3>直接关系</h3>${links.slice(0, 4).map((link) => { const related = relatedObject(link, item.id); return related ? `<button type="button" data-preview-object="${escapeHtml(related.id)}"><span>${escapeHtml(linkLabel(link))}</span><strong>${escapeHtml(related.title)}</strong>${icon("chevron-right")}</button>` : ""; }).join("")}</section>` : ""}<footer class="preview-actions"><button class="button quiet" type="button" data-toggle-object="${escapeHtml(item.id)}">${state.selectedIds.includes(item.id) ? icon("check") + "已加入对象集" : icon("plus") + "加入对象集"}</button><button class="button primary" type="button" data-open-object="${escapeHtml(item.id)}">打开对象</button></footer></div>`;
  }

  function renderExplore() {
    ensureWorkspaceState();
    renderWorkspaceContext();
    renderLensNav();
    renderPathPane();
    renderCanvasHeader();
    renderCanvasStage();
    renderInspector();
  }

  function ensureWorkspaceState() {
    const set = objectSetObjects();
    if (!set.length) {
      state.selectedIds = resource.objects.slice(0, 1).map((item) => item.id);
    }
    if (!resolveObject(state.activeId) || (state.selectedIds.length && !state.selectedIds.includes(state.activeId))) {
      state.activeId = state.selectedIds[0] || resource.objects[0]?.id || null;
    }
    if (!state.graphExpanded.length && state.activeId) state.graphExpanded = [state.activeId];
    if (!resolveObject(state.graphSelectedId)) state.graphSelectedId = state.activeId;
  }

  function renderWorkspaceContext() {
    const objects = objectSetObjects();
    const active = activeObject();
    const ref = canonicalObjectRef(active);
    workspaceContext.innerHTML = `<div class="context-leading"><button class="back-button" type="button" data-route="discover">${icon("arrow-left")}<span>返回对象发现</span></button><div class="context-divider"></div><button class="context-token" type="button" data-open-mobile="path"><span class="token-icon">${icon("boxes")}</span><span><small>当前对象集</small><strong>${objects.length} 个对象</strong></span>${icon("chevron-down")}</button><button class="context-token active-object-token" type="button" data-open-mobile="inspector"><span class="token-icon object-token">${icon(typeMeta(active).icon)}</span><span><small>当前对象</small><strong>${escapeHtml(active?.title || "未选择")}</strong></span>${icon("chevron-down")}</button></div><div class="time-context"><span>${icon("calendar-range")}<b>时间范围</b></span><label><span>开始</span><input id="context-time-start" type="date" min="${escapeHtml(resource.source.dateRange.from)}" max="${escapeHtml(state.timeRange.end)}" value="${escapeHtml(state.timeRange.start)}"></label><i>至</i><label><span>结束</span><input id="context-time-end" type="date" min="${escapeHtml(state.timeRange.start)}" max="${escapeHtml(resource.source.dateRange.to)}" value="${escapeHtml(state.timeRange.end)}"></label></div><div class="context-trailing"><span class="version-pill" title="当前对象数据版本">${icon("database")}<span>${escapeHtml(shortVersion(ref?.dataVersionId))}</span></span><button class="icon-button mobile-context-button" type="button" data-open-mobile="path" aria-label="打开对象集">${icon("panel-left-open")}</button><button class="icon-button mobile-context-button" type="button" data-open-mobile="inspector" aria-label="打开对象详情">${icon("panel-right-open")}</button></div>`;
  }

  function shortVersion(value) {
    if (!value) return "未绑定版本";
    return value.length > 28 ? `${value.slice(0, 12)}…${value.slice(-9)}` : value;
  }

  function renderLensNav() {
    lensNav.innerHTML = LENSES.map((lens) => `<button class="lens-button ${state.lens === lens.id ? "active" : ""}" type="button" data-lens="${lens.id}" aria-current="${state.lens === lens.id ? "page" : "false"}">${icon(lens.icon)}<span><strong>${lens.label}</strong><small>${lens.short}</small></span></button>`).join("");
  }

  function renderPathPane() {
    const objects = objectSetObjects();
    const query = state.pathSearch.trim().toLocaleLowerCase("zh-CN");
    const visible = objects.filter((item) => !query || searchableText(item).includes(query));
    pathPane.innerHTML = `<header class="pane-heading"><div><span class="eyebrow">OBJECT SET</span><h2>分析对象集</h2></div><span class="count-badge">${objects.length}</span><button class="icon-button pane-close" type="button" data-close-mobile aria-label="关闭">${icon("x")}</button></header><div class="path-summary"><div class="path-step complete"><span>1</span><div><strong>${state.selectedIds.length ? "已选对象" : "搜索结果"}</strong><small>${objects.length} 个对象进入当前分析</small></div></div><div class="path-connector"></div><div class="path-step active"><span>2</span><div><strong>${escapeHtml(LENSES.find((lens) => lens.id === state.lens)?.label)}</strong><small>${escapeHtml(state.timeRange.start)} 至 ${escapeHtml(state.timeRange.end)}</small></div></div></div><label class="pane-search">${icon("search")}<input id="path-search" type="search" value="${escapeHtml(state.pathSearch)}" placeholder="在对象集中查找"><button type="button" data-clear-path-search aria-label="清除">${icon("x")}</button></label><div class="path-object-list">${visible.map((item) => `<button class="path-object ${item.id === state.activeId ? "active" : ""}" type="button" data-set-active="${escapeHtml(item.id)}">${objectGlyph(item, "tiny")}<span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(typeMeta(item).label)}</small></span>${qualityChip(item.quality, true)}</button>`).join("") || `<div class="empty-compact">${icon("search-x")}<span>对象集中没有匹配项</span></div>`}</div><footer class="path-footer"><button class="button quiet full" type="button" data-route="discover">${icon("list-filter")}<span>调整对象范围</span></button></footer>`;
  }

  function lensHeading() {
    const active = activeObject();
    const headings = {
      catalog: { title: "对象目录", subtitle: "扫描当前对象集并选择下一步分析对象", icon: "table-properties" },
      object360: { title: active?.title || "对象全貌", subtitle: `${typeMeta(active).label} · 属性、关系、事件与证据`, icon: "scan-face" },
      graph: { title: "关系网络", subtitle: `以 ${active?.title || "当前对象"} 为中心展开业务关系`, icon: "share-2" },
      temporal: { title: "时序分析", subtitle: "多序列联动查看变化、异常与业务事件", icon: "chart-no-axes-combined" },
      spatial: { title: "地图", subtitle: "基于对象集内已治理坐标查看位置与关系", icon: "map" },
      compare: { title: "对比分析", subtitle: "比较同类对象的指标、分布与差异", icon: "columns-3" }
    };
    return headings[state.lens];
  }

  function renderCanvasHeader() {
    const heading = lensHeading();
    let controls = "";
    if (state.lens === "object360") {
      controls = `<div class="segmented compact" aria-label="对象全貌分区">${[
        ["properties", "属性"], ["relations", "关系"], ["events", "事件"], ["evidence", "证据"]
      ].map(([id, label]) => `<button type="button" data-object-tab="${id}" class="${state.objectTab === id ? "active" : ""}">${label}</button>`).join("")}</div>`;
    } else if (state.lens === "graph") {
      controls = `<button class="button quiet" type="button" data-expand-all>${icon("unfold-vertical")}<span>展开相邻节点</span></button><button class="icon-button" type="button" data-reset-graph title="重置关系图" aria-label="重置关系图">${icon("locate-fixed")}</button>`;
    } else if (state.lens === "spatial") {
      controls = `<label class="switch-control"><input type="checkbox" data-map-links ${state.mapLinks ? "checked" : ""}><span></span><b>显示关系</b></label><div class="zoom-control"><button type="button" data-map-zoom="out" aria-label="缩小">${icon("minus")}</button><span>${Math.round(state.mapZoom * 100)}%</span><button type="button" data-map-zoom="in" aria-label="放大">${icon("plus")}</button></div>`;
    } else if (state.lens === "compare") {
      controls = `<div class="segmented compact" aria-label="对比图形">${[["bar", "bar-chart-3", "条形"], ["dot", "git-commit-horizontal", "点图"], ["radar", "radar", "雷达"]].map(([id, iconName, label]) => `<button type="button" data-compare-chart="${id}" class="${state.compareChart === id ? "active" : ""}" title="${label}">${icon(iconName)}<span>${label}</span></button>`).join("")}</div>`;
    }
    canvasHeader.innerHTML = `<div class="canvas-title"><span>${icon(heading.icon)}</span><div><h1>${escapeHtml(heading.title)}</h1><p>${escapeHtml(heading.subtitle)}</p></div></div><div class="canvas-controls">${controls}</div>`;
  }

  function renderCanvasStage() {
    const renderers = {
      catalog: renderCatalogLens,
      object360: renderObject360Lens,
      graph: renderGraphLens,
      temporal: renderTemporalLens,
      spatial: renderSpatialLens,
      compare: renderCompareLens
    };
    renderers[state.lens]();
  }

  function latestSeriesSummary(item) {
    const series = objectSeries(item);
    if (!series.length) return null;
    const first = series[0];
    const points = (first.points || []).filter((point) => point.t >= state.timeRange.start && point.t <= state.timeRange.end && Number.isFinite(Number(point.v)));
    const point = points.at(-1) || first.points?.at(-1);
    return point ? { label: first.label, value: `${formatNumber(point.v)}${first.unit ? ` ${first.unit}` : ""}`, date: point.t } : null;
  }

  function renderCatalogLens() {
    const items = objectSetObjects();
    const rows = items.map((item) => {
      const metric = latestSeriesSummary(item) || primaryMetric(item);
      const events = objectEvents(item).length;
      return `<tr class="${item.id === state.activeId ? "active" : ""}" data-set-active="${escapeHtml(item.id)}"><td><div class="object-cell">${objectGlyph(item, "small")}<div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.subtitle || "")}</small></div></div></td><td>${escapeHtml(typeMeta(item).label)}</td><td><div class="metric-cell"><strong>${escapeHtml(metric?.value || "—")}</strong><small>${escapeHtml(metric?.label || "暂无关键值")}</small></div></td><td>${objectLinks(item).length}</td><td>${events}</td><td>${qualityChip(item.quality, true)}</td><td><button class="row-arrow" type="button" data-open-object="${escapeHtml(item.id)}" aria-label="查看${escapeHtml(item.title)}">${icon("arrow-right")}</button></td></tr>`;
    }).join("");
    canvasStage.innerHTML = `<div class="lens-surface catalog-lens"><div class="table-summary"><span>${icon("boxes")}<strong>${items.length} 个对象</strong><small>${new Set(items.map((item) => item.objectTypeId)).size} 种类型 · ${items.filter((item) => item.quality !== "passed").length} 个需关注</small></div><div class="table-density"><span>点击一行切换当前对象</span></div></div><div class="workspace-table-wrap"><table class="workspace-table"><thead><tr><th>业务对象</th><th>类型</th><th>当前关键值</th><th>关系</th><th>事件</th><th>质量</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="workspace-card-list">${items.map((item) => { const metric = latestSeriesSummary(item) || primaryMetric(item); return `<button class="workspace-card ${item.id === state.activeId ? "active" : ""}" type="button" data-set-active="${escapeHtml(item.id)}"><header>${objectGlyph(item, "small")}<span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(typeMeta(item).label)}</small></span>${qualityChip(item.quality, true)}</header><div><span>${escapeHtml(metric?.label || "关键值")}</span><strong>${escapeHtml(metric?.value || "—")}</strong></div></button>`; }).join("")}</div>`;
  }

  function objectSummaryMetrics(item) {
    return keyProperties(item, 4).map(([key, property]) => ({ label: propertyLabel(key), value: formatValue(property), quality: property.quality || "passed" }));
  }

  function renderObject360Lens() {
    const item = activeObject();
    if (!item) {
      canvasStage.innerHTML = emptyLens("box", "尚未选择对象", "返回对象目录选择一个对象后继续。", "返回对象目录", "catalog");
      return;
    }
    const metrics = objectSummaryMetrics(item);
    const header = `<section class="object-hero"><div class="object-hero-main">${objectGlyph(item, "hero")}<div><span class="type-label">${escapeHtml(typeMeta(item).label)}</span><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.subtitle || "")}</p></div></div><div class="object-hero-quality">${qualityChip(item.quality)}<span>${objectLinks(item).length} 条关系 · ${objectSeries(item).length} 条时序</span></div></section>${metrics.length ? `<section class="metric-ribbon">${metrics.map((metric) => `<div><span>${escapeHtml(metric.label)}</span><strong>${escapeHtml(metric.value)}</strong><i class="quality-line ${qualityMeta(metric.quality).tone}"></i></div>`).join("")}</section>` : ""}`;
    let body = "";
    if (state.objectTab === "properties") body = renderPropertiesPanel(item);
    if (state.objectTab === "relations") body = renderRelationsPanel(item);
    if (state.objectTab === "events") body = renderEventsPanel(item);
    if (state.objectTab === "evidence") body = renderEvidencePanel(item);
    canvasStage.innerHTML = `<div class="object360-lens">${header}${body}</div>`;
  }

  function renderPropertiesPanel(item) {
    const entries = propertyEntries(item);
    return `<section class="detail-section"><header><div><span class="eyebrow">PROPERTIES</span><h3>业务属性</h3></div><span>${entries.length} 项</span></header><div class="property-grid">${entries.map(([key, property]) => `<div class="property-card"><div><span>${escapeHtml(propertyLabel(key))}</span>${qualityChip(property.quality || "passed", true)}</div><strong>${escapeHtml(formatValue(property))}</strong>${property.note ? `<small>${escapeHtml(property.note)}</small>` : ""}</div>`).join("")}</div></section>`;
  }

  function renderRelationsPanel(item) {
    const links = objectLinks(item);
    if (!links.length) return emptyInline("unlink", "当前对象没有已登记关系", "可继续查看属性、时序或证据。");
    return `<section class="detail-section"><header><div><span class="eyebrow">RELATIONSHIPS</span><h3>对象关系</h3></div><button class="button quiet" type="button" data-open-lens="graph">${icon("share-2")}<span>在关系网络中打开</span></button></header><div class="relation-list">${links.map((link) => { const related = relatedObject(link, item.id); return related ? `<button type="button" data-set-active="${escapeHtml(related.id)}" data-open-lens="object360"><span class="relation-direction">${link.from === item.id ? icon("arrow-up-right") : icon("arrow-down-left")}</span>${objectGlyph(related, "small")}<span class="relation-copy"><small>${escapeHtml(linkLabel(link))}</small><strong>${escapeHtml(related.title)}</strong><em>${escapeHtml(typeMeta(related).label)}</em></span>${qualityChip(link.quality || "passed", true)}${icon("chevron-right")}</button>` : ""; }).join("")}</div></section>`;
  }

  function eventDate(event) {
    return event.t || event.occurredAt || "";
  }

  function eventTitle(event) {
    const titles = {
      "rule-evaluation": "规则触发",
      BUDGET_OVERRUN: "预算执行异常",
      MANUAL_REVIEW_REQUIRED: "需要人工复核",
      EVIDENCE_INCOMPLETE: "证据不完整"
    };
    return event.title || titles[event.eventType] || event.eventType || "业务事件";
  }

  function renderEventsPanel(item) {
    const events = objectEvents(item).sort((left, right) => eventDate(right).localeCompare(eventDate(left)));
    if (!events.length) return emptyInline("calendar-x-2", "当前对象没有业务事件", "所选时间范围内未登记规则、异常或复核事件。");
    return `<section class="detail-section"><header><div><span class="eyebrow">EVENTS</span><h3>业务事件</h3></div><button class="button quiet" type="button" data-open-lens="temporal">${icon("chart-no-axes-combined")}<span>查看时间轴</span></button></header><div class="event-timeline">${events.map((event) => `<article><time>${escapeHtml(formatDate(eventDate(event)))}</time><span class="event-marker ${event.severity === "warning" || event.state === "triggered" ? "warning" : ""}">${icon(event.state === "triggered" ? "zap" : "circle")}</span><div><strong>${escapeHtml(eventTitle(event))}</strong><p>${escapeHtml(event.ruleId || event.state || event.eventType || "")}</p><small>${(event.evidenceRefs || event.sourceRefs || []).length} 项证据</small></div></article>`).join("")}</div></section>`;
  }

  function renderEvidencePanel(item) {
    const refs = currentEvidenceRefs(item);
    const ref = canonicalObjectRef(item);
    return `<section class="detail-section"><header><div><span class="eyebrow">EVIDENCE</span><h3>版本与证据</h3></div><span>${refs.length} 项引用</span></header><div class="version-grid"><div><span>${icon("database")}数据版本</span><code>${escapeHtml(ref?.dataVersionId || "未提供")}</code></div><div><span>${icon("network")}语义版本</span><code>${escapeHtml(ref?.ontologyVersionId || "未提供")}</code></div><div><span>${icon("waypoints")}消费绑定</span><code>${escapeHtml(ref?.bindingId || "未提供")}</code></div><div><span>${icon("fingerprint")}稳定对象</span><code>${escapeHtml(ref?.objectTypeRef || "未提供")} / ${escapeHtml(ref?.id || item.id)}</code></div></div><div class="evidence-list">${refs.map((evidence, index) => `<div><span>${String(index + 1).padStart(2, "0")}</span><code>${escapeHtml(evidence)}</code><button type="button" data-copy-value="${escapeHtml(evidence)}" title="复制" aria-label="复制证据引用">${icon("copy")}</button></div>`).join("") || `<div class="empty-compact">${icon("folder-search-2")}<span>没有可显示的证据引用</span></div>`}</div></section>`;
  }

  function emptyInline(iconName, title, copy) {
    return `<div class="empty-inline"><span>${icon(iconName)}</span><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(copy)}</p></div></div>`;
  }

  function emptyLens(iconName, title, copy, actionLabel, lens) {
    return `<div class="empty-state lens-empty"><span>${icon(iconName)}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p>${lens ? `<button class="button primary" type="button" data-open-lens="${lens}">${escapeHtml(actionLabel)}</button>` : ""}</div>`;
  }

  function graphProjection() {
    const root = resolveObject(state.graphExpanded[0]) || activeObject();
    if (!root) return { root: null, nodes: [], links: [], positions: new Map() };
    const expanded = new Set([root.id, ...state.graphExpanded]);
    const depths = new Map([[root.id, 0]]);
    const queue = [root.id];
    const visibleLinks = new Map();
    while (queue.length && depths.size < 24) {
      const currentId = queue.shift();
      const depth = depths.get(currentId) || 0;
      const links = indexes.linksByObject.get(currentId) || [];
      links.forEach((link) => {
        const nextId = link.from === currentId ? link.to : link.from;
        if (!resolveObject(nextId)) return;
        visibleLinks.set(link.id, link);
        if (!depths.has(nextId)) depths.set(nextId, Math.min(depth + 1, 3));
        if (expanded.has(nextId) && depth < 2 && !queue.includes(nextId)) queue.push(nextId);
      });
    }
    const nodes = [...depths.entries()].map(([id, depth]) => ({ item: resolveObject(id), depth })).filter((entry) => entry.item);
    const links = [...visibleLinks.values()].filter((link) => depths.has(link.from) && depths.has(link.to));
    const positions = new Map([[root.id, { x: 500, y: 285 }]]);
    [1, 2, 3].forEach((depth) => {
      const ring = nodes.filter((entry) => entry.depth === depth);
      const radiusX = [0, 210, 340, 420][depth];
      const radiusY = [0, 155, 225, 260][depth];
      ring.forEach((entry, index) => {
        const seed = parseInt(hashString(entry.item.id).slice(0, 5), 36) || index;
        const offset = (seed % 37) / 37 * Math.PI * 2;
        const angle = offset + (index / Math.max(1, ring.length)) * Math.PI * 2;
        positions.set(entry.item.id, {
          x: 500 + Math.cos(angle) * radiusX,
          y: 285 + Math.sin(angle) * radiusY
        });
      });
    });
    return { root, nodes, links, positions };
  }

  function graphNodeRadius(entry) {
    if (entry.depth === 0) return 31;
    return entry.depth === 1 ? 24 : 20;
  }

  function renderGraphLens() {
    const graph = graphProjection();
    if (!graph.root) {
      canvasStage.innerHTML = emptyLens("share-2", "没有可展开的对象", "返回对象目录选择对象后继续。", "返回对象目录", "catalog");
      return;
    }
    const expanded = new Set(state.graphExpanded);
    const lines = graph.links.map((link) => {
      const from = graph.positions.get(link.from);
      const to = graph.positions.get(link.to);
      if (!from || !to) return "";
      const middleX = (from.x + to.x) / 2;
      const middleY = (from.y + to.y) / 2;
      const qualityClass = link.quality === "warning" ? "warning" : link.quality === "blocked" ? "blocked" : "";
      return `<g class="graph-edge ${qualityClass}"><line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"></line><text x="${middleX}" y="${middleY - 7}" text-anchor="middle">${escapeHtml(linkLabel(link).slice(0, 10))}</text></g>`;
    }).join("");
    const nodes = graph.nodes.map((entry) => {
      const item = entry.item;
      const position = graph.positions.get(item.id);
      const radius = graphNodeRadius(entry);
      const meta = typeMeta(item);
      const isRoot = item.id === graph.root.id;
      const isActive = item.id === state.activeId;
      const canExpand = objectLinks(item).some((link) => {
        const related = relatedObject(link, item.id);
        return related && !graph.positions.has(related.id);
      });
      return `<g class="graph-node ${isRoot ? "root" : ""} ${isActive ? "active" : ""}" transform="translate(${position.x} ${position.y})" data-graph-select="${escapeHtml(item.id)}" tabindex="0" role="button" aria-label="${escapeHtml(item.title)}"><circle r="${radius}" fill="${escapeHtml(meta.color)}"></circle><text class="node-symbol" text-anchor="middle" dominant-baseline="central">${escapeHtml(meta.label.slice(0, 1))}</text><text class="node-title" y="${radius + 20}" text-anchor="middle">${escapeHtml(item.title.length > 12 ? `${item.title.slice(0, 11)}…` : item.title)}</text>${isRoot ? `<text class="node-role" y="${radius + 35}" text-anchor="middle">中心对象</text>` : ""}${canExpand ? `<g class="expand-handle ${expanded.has(item.id) ? "expanded" : ""}" transform="translate(${radius - 2} ${-radius + 2})" data-graph-expand="${escapeHtml(item.id)}" aria-label="展开相邻节点"><circle r="10"></circle><text text-anchor="middle" dominant-baseline="central">${expanded.has(item.id) ? "−" : "+"}</text></g>` : ""}</g>`;
    }).join("");
    const selected = activeObject();
    const hiddenNeighbors = objectLinks(selected).filter((link) => {
      const related = relatedObject(link, selected.id);
      return related && !graph.positions.has(related.id);
    }).length;
    canvasStage.innerHTML = `<div class="graph-lens"><div class="graph-canvas"><svg viewBox="0 0 1000 570" role="img" aria-label="${escapeHtml(graph.root.title)}关系网络"><defs><filter id="node-shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#142536" flood-opacity=".18"></feDropShadow></filter></defs><g class="graph-grid"><path d="M0 95H1000M0 190H1000M0 285H1000M0 380H1000M0 475H1000M166 0V570M333 0V570M500 0V570M666 0V570M833 0V570"></path></g>${lines}${nodes}</svg><div class="graph-legend"><span><i style="--legend:#2878bd"></i>当前对象</span><span><i style="--legend:#8b9aaa"></i>已展开关系</span><span><i class="line warning"></i>需关注关系</span><span><i class="line blocked"></i>信息不足</span></div><div class="graph-status"><span>${icon("waypoints")}</span><div><strong>${graph.nodes.length} 个节点 · ${graph.links.length} 条关系</strong><small>${hiddenNeighbors ? `${hiddenNeighbors} 个相邻节点待展开` : "当前分支已展开"}</small></div></div></div><aside class="graph-selection"><header>${objectGlyph(selected, "small")}<div><small>当前节点</small><strong>${escapeHtml(selected.title)}</strong></div>${qualityChip(selected.quality, true)}</header><div class="graph-selection-facts"><div><span>对象类型</span><strong>${escapeHtml(typeMeta(selected).label)}</strong></div><div><span>直接关系</span><strong>${objectLinks(selected).length} 条</strong></div><div><span>已显示</span><strong>${objectLinks(selected).filter((link) => graph.positions.has(relatedObject(link, selected.id)?.id)).length} 条</strong></div></div><div class="graph-selection-actions"><button class="button primary full" type="button" data-graph-expand="${escapeHtml(selected.id)}">${icon("unfold-vertical")}<span>展开相邻节点</span></button><button class="button quiet full" type="button" data-open-lens="object360">${icon("scan-face")}<span>查看对象全貌</span></button></div></aside></div>`;
  }

  function allTimelineDates() {
    const dates = [
      resource.source.dateRange.from,
      resource.source.dateRange.to,
      ...resource.series.flatMap((series) => (series.points || []).map((point) => point.t)),
      ...resource.events.map(eventDate)
    ].filter(Boolean);
    return [...new Set(dates)].sort();
  }

  function availableSeries() {
    const set = new Set(objectSetObjects().map((item) => item.id));
    return resource.series.filter((series) => set.has(series.ownerObjectId));
  }

  function effectiveTimelineSeries() {
    const available = availableSeries();
    const availableIds = new Set(available.map((series) => series.id));
    let selected = state.timelineSeriesIds.filter((id) => availableIds.has(id));
    if (!selected.length) {
      selected = objectSeries(activeObject()).slice(0, 4).map((series) => series.id);
      if (!selected.length) selected = available.slice(0, 4).map((series) => series.id);
      state.timelineSeriesIds = selected;
      updateUrl("replace");
    }
    return selected.map((id) => available.find((series) => series.id === id)).filter(Boolean);
  }

  function lineChartSvg(series, color, index) {
    const width = 760;
    const height = 156;
    const left = 44;
    const right = 20;
    const top = 18;
    const bottom = 30;
    const points = (series.points || [])
      .filter((point) => point.t >= state.timeRange.start && point.t <= state.timeRange.end)
      .filter((point) => Number.isFinite(Number(point.v)))
      .sort((a, b) => a.t.localeCompare(b.t));
    if (!points.length) {
      return `<svg viewBox="0 0 ${width} ${height}" class="series-svg empty" role="img" aria-label="${escapeHtml(series.label)}无区间数据"><text x="${width / 2}" y="${height / 2}" text-anchor="middle">当前时间范围没有可用观测值</text></svg>`;
    }
    const values = points.map((point) => Number(point.v));
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) { min -= Math.abs(min || 1) * 0.08; max += Math.abs(max || 1) * 0.08; }
    const startMs = Date.parse(state.timeRange.start);
    const endMs = Date.parse(state.timeRange.end);
    const spanMs = Math.max(86400000, endMs - startMs);
    const x = (date) => left + ((Date.parse(date) - startMs) / spanMs) * (width - left - right);
    const y = (value) => top + (1 - (value - min) / (max - min)) * (height - top - bottom);
    const path = points.map((point, pointIndex) => `${pointIndex ? "L" : "M"}${x(point.t).toFixed(2)},${y(Number(point.v)).toFixed(2)}`).join(" ");
    const area = points.length > 1 ? `${path} L${x(points.at(-1).t).toFixed(2)},${height - bottom} L${x(points[0].t).toFixed(2)},${height - bottom} Z` : "";
    const last = points.at(-1);
    const grid = [0, .5, 1].map((ratio) => {
      const gy = top + ratio * (height - top - bottom);
      const label = max - ratio * (max - min);
      return `<line x1="${left}" y1="${gy}" x2="${width - right}" y2="${gy}"></line><text x="${left - 7}" y="${gy + 3}" text-anchor="end">${escapeHtml(formatNumber(label, 1))}</text>`;
    }).join("");
    const circles = points.length <= 24 ? points.map((point) => `<circle cx="${x(point.t)}" cy="${y(Number(point.v))}" r="3.5" data-series-point="${escapeHtml(series.id)}" data-point-date="${escapeHtml(point.t)}"><title>${escapeHtml(`${point.t} · ${formatNumber(point.v)} ${series.unit || ""}`)}</title></circle>`).join("") : "";
    return `<svg viewBox="0 0 ${width} ${height}" class="series-svg" style="--series-color:${color}" role="img" aria-label="${escapeHtml(series.label)}时序图"><g class="chart-grid">${grid}</g>${area ? `<path class="chart-area" d="${area}"></path>` : ""}<path class="chart-line" d="${path}"></path>${circles}<circle class="last-point" cx="${x(last.t)}" cy="${y(Number(last.v))}" r="5"></circle><line class="last-guide" x1="${x(last.t)}" y1="${top}" x2="${x(last.t)}" y2="${height - bottom}"></line><text class="last-label" x="${Math.min(width - 95, Math.max(left + 5, x(last.t) + 8))}" y="${Math.max(16, y(Number(last.v)) - 9)}">${escapeHtml(formatNumber(last.v))} ${escapeHtml(series.unit || "")}</text><text class="axis-label" x="${left}" y="${height - 9}">${escapeHtml(formatDate(state.timeRange.start))}</text><text class="axis-label" x="${width - right}" y="${height - 9}" text-anchor="end">${escapeHtml(formatDate(state.timeRange.end))}</text><text class="series-index" x="${width - right}" y="${top + 2}" text-anchor="end">${String(index + 1).padStart(2, "0")}</text></svg>`;
  }

  function renderTimeBrush() {
    const dates = allTimelineDates();
    const nearestIndex = (value) => dates.reduce((best, date, index) => Math.abs(Date.parse(date) - Date.parse(value)) < Math.abs(Date.parse(dates[best]) - Date.parse(value)) ? index : best, 0);
    const startIndex = nearestIndex(state.timeRange.start);
    const endIndex = nearestIndex(state.timeRange.end);
    const max = Math.max(1, dates.length - 1);
    const left = startIndex / max * 100;
    const right = endIndex / max * 100;
    return `<section class="time-brush" style="--brush-start:${left}%;--brush-end:${right}%"><header><div><span>${icon("move-horizontal")}<strong>时间刷选</strong></span><small id="brush-range-label">${escapeHtml(formatDate(state.timeRange.start))} — ${escapeHtml(formatDate(state.timeRange.end))}</small></div><button class="text-button" type="button" data-reset-time>全部时间</button></header><div class="brush-track"><div class="brush-base"></div><div class="brush-selection"></div><input type="range" min="0" max="${max}" value="${startIndex}" data-brush="start" aria-label="时间范围开始"><input type="range" min="0" max="${max}" value="${endIndex}" data-brush="end" aria-label="时间范围结束"></div><div class="brush-axis"><span>${escapeHtml(formatDate(dates[0]))}</span><span>${dates.length} 个观测时点</span><span>${escapeHtml(formatDate(dates.at(-1)))}</span></div></section>`;
  }

  function renderTemporalLens() {
    const available = availableSeries();
    if (!available.length) {
      canvasStage.innerHTML = emptyLens("chart-no-axes-combined", "当前对象集没有时序系列", "返回对象发现调整对象范围后继续。", "调整对象范围", "catalog");
      return;
    }
    const selected = effectiveTimelineSeries();
    const selectedIds = new Set(selected.map((series) => series.id));
    const events = objectSetObjects().flatMap(objectEvents)
      .filter((event) => eventDate(event) >= state.timeRange.start && eventDate(event) <= state.timeRange.end)
      .sort((left, right) => eventDate(right).localeCompare(eventDate(left)));
    canvasStage.innerHTML = `<div class="temporal-lens">${renderTimeBrush()}<section class="series-picker"><header><div><span class="eyebrow">SERIES</span><h3>分析序列</h3></div><span>已选 ${selected.length} / ${available.length}</span></header><div class="series-options">${available.map((series, index) => { const owner = resolveObject(series.ownerObjectId); return `<label class="series-option" style="--series-color:${CHART_COLORS[index % CHART_COLORS.length]}"><input type="checkbox" data-series-toggle="${escapeHtml(series.id)}" ${selectedIds.has(series.id) ? "checked" : ""}><span class="series-swatch"></span><span><strong>${escapeHtml(series.label)}</strong><small>${escapeHtml(owner?.title || "对象")} · ${series.points?.length || 0} 个观测</small></span></label>`; }).join("")}</div></section><section class="series-stack">${selected.map((series, index) => { const points = (series.points || []).filter((point) => point.t >= state.timeRange.start && point.t <= state.timeRange.end && Number.isFinite(Number(point.v))); const latest = points.at(-1); const first = points[0]; const delta = latest && first ? Number(latest.v) - Number(first.v) : null; const owner = resolveObject(series.ownerObjectId); return `<article class="series-panel" style="--series-color:${CHART_COLORS[index % CHART_COLORS.length]}"><header><div><span class="series-swatch"></span><div><strong>${escapeHtml(series.label)}</strong><small>${escapeHtml(owner?.title || "对象")} · ${escapeHtml(series.granularity || "时序")}</small></div></div><div class="series-latest"><span>${latest ? escapeHtml(formatDate(latest.t)) : "当前范围"}</span><strong>${latest ? `${escapeHtml(formatNumber(latest.v))} ${escapeHtml(series.unit || "")}` : "无观测"}</strong>${delta != null && points.length > 1 ? `<small class="${delta >= 0 ? "up" : "down"}">${delta >= 0 ? "+" : ""}${escapeHtml(formatNumber(delta))}</small>` : ""}</div></header>${lineChartSvg(series, CHART_COLORS[index % CHART_COLORS.length], index)}</article>`; }).join("")}</section><section class="event-band"><header><div><span class="eyebrow">EVENTS</span><h3>区间事件</h3></div><span>${events.length} 项</span></header>${events.length ? `<div class="event-band-list">${events.map((event) => { const owner = resolveObject(event.objectId || event.ownerObjectId); return `<button type="button" data-set-active="${escapeHtml(owner?.id || "")}"><time>${escapeHtml(formatDate(eventDate(event)))}</time><span class="event-marker warning">${icon("zap")}</span><div><strong>${escapeHtml(eventTitle(event))}</strong><small>${escapeHtml(owner?.title || "业务对象")}</small></div>${icon("chevron-right")}</button>`; }).join("")}</div>` : `<div class="event-none">${icon("calendar-check")}所选时间范围内没有业务事件</div>`}</section></div>`;
  }

  function geoObjects() {
    return objectSetObjects().filter((item) => item.properties?.geometry?.value?.type === "Point" && Array.isArray(item.properties.geometry.value.coordinates));
  }

  function renderSpatialLens() {
    const objects = geoObjects();
    if (!objects.length) {
      const totalGeo = resource.objects.filter((item) => item.properties?.geometry?.value?.type === "Point").length;
      canvasStage.innerHTML = `<div class="map-empty">${emptyLens("map-pin-off", "当前对象集没有可用坐标", `资源目录中有 ${totalGeo} 个位置对象，可返回对象发现将其加入当前对象集。`, "调整对象范围", "catalog")}</div>`;
      return;
    }
    const width = 860;
    const height = 500;
    const plot = { left: 62, top: 35, right: 38, bottom: 52 };
    const longitudes = objects.map((item) => Number(item.properties.geometry.value.coordinates[0]));
    const latitudes = objects.map((item) => Number(item.properties.geometry.value.coordinates[1]));
    let minLon = Math.min(...longitudes) - 3;
    let maxLon = Math.max(...longitudes) + 3;
    let minLat = Math.min(...latitudes) - 3;
    let maxLat = Math.max(...latitudes) + 3;
    if (maxLon - minLon < 12) { const center = (minLon + maxLon) / 2; minLon = center - 6; maxLon = center + 6; }
    if (maxLat - minLat < 10) { const center = (minLat + maxLat) / 2; minLat = center - 5; maxLat = center + 5; }
    const centerLon = (minLon + maxLon) / 2;
    const centerLat = (minLat + maxLat) / 2;
    const lonSpan = (maxLon - minLon) / state.mapZoom;
    const latSpan = (maxLat - minLat) / state.mapZoom;
    minLon = centerLon - lonSpan / 2; maxLon = centerLon + lonSpan / 2;
    minLat = centerLat - latSpan / 2; maxLat = centerLat + latSpan / 2;
    const x = (lon) => plot.left + ((lon - minLon) / (maxLon - minLon)) * (width - plot.left - plot.right);
    const y = (lat) => plot.top + (1 - (lat - minLat) / (maxLat - minLat)) * (height - plot.top - plot.bottom);
    const gridLines = Array.from({ length: 6 }, (_, index) => {
      const ratio = index / 5;
      const lon = minLon + ratio * (maxLon - minLon);
      const lat = minLat + ratio * (maxLat - minLat);
      const gx = x(lon);
      const gy = y(lat);
      return `<line x1="${gx}" y1="${plot.top}" x2="${gx}" y2="${height - plot.bottom}"></line><text x="${gx}" y="${height - 22}" text-anchor="middle">${formatNumber(lon, 1)}°E</text><line x1="${plot.left}" y1="${gy}" x2="${width - plot.right}" y2="${gy}"></line><text x="${plot.left - 10}" y="${gy + 3}" text-anchor="end">${formatNumber(lat, 1)}°N</text>`;
    }).join("");
    const objectIds = new Set(objects.map((item) => item.id));
    const mapLinks = state.mapLinks ? resource.links.filter((link) => objectIds.has(link.from) && objectIds.has(link.to)).map((link) => {
      const from = resolveObject(link.from).properties.geometry.value.coordinates;
      const to = resolveObject(link.to).properties.geometry.value.coordinates;
      return `<line class="map-relation ${link.quality || "passed"}" x1="${x(from[0])}" y1="${y(from[1])}" x2="${x(to[0])}" y2="${y(to[1])}"></line>`;
    }).join("") : "";
    const markers = objects.map((item, index) => {
      const [lon, lat] = item.properties.geometry.value.coordinates;
      const active = item.id === state.activeId;
      return `<g class="map-marker ${active ? "active" : ""}" transform="translate(${x(lon)} ${y(lat)})" data-set-active="${escapeHtml(item.id)}" tabindex="0" role="button"><circle class="marker-pulse" r="${active ? 19 : 15}"></circle><circle class="marker-core" r="${active ? 8 : 7}" style="--marker:${CHART_COLORS[index % CHART_COLORS.length]}"></circle><text y="-21" text-anchor="middle">${escapeHtml(item.title)}</text><title>${escapeHtml(`${item.title} · ${lon}, ${lat}`)}</title></g>`;
    }).join("");
    canvasStage.innerHTML = `<div class="spatial-lens"><section class="map-surface"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="对象位置分布"><rect class="map-water" x="0" y="0" width="${width}" height="${height}"></rect><rect class="map-plot" x="${plot.left}" y="${plot.top}" width="${width - plot.left - plot.right}" height="${height - plot.top - plot.bottom}"></rect><g class="map-grid">${gridLines}</g>${mapLinks}${markers}</svg><div class="map-scale"><span></span><b>坐标范围 ${formatNumber(minLon, 1)}°E–${formatNumber(maxLon, 1)}°E</b></div><div class="map-crs">EPSG:4326</div></section><aside class="map-list"><header><div><span class="eyebrow">MAP OBJECTS</span><h3>位置对象</h3></div><span>${objects.length}</span></header>${objects.map((item) => { const coordinates = item.properties.geometry.value.coordinates; return `<button type="button" class="${item.id === state.activeId ? "active" : ""}" data-set-active="${escapeHtml(item.id)}">${objectGlyph(item, "small")}<span><strong>${escapeHtml(item.title)}</strong><small>${formatNumber(coordinates[0], 4)}, ${formatNumber(coordinates[1], 4)}</small></span>${icon("locate-fixed")}</button>`; }).join("")}<footer><div><strong>${objects.length}</strong><span>有坐标</span></div><div><strong>${objectSetObjects().length - objects.length}</strong><span>无坐标</span></div></footer></aside></div>`;
  }

  function metricCandidates(items) {
    const definitions = new Map();
    items.forEach((item) => {
      propertyEntries(item).forEach(([key, property]) => {
        if (!Number.isFinite(Number(property.value))) return;
        const id = `property:${key}`;
        if (!definitions.has(id)) definitions.set(id, { id, label: propertyLabel(key), unit: property.unit || "", kind: "property", key, coverage: 0 });
        definitions.get(id).coverage += 1;
      });
      objectSeries(item).forEach((series) => {
        const id = `series:${series.label}:${series.unit || ""}`;
        if (!definitions.has(id)) definitions.set(id, { id, label: series.label, unit: series.unit || "", kind: "series", seriesLabel: series.label, coverage: 0 });
        definitions.get(id).coverage += 1;
      });
    });
    return [...definitions.values()].filter((metric) => metric.coverage >= 2).sort((left, right) => right.coverage - left.coverage || left.label.localeCompare(right.label, "zh-CN"));
  }

  function valueForMetric(item, metric) {
    if (metric.kind === "property") {
      const value = item.properties?.[metric.key]?.value;
      return Number.isFinite(Number(value)) ? Number(value) : null;
    }
    const series = objectSeries(item).find((entry) => entry.label === metric.seriesLabel && (entry.unit || "") === metric.unit);
    if (!series) return null;
    const point = (series.points || []).filter((entry) => entry.t >= state.timeRange.start && entry.t <= state.timeRange.end && Number.isFinite(Number(entry.v))).at(-1);
    return point ? Number(point.v) : null;
  }

  function comparisonItems() {
    const set = objectSetObjects();
    const active = activeObject();
    const sameType = set.filter((item) => item.objectTypeId === active?.objectTypeId);
    if (sameType.length >= 2) return sameType.slice(0, 8);
    const metrics = metricCandidates(set);
    if (!metrics.length) return set.slice(0, 8);
    return set.filter((item) => valueForMetric(item, metrics[0]) != null).slice(0, 8);
  }

  function comparisonMetric(items) {
    const metrics = metricCandidates(items);
    let selected = metrics.find((metric) => metric.id === state.compareMetric);
    if (!selected) {
      selected = metrics[0] || null;
      state.compareMetric = selected?.id || null;
      updateUrl("replace");
    }
    return { metrics, selected };
  }

  function renderBarComparison(items, metric) {
    const values = items.map((item) => ({ item, value: valueForMetric(item, metric) })).filter((entry) => entry.value != null).sort((left, right) => right.value - left.value);
    const max = Math.max(...values.map((entry) => Math.abs(entry.value)), 1);
    return `<div class="bar-comparison">${values.map((entry, index) => `<button type="button" class="bar-row ${entry.item.id === state.activeId ? "active" : ""}" data-set-active="${escapeHtml(entry.item.id)}"><span class="bar-label"><b>${index + 1}</b><span><strong>${escapeHtml(entry.item.title)}</strong><small>${escapeHtml(typeMeta(entry.item).label)}</small></span></span><span class="bar-track"><i style="width:${Math.max(2, Math.abs(entry.value) / max * 100)}%;--bar-color:${CHART_COLORS[index % CHART_COLORS.length]}"></i></span><strong class="bar-value">${escapeHtml(formatNumber(entry.value))}<small>${escapeHtml(metric.unit)}</small></strong></button>`).join("")}</div>`;
  }

  function renderDotComparison(items, metric) {
    const values = items.map((item) => ({ item, value: valueForMetric(item, metric) })).filter((entry) => entry.value != null).sort((left, right) => left.value - right.value);
    let min = Math.min(...values.map((entry) => entry.value));
    let max = Math.max(...values.map((entry) => entry.value));
    if (min === max) { min -= 1; max += 1; }
    const position = (value) => 4 + ((value - min) / (max - min)) * 92;
    const median = values.length ? values[Math.floor((values.length - 1) / 2)].value : 0;
    return `<div class="dot-comparison"><div class="dot-axis"><span>${escapeHtml(formatNumber(min))}</span><span>中位数 ${escapeHtml(formatNumber(median))}</span><span>${escapeHtml(formatNumber(max))} ${escapeHtml(metric.unit)}</span></div>${values.map((entry, index) => `<button type="button" class="dot-row ${entry.item.id === state.activeId ? "active" : ""}" data-set-active="${escapeHtml(entry.item.id)}"><span class="dot-label">${escapeHtml(entry.item.title)}</span><span class="dot-track"><i class="median" style="left:${position(median)}%"></i><i class="dot" style="left:${position(entry.value)}%;--dot-color:${CHART_COLORS[index % CHART_COLORS.length]}"></i><b style="left:${position(entry.value)}%">${escapeHtml(formatNumber(entry.value))}</b></span></button>`).join("")}</div>`;
  }

  function renderRadarComparison(items, metrics) {
    const chosenMetrics = metrics.slice(0, 5);
    const chosenItems = items.slice(0, 4);
    if (chosenMetrics.length < 3 || chosenItems.length < 2) return emptyInline("radar", "可对比指标不足", "选择至少两个同类对象，并确保存在三个共同数值指标。 ");
    const width = 680;
    const height = 430;
    const center = { x: 340, y: 205 };
    const radius = 145;
    const angleAt = (index) => -Math.PI / 2 + index / chosenMetrics.length * Math.PI * 2;
    const pointAt = (index, ratio) => ({ x: center.x + Math.cos(angleAt(index)) * radius * ratio, y: center.y + Math.sin(angleAt(index)) * radius * ratio });
    const ranges = chosenMetrics.map((metric) => {
      const values = chosenItems.map((item) => valueForMetric(item, metric)).filter((value) => value != null);
      return { min: Math.min(...values), max: Math.max(...values) };
    });
    const rings = [.25, .5, .75, 1].map((ratio) => `<polygon points="${chosenMetrics.map((_, index) => { const point = pointAt(index, ratio); return `${point.x},${point.y}`; }).join(" ")}"></polygon>`).join("");
    const axes = chosenMetrics.map((metric, index) => {
      const point = pointAt(index, 1);
      const label = pointAt(index, 1.17);
      return `<line x1="${center.x}" y1="${center.y}" x2="${point.x}" y2="${point.y}"></line><text x="${label.x}" y="${label.y}" text-anchor="${Math.abs(label.x - center.x) < 20 ? "middle" : label.x > center.x ? "start" : "end"}">${escapeHtml(metric.label)}</text>`;
    }).join("");
    const polygons = chosenItems.map((item, itemIndex) => {
      const points = chosenMetrics.map((metric, metricIndex) => {
        const value = valueForMetric(item, metric);
        const range = ranges[metricIndex];
        const ratio = value == null ? 0 : range.max === range.min ? .72 : .18 + ((value - range.min) / (range.max - range.min)) * .82;
        const point = pointAt(metricIndex, ratio);
        return `${point.x},${point.y}`;
      }).join(" ");
      return `<polygon class="radar-shape ${item.id === state.activeId ? "active" : ""}" style="--radar:${CHART_COLORS[itemIndex % CHART_COLORS.length]}" points="${points}" data-set-active="${escapeHtml(item.id)}"><title>${escapeHtml(item.title)}</title></polygon>`;
    }).join("");
    return `<div class="radar-comparison"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="多指标雷达对比"><g class="radar-grid">${rings}${axes}</g>${polygons}</svg><div class="radar-legend">${chosenItems.map((item, index) => `<button type="button" data-set-active="${escapeHtml(item.id)}" class="${item.id === state.activeId ? "active" : ""}"><i style="--legend:${CHART_COLORS[index % CHART_COLORS.length]}"></i>${escapeHtml(item.title)}</button>`).join("")}</div></div>`;
  }

  function renderCompareLens() {
    const items = comparisonItems();
    const { metrics, selected } = comparisonMetric(items);
    if (items.length < 2 || !selected) {
      canvasStage.innerHTML = emptyLens("columns-3", "当前对象集无法形成有效对比", "请在对象发现中选择至少两个具有共同数值指标的对象。", "调整对象范围", "catalog");
      return;
    }
    const chart = state.compareChart === "dot" ? renderDotComparison(items, selected)
      : state.compareChart === "radar" ? renderRadarComparison(items, metrics)
        : renderBarComparison(items, selected);
    canvasStage.innerHTML = `<div class="compare-lens"><section class="compare-toolbar"><label><span>对比指标</span><select id="compare-metric">${metrics.map((metric) => `<option value="${escapeHtml(metric.id)}" ${metric.id === selected.id ? "selected" : ""}>${escapeHtml(metric.label)}${metric.unit ? ` (${escapeHtml(metric.unit)})` : ""} · ${metric.coverage}/${items.length}</option>`).join("")}</select></label><div class="compare-summary"><div><strong>${items.length}</strong><span>对比对象</span></div><div><strong>${metrics.length}</strong><span>共同指标</span></div><div><strong>${escapeHtml(selected.unit || "数值")}</strong><span>当前单位</span></div></div></section><section class="comparison-chart ${state.compareChart}"><header><div><span class="eyebrow">COMPARISON</span><h3>${escapeHtml(state.compareChart === "radar" ? "多指标轮廓" : selected.label)}</h3></div><span>${escapeHtml(state.timeRange.start)} 至 ${escapeHtml(state.timeRange.end)}</span></header>${chart}</section><section class="comparison-table"><header><div><span class="eyebrow">DETAILS</span><h3>数值明细</h3></div></header><div class="comparison-table-scroll"><table><thead><tr><th>业务对象</th>${metrics.slice(0, 6).map((metric) => `<th>${escapeHtml(metric.label)}${metric.unit ? `<small>${escapeHtml(metric.unit)}</small>` : ""}</th>`).join("")}</tr></thead><tbody>${items.map((item) => `<tr class="${item.id === state.activeId ? "active" : ""}" data-set-active="${escapeHtml(item.id)}"><td><div class="object-cell">${objectGlyph(item, "tiny")}<strong>${escapeHtml(item.title)}</strong></div></td>${metrics.slice(0, 6).map((metric) => { const value = valueForMetric(item, metric); return `<td>${value == null ? `<span class="missing-value">—</span>` : escapeHtml(formatNumber(value))}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div></section></div>`;
  }

  function renderReturnedResult() {
    const envelope = returnedModelResult?.resultEnvelope;
    if (!envelope) return "";
    const values = (envelope.resultItems || []).slice(0, 3).map((item) => {
      let value = item.value;
      if (Array.isArray(value)) value = value.slice(0, 2).map((entry) => entry.name || entry.label || entry.value).filter(Boolean).join("、");
      if (value && typeof value === "object") value = Object.values(value).slice(0, 3).join(" · ");
      return `<div><span>${escapeHtml(item.label || item.outputId || "结果")}</span><strong>${escapeHtml(value == null ? item.missingReason || "无法评价" : `${value}${item.unit ? ` ${item.unit}` : ""}`)}</strong></div>`;
    }).join("");
    return `<section class="model-return"><header><span>${icon("activity")}</span><div><small>模型目标返回</small><strong>${escapeHtml(envelope.resultKind === "PREDICTION" ? "候选预测结果" : "模拟结果")}</strong></div><span class="result-kind">${escapeHtml(envelope.resultKind || "RESULT")}</span></header>${values ? `<div class="model-return-values">${values}</div>` : ""}<footer><code>${escapeHtml(envelope.modelVersionId || envelope.resultId || "")}</code></footer></section>`;
  }

  function renderInspector() {
    const item = activeObject();
    if (!item) {
      inspectorPane.innerHTML = `<div class="empty-compact">${icon("box")}<span>尚未选择对象</span></div>`;
      return;
    }
    const ref = canonicalObjectRef(item);
    const metrics = keyProperties(item, 4);
    const relations = objectLinks(item).slice(0, 5);
    inspectorPane.innerHTML = `<header class="pane-heading"><div><span class="eyebrow">ACTIVE OBJECT</span><h2>当前对象</h2></div><button class="icon-button pane-close" type="button" data-close-mobile aria-label="关闭">${icon("x")}</button></header><div class="inspector-scroll"><section class="inspector-identity">${objectGlyph(item, "large")}<div><span class="type-label">${escapeHtml(typeMeta(item).label)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.subtitle || "")}</p></div>${qualityChip(item.quality, true)}</section><section class="inspector-metrics">${metrics.map(([key, property]) => `<div><span>${escapeHtml(propertyLabel(key))}</span><strong>${escapeHtml(formatValue(property))}</strong></div>`).join("") || `<div><span>对象标识</span><strong>${escapeHtml(ref?.id || item.id)}</strong></div>`}</section><section class="inspector-actions"><button class="button primary full" type="button" data-open-lens="object360">${icon("scan-face")}<span>查看对象全貌</span></button><div><button class="button quiet" type="button" data-open-lens="graph" title="关系网络">${icon("share-2")}</button><button class="button quiet" type="button" data-open-lens="temporal" title="时序分析">${icon("chart-no-axes-combined")}</button><button class="button quiet" type="button" data-open-lens="compare" title="对比分析">${icon("columns-3")}</button></div></section>${renderReturnedResult()}<section class="inspector-section"><header><h3>关联对象</h3><span>${objectLinks(item).length}</span></header>${relations.length ? `<div class="inspector-relations">${relations.map((link) => { const related = relatedObject(link, item.id); return related ? `<button type="button" data-set-active="${escapeHtml(related.id)}"><span><small>${escapeHtml(linkLabel(link))}</small><strong>${escapeHtml(related.title)}</strong></span>${qualityChip(link.quality || "passed", true)}</button>` : ""; }).join("")}</div>` : `<div class="empty-compact">${icon("unlink")}<span>没有已登记关系</span></div>`}</section><details class="version-details"><summary>${icon("fingerprint")}<span>版本与对象标识</span>${icon("chevron-down")}</summary><div><label>稳定对象</label><code>${escapeHtml(ref?.objectTypeRef || item.objectTypeId)} / ${escapeHtml(ref?.id || item.id)}</code><label>数据版本</label><code>${escapeHtml(ref?.dataVersionId || "未提供")}</code><label>语义版本</label><code>${escapeHtml(ref?.ontologyVersionId || "未提供")}</code><label>消费绑定</label><code>${escapeHtml(ref?.bindingId || "未提供")}</code></div></details></div>`;
  }

  function syncBreadcrumb() {
    if (global.parent === global) return;
    global.parent.postMessage({
      channel: HANDOFF_CHANNEL,
      operation: "sync-breadcrumb",
      moduleId: MODULE_ID,
      route: state.route === "discover" ? "#discover" : "#explore",
      label: state.route === "discover" ? "对象发现" : "探索工作台"
    }, global.location.origin);
  }

  function setActiveObject(objectId, options = {}) {
    const item = resolveObject(objectId);
    if (!item) return;
    rememberObject(item);
    const patch = { activeId: item.id, previewId: item.id };
    if (state.lens === "graph" && options.keepGraphRoot !== true) {
      patch.graphExpanded = [item.id];
      patch.graphSelectedId = item.id;
    } else if (state.lens === "graph") {
      patch.graphSelectedId = item.id;
    }
    if (state.lens === "temporal" && options.keepSeries !== true) patch.timelineSeriesIds = objectSeries(item).slice(0, 4).map((series) => series.id);
    setState(patch, { history: options.history || "replace" });
  }

  function openObject(objectId) {
    const item = resolveObject(objectId);
    if (!item) return;
    const currentSelection = state.selectedIds.length ? [...state.selectedIds] : [];
    if (!currentSelection.includes(item.id)) currentSelection.unshift(item.id);
    rememberObject(item);
    setState({
      route: "explore",
      lens: "object360",
      selectedIds: state.selectedIds.length ? [...new Set(currentSelection)] : [],
      activeId: item.id,
      previewId: item.id,
      graphExpanded: [item.id],
      graphSelectedId: item.id,
      timelineSeriesIds: objectSeries(item).slice(0, 4).map((series) => series.id)
    }, { history: "push" });
  }

  function openLens(lensId) {
    if (!LENSES.some((lens) => lens.id === lensId)) return;
    const patch = { route: "explore", lens: lensId };
    if (lensId === "graph" && !state.graphExpanded.includes(state.activeId)) {
      patch.graphExpanded = [state.activeId];
      patch.graphSelectedId = state.activeId;
    }
    if (lensId === "temporal") patch.timelineSeriesIds = objectSeries(activeObject()).slice(0, 4).map((series) => series.id);
    setState(patch, { history: "push" });
  }

  function transitionRoute(route) {
    if (!ROUTES.has(route) || route === state.route) return;
    if (route === "explore" && !state.selectedIds.length) {
      const results = filteredObjects();
      if (!results.length) {
        toast("当前没有可进入探索的对象", "warning");
        return;
      }
      if (!results.some((item) => item.id === state.activeId)) state.activeId = results[0].id;
    }
    setState({ route }, { history: "push" });
  }

  function toggleObject(objectId, checked) {
    const item = resolveObject(objectId);
    if (!item) return;
    const next = new Set(state.selectedIds);
    if (checked == null ? !next.has(item.id) : checked) next.add(item.id);
    else next.delete(item.id);
    setState({ selectedIds: [...next] }, { history: "replace" });
  }

  function saveExploration() {
    const nameInput = document.getElementById("exploration-name");
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      return;
    }
    const saved = loadSaved();
    const item = {
      id: `EXP-${Date.now().toString(36).toUpperCase()}`,
      name,
      savedAt: new Date().toISOString(),
      route: "explore",
      lens: state.lens,
      selectedIds: [...state.selectedIds],
      activeId: state.activeId,
      timeRange: { ...state.timeRange },
      objectTab: state.objectTab,
      graphExpanded: [...state.graphExpanded],
      timelineSeriesIds: [...state.timelineSeriesIds],
      compareChart: state.compareChart,
      compareMetric: state.compareMetric,
      objectSetRef: objectSetRef()
    };
    persistSaved([item, ...saved]);
    saveDialog.close();
    toast("探索已保存", "success");
    if (state.route === "discover") renderSavedExplorations();
  }

  function openSaveDialog() {
    const item = activeObject();
    document.getElementById("exploration-name").value = `${item?.title || "业务对象"} · ${LENSES.find((lens) => lens.id === state.lens)?.label || "探索"}`;
    const ref = canonicalObjectRef(item);
    document.getElementById("save-context-preview").innerHTML = `<div><span>对象集</span><strong>${escapeHtml(objectSetRef().title)}</strong></div><div><span>当前对象</span><strong>${escapeHtml(item?.title || "未选择")}</strong></div><div><span>当前 Lens</span><strong>${escapeHtml(LENSES.find((lens) => lens.id === state.lens)?.label || "对象目录")}</strong></div><div><span>数据版本</span><code>${escapeHtml(shortVersion(ref?.dataVersionId))}</code></div>`;
    saveDialog.showModal();
    document.getElementById("exploration-name").select();
    refreshIcons(saveDialog);
  }

  function openSavedExploration(id) {
    const saved = loadSaved().find((item) => item.id === id);
    if (!saved) return;
    const selectedIds = (saved.selectedIds || []).map(resolveObject).filter(Boolean).map((item) => item.id);
    const active = resolveObject(saved.activeId) || resolveObject(selectedIds[0]);
    state = {
      ...state,
      route: "explore",
      lens: LENSES.some((lens) => lens.id === saved.lens) ? saved.lens : "catalog",
      selectedIds,
      activeId: active?.id || state.activeId,
      previewId: active?.id || state.previewId,
      timeRange: normalizeDateRange(saved.timeRange),
      objectTab: saved.objectTab || "properties",
      graphExpanded: (saved.graphExpanded || []).map(resolveObject).filter(Boolean).map((item) => item.id),
      timelineSeriesIds: saved.timelineSeriesIds || [],
      compareChart: saved.compareChart || "bar",
      compareMetric: saved.compareMetric || null
    };
    updateUrl("push");
    render();
    emitWorkspaceContextUpdate();
    toast(`已打开“${saved.name}”`, "success");
  }

  function openDrawer(markup, className = "") {
    drawer.className = `drawer open ${className}`.trim();
    drawer.innerHTML = markup;
    drawer.setAttribute("aria-hidden", "false");
    scrim.hidden = false;
    requestAnimationFrame(() => scrim.classList.add("visible"));
    refreshIcons(drawer);
  }

  function closeDrawer() {
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    scrim.classList.remove("visible");
    global.setTimeout(() => {
      if (!drawer.classList.contains("open")) {
        drawer.innerHTML = "";
        drawer.className = "drawer";
        scrim.hidden = true;
      }
    }, 180);
  }

  function drawerHeader(title, eyebrow = "当前探索") {
    return `<header class="drawer-header"><div><span class="eyebrow">${escapeHtml(eyebrow)}</span><h2>${escapeHtml(title)}</h2></div><button class="icon-button" type="button" data-close-drawer aria-label="关闭">${icon("x")}</button></header>`;
  }

  function openContinueDrawer() {
    const item = activeObject();
    openDrawer(`${drawerHeader("继续分析", "带当前上下文前往")}<div class="drawer-body"><section class="handoff-object">${objectGlyph(item, "large")}<div><span>${escapeHtml(objectSetRef().title)}</span><strong>${escapeHtml(item?.title || "未选择对象")}</strong><small>${escapeHtml(state.timeRange.start)} 至 ${escapeHtml(state.timeRange.end)}</small></div></section><div class="target-list">${Object.entries(MODULE_TARGETS).map(([id, target]) => `<button type="button" data-navigate-module="${id}"><span>${icon(target.icon)}</span><div><strong>${escapeHtml(target.label)}</strong><small>${escapeHtml(target.detail)}</small></div>${icon("arrow-up-right")}</button>`).join("")}</div></div>`, "action-drawer");
  }

  function openMobilePane(kind) {
    const source = kind === "path" ? pathPane : inspectorPane;
    const title = kind === "path" ? "分析对象集" : "当前对象";
    openDrawer(`${drawerHeader(title, kind === "path" ? "OBJECT SET" : "ACTIVE OBJECT")}<div class="mobile-pane-copy">${source.innerHTML}</div>`, "mobile-pane-drawer");
  }

  function selectedSeriesRef() {
    const series = state.timelineSeriesIds.map((id) => resource.series.find((entry) => entry.id === id)).find(Boolean) || objectSeries(activeObject())[0];
    return series ? { id: series.id, label: series.label, unit: series.unit || "", ownerObjectId: canonicalObjectRef(resolveObject(series.ownerObjectId))?.id || series.ownerObjectId } : null;
  }

  function buildHandoffContext() {
    const item = activeObject();
    const ref = canonicalObjectRef(item);
    return {
      objectSetRef: objectSetRef(),
      objectRef: ref,
      activeObjectRef: ref,
      lensRef: { moduleId: MODULE_ID, lensId: state.lens, route: "#explore" },
      seriesRef: selectedSeriesRef(),
      timeRange: { ...state.timeRange },
      dataVersionId: ref?.dataVersionId || null,
      ontologyVersionId: ref?.ontologyVersionId || null,
      bindingId: ref?.bindingId || null,
      evidenceRefs: currentEvidenceRefs(item),
      usageIntent: ref?.scenarioId === "S003" ? "SCORING" : ref?.scenarioId === "S005" ? "EVALUATION" : "ANALYSIS",
      scenarioContext: clone(resource.scenarioContext)
    };
  }

  function hostScenarioContextFor(ref) {
    const params = new URLSearchParams(global.location.search);
    const context = Object.fromEntries(["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"].map((key) => [key, params.get(key)]));
    if (!ref || context.scenarioId !== ref.scenarioId || Object.values(context).some((value) => !value)) return null;
    return context;
  }

  function buildS005ExplorationEnvelope(context) {
    const scenarioContext = hostScenarioContextFor(context.objectRef);
    if (context.objectRef?.scenarioId !== "S005" || !scenarioContext) return null;
    return {
      type: "OFW_S005_M07_EXPLORATION_RESULT",
      schemaVersion: "ofw.s005.m07-exploration-result.v1",
      moduleId: "M07",
      scenarioContext,
      result: {
        clientResultId: `S005-M07-EXPLORATION-${scenarioContext.scenarioRunId}-${context.objectRef.id}`,
        outputKind: "M07_EXPLORATION_RESULT",
        status: "complete",
        producedAt: new Date().toISOString(),
        explorationResultRef: `exploration://${scenarioContext.scenarioRunId}/${context.objectRef.id}/${state.lens}`,
        objectRef: context.objectRef,
        lensRef: context.lensRef,
        seriesRef: context.seriesRef,
        timeRange: context.timeRange,
        dataVersionId: context.dataVersionId,
        ontologyVersionId: context.ontologyVersionId,
        bindingId: context.bindingId,
        evidenceRefs: [context.objectRef.id, context.dataVersionId, context.ontologyVersionId, context.seriesRef?.id, ...context.evidenceRefs].filter(Boolean).slice(0, 40),
        missingReasons: context.seriesRef ? [] : ["当前对象没有受治理时序系列。"]
      }
    };
  }

  function navigateParentModule(moduleId) {
    const target = MODULE_TARGETS[moduleId];
    if (!target) return;
    const context = buildHandoffContext();
    if (!context.objectRef?.id || !context.objectRef.objectTypeRef) {
      toast("当前对象缺少稳定引用，无法交接", "warning");
      return;
    }
    const isModeling = moduleId === "modeling";
    const s005Envelope = isModeling ? buildS005ExplorationEnvelope(context) : null;
    const envelope = {
      channel: HANDOFF_CHANNEL,
      operation: isModeling ? "open-m08" : "navigate-parent-module",
      ...(isModeling ? { type: "OFW_M07_OPEN_M08", payload: context } : {}),
      ...(s005Envelope ? { explorationResultEnvelope: s005Envelope } : {}),
      moduleId,
      route: target.route,
      sourceModuleId: MODULE_ID,
      sourceRoute: MODULE_ROUTE,
      returnUrl: global.location.href,
      objectId: context.objectRef.id,
      objectTitle: context.objectRef.title,
      objectScenarioId: context.objectRef.scenarioId,
      lens: state.lens,
      publishedSemanticVersionId: context.ontologyVersionId,
      bindingId: context.bindingId,
      scenarioContext: clone(resource.scenarioContext),
      context
    };
    closeDrawer();
    if (global.parent !== global) {
      if (s005Envelope) global.parent.postMessage(s005Envelope, global.location.origin);
      global.parent.postMessage(envelope, global.location.origin);
    } else {
      global.dispatchEvent(new CustomEvent("m07:handoff", { detail: envelope }));
      toast(`已形成前往${target.label}的上下文`, "success");
    }
  }

  function applyM08Return(payload) {
    if (!resource || !state) {
      pendingM08Return = clone(payload);
      return;
    }
    const envelope = payload?.resultEnvelope;
    const manifest = payload?.inputManifest || {};
    if (!envelope?.resultId || !["PREDICTION", "SIMULATION"].includes(envelope.resultKind)) return;
    if (envelope.factWriteAllowed !== false || envelope.actionWriteAllowed !== false || envelope.sideEffectsEmitted !== 0) return;
    const item = resolveObject(manifest.objectRef || envelope.subjectRefs?.[0]);
    if (!item) return;
    const lens = LENSES.some((entry) => entry.id === manifest.lensRef?.lensId) ? manifest.lensRef.lensId : state.lens;
    returnedModelResult = clone(payload);
    const selectedIds = state.selectedIds.includes(item.id) ? state.selectedIds : [item.id, ...state.selectedIds];
    state = {
      ...state,
      route: "explore",
      lens,
      activeId: item.id,
      previewId: item.id,
      selectedIds,
      timeRange: normalizeDateRange(manifest.timeRange || state.timeRange)
    };
    updateUrl("replace");
    render();
    rememberObject(item);
    emitWorkspaceContextUpdate();
    toast("模型结果已带回当前探索", "success");
  }

  function resetDiscoveryFilters() {
    state = { ...state, search: "", typeFilter: "all", quality: "all" };
    updateUrl("replace");
    renderDiscover();
    refreshIcons();
    emitWorkspaceContextUpdate();
    objectSearch.focus();
  }

  function handleBrushInput(input, commit = false) {
    const dates = allTimelineDates();
    const startInput = document.querySelector('[data-brush="start"]');
    const endInput = document.querySelector('[data-brush="end"]');
    if (!startInput || !endInput || !dates.length) return;
    let startIndex = Number(startInput.value);
    let endIndex = Number(endInput.value);
    if (input.dataset.brush === "start" && startIndex > endIndex) {
      startIndex = endIndex;
      startInput.value = String(startIndex);
    }
    if (input.dataset.brush === "end" && endIndex < startIndex) {
      endIndex = startIndex;
      endInput.value = String(endIndex);
    }
    const max = Math.max(1, dates.length - 1);
    state.timeRange = normalizeDateRange({ start: dates[startIndex], end: dates[endIndex] });
    const brush = document.querySelector(".time-brush");
    brush?.style.setProperty("--brush-start", `${startIndex / max * 100}%`);
    brush?.style.setProperty("--brush-end", `${endIndex / max * 100}%`);
    const label = document.getElementById("brush-range-label");
    if (label) label.textContent = `${formatDate(state.timeRange.start)} — ${formatDate(state.timeRange.end)}`;
    const startDate = document.getElementById("context-time-start");
    const endDate = document.getElementById("context-time-end");
    if (startDate) startDate.value = state.timeRange.start;
    if (endDate) endDate.value = state.timeRange.end;
    if (commit) {
      updateUrl("replace");
      render();
      emitWorkspaceContextUpdate();
    }
  }

  function toggleGraphExpansion(objectId) {
    const item = resolveObject(objectId);
    if (!item) return;
    const rootId = state.graphExpanded[0] || state.activeId;
    const next = new Set(state.graphExpanded);
    if (next.has(item.id) && item.id !== rootId) next.delete(item.id);
    else next.add(item.id);
    setState({ graphExpanded: [rootId, ...[...next].filter((id) => id !== rootId)] }, { history: "replace", emit: false });
  }

  async function copyText(value, message = "已复制") {
    try {
      await navigator.clipboard.writeText(value);
    } catch (_) {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    toast(message, "success");
  }

  function handleDocumentClick(event) {
    const close = event.target.closest("[data-close-drawer], [data-close-mobile]");
    if (close) { closeDrawer(); return; }

    const routeButton = event.target.closest("button[data-route]");
    if (routeButton) { transitionRoute(routeButton.dataset.route); closeDrawer(); return; }

    if (event.target.closest("#copy-link")) { void copyText(global.location.href, "当前探索链接已复制"); return; }
    if (event.target.closest("#save-exploration")) { openSaveDialog(); return; }
    if (event.target.closest("#continue-analysis")) { openContinueDrawer(); return; }

    const moduleTarget = event.target.closest("[data-navigate-module]");
    if (moduleTarget) { navigateParentModule(moduleTarget.dataset.navigateModule); return; }

    const mobileTarget = event.target.closest("[data-open-mobile]");
    if (mobileTarget) { openMobilePane(mobileTarget.dataset.openMobile); return; }

    const typeButton = event.target.closest("[data-type]");
    if (typeButton) { setState({ typeFilter: typeButton.dataset.type }, { history: "replace" }); return; }

    const qualityButton = event.target.closest("[data-quality]");
    if (qualityButton) { setState({ quality: qualityButton.dataset.quality }, { history: "replace" }); return; }

    if (event.target.closest("#clear-filters") || event.target.closest("[data-reset-discovery]")) { resetDiscoveryFilters(); return; }
    if (event.target.closest("#clear-search")) { setState({ search: "" }, { history: "replace", emit: false }); objectSearch.focus(); return; }
    if (event.target.closest("#clear-selection")) { setState({ selectedIds: [] }, { history: "replace" }); return; }
    if (event.target.closest("#explore-selection")) { transitionRoute("explore"); return; }

    const openSaved = event.target.closest("[data-open-saved]");
    if (openSaved) { openSavedExploration(openSaved.dataset.openSaved); return; }
    const deleteSaved = event.target.closest("[data-delete-saved]");
    if (deleteSaved) {
      persistSaved(loadSaved().filter((item) => item.id !== deleteSaved.dataset.deleteSaved));
      renderSavedExplorations();
      refreshIcons(savedList);
      toast("保存记录已删除", "success");
      return;
    }

    const copyValue = event.target.closest("[data-copy-value]");
    if (copyValue) { void copyText(copyValue.dataset.copyValue, "证据引用已复制"); return; }

    const toggleTarget = event.target.closest("[data-toggle-object]");
    if (toggleTarget) { toggleObject(toggleTarget.dataset.toggleObject); return; }

    const openObjectButton = event.target.closest("[data-open-object]");
    if (openObjectButton) { openObject(openObjectButton.dataset.openObject); return; }

    const graphExpand = event.target.closest("[data-graph-expand]");
    if (graphExpand) { event.stopPropagation(); toggleGraphExpansion(graphExpand.dataset.graphExpand); return; }

    const graphSelect = event.target.closest("[data-graph-select]");
    if (graphSelect) { setActiveObject(graphSelect.dataset.graphSelect, { keepGraphRoot: true, history: "replace" }); return; }

    const openLensButton = event.target.closest("[data-open-lens]");
    if (openLensButton) {
      const objectTarget = openLensButton.dataset.setActive;
      if (objectTarget) {
        const item = resolveObject(objectTarget);
        const patch = { activeId: item?.id || state.activeId, previewId: item?.id || state.previewId, route: "explore", lens: openLensButton.dataset.openLens };
        if (patch.lens === "graph") { patch.graphExpanded = [patch.activeId]; patch.graphSelectedId = patch.activeId; }
        setState(patch, { history: "push" });
      } else openLens(openLensButton.dataset.openLens);
      return;
    }

    const lensButton = event.target.closest("[data-lens]");
    if (lensButton) { openLens(lensButton.dataset.lens); return; }

    const objectTab = event.target.closest("[data-object-tab]");
    if (objectTab) { setState({ objectTab: objectTab.dataset.objectTab }, { history: "replace", emit: false }); return; }

    if (event.target.closest("[data-expand-all]")) {
      const graph = graphProjection();
      setState({ graphExpanded: [...new Set([...state.graphExpanded, ...graph.nodes.map((entry) => entry.item.id)])] }, { history: "replace", emit: false });
      return;
    }
    if (event.target.closest("[data-reset-graph]")) {
      setState({ graphExpanded: [state.activeId], graphSelectedId: state.activeId }, { history: "replace", emit: false });
      return;
    }

    if (event.target.closest("[data-reset-time]")) {
      setState({ timeRange: normalizeDateRange(resource.source.dateRange) }, { history: "replace" });
      return;
    }

    const compareChart = event.target.closest("[data-compare-chart]");
    if (compareChart) { setState({ compareChart: compareChart.dataset.compareChart }, { history: "replace", emit: false }); return; }

    const mapZoom = event.target.closest("[data-map-zoom]");
    if (mapZoom) {
      const factor = mapZoom.dataset.mapZoom === "in" ? 1.18 : .85;
      setState({ mapZoom: Math.min(2.2, Math.max(.8, state.mapZoom * factor)) }, { history: "replace", emit: false });
      return;
    }

    if (event.target.closest("[data-clear-path-search]")) {
      state.pathSearch = "";
      renderPathPane();
      refreshIcons(pathPane);
      document.getElementById("path-search")?.focus();
      return;
    }

    const setActive = event.target.closest("[data-set-active]");
    if (setActive?.dataset.setActive) {
      const keepGraphRoot = Boolean(setActive.closest(".graph-lens"));
      setActiveObject(setActive.dataset.setActive, { keepGraphRoot, history: "replace" });
      return;
    }

    const previewTarget = event.target.closest("[data-preview-object]");
    if (previewTarget && !event.target.closest("button, label, input")) {
      const item = resolveObject(previewTarget.dataset.previewObject);
      if (item) setState({ previewId: item.id }, { history: "replace", emit: false });
    }
  }

  function handleDocumentChange(event) {
    const target = event.target;
    if (target.matches("[data-select-object]")) { toggleObject(target.dataset.selectObject, target.checked); return; }
    if (target.matches("[data-select-all]")) {
      const visibleIds = filteredObjects().map((item) => item.id);
      const next = new Set(state.selectedIds);
      visibleIds.forEach((id) => target.checked ? next.add(id) : next.delete(id));
      setState({ selectedIds: [...next] }, { history: "replace" });
      return;
    }
    if (target.id === "context-time-start" || target.id === "context-time-end") {
      const start = document.getElementById("context-time-start")?.value || state.timeRange.start;
      const end = document.getElementById("context-time-end")?.value || state.timeRange.end;
      setState({ timeRange: normalizeDateRange({ start, end }) }, { history: "replace" });
      return;
    }
    if (target.matches("[data-brush]")) { handleBrushInput(target, true); return; }
    if (target.matches("[data-series-toggle]")) {
      const next = new Set(state.timelineSeriesIds);
      if (target.checked && next.size >= 4 && !next.has(target.dataset.seriesToggle)) {
        target.checked = false;
        toast("最多同时展示 4 条序列", "warning");
        return;
      }
      if (target.checked) next.add(target.dataset.seriesToggle);
      else next.delete(target.dataset.seriesToggle);
      setState({ timelineSeriesIds: [...next] }, { history: "replace", emit: false });
      return;
    }
    if (target.id === "compare-metric") { setState({ compareMetric: target.value }, { history: "replace", emit: false }); return; }
    if (target.matches("[data-map-links]")) { setState({ mapLinks: target.checked }, { history: "replace", emit: false }); }
  }

  function handleDocumentInput(event) {
    const target = event.target;
    if (target.id === "object-search") {
      state.search = target.value;
      updateUrl("replace");
      renderDiscover();
      refreshIcons();
      emitWorkspaceContextUpdate();
      return;
    }
    if (target.id === "path-search") {
      state.pathSearch = target.value;
      const position = target.selectionStart;
      renderPathPane();
      refreshIcons(pathPane);
      const next = document.getElementById("path-search");
      next?.focus();
      next?.setSelectionRange(position, position);
      return;
    }
    if (target.matches("[data-brush]")) handleBrushInput(target, false);
  }

  function handleKeyboard(event) {
    if (event.key === "Escape") {
      closeDrawer();
      if (saveDialog.open) saveDialog.close();
      return;
    }
    if (event.key === "/" && state.route === "discover" && !event.target.matches("input, textarea, select")) {
      event.preventDefault();
      objectSearch.focus();
    }
    const graphNode = event.target.closest?.("[data-graph-select]");
    if (graphNode && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      setActiveObject(graphNode.dataset.graphSelect, { keepGraphRoot: true });
    }
  }

  function handleNavigation() {
    if (!resource) return;
    const next = readStateFromUrl();
    state = { ...state, ...next };
    render();
  }

  function handleHostMessage(event) {
    if (event.origin !== global.location.origin || event.source !== global.parent) return;
    const message = event.data || {};
    if (message.type === "OFW_WORKSPACE_CONTEXT") {
      applyWorkspaceContext(message.context);
      return;
    }
    if (message.type === "OFW_M08_RETURN_TO_M07" && (!message.targetModuleId || message.targetModuleId === MODULE_ID)) {
      applyM08Return(message.payload || {});
    }
  }

  function bindEvents() {
    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("change", handleDocumentChange);
    document.addEventListener("input", handleDocumentInput);
    document.addEventListener("keydown", handleKeyboard);
    scrim.addEventListener("click", closeDrawer);
    saveForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (event.submitter?.value === "cancel") saveDialog.close();
      else saveExploration();
    });
    global.addEventListener("popstate", handleNavigation);
    global.addEventListener("hashchange", () => {
      if (currentRoute() !== state.route) handleNavigation();
    });
  }

  function fatal(error) {
    const diagnosticId = `M07-LOAD-${Date.now().toString(36).toUpperCase()}`;
    app.innerHTML = `<section class="fatal-state"><span>${icon("circle-x")}</span><h1>业务对象资源加载失败</h1><p>请确认本地服务与资源路径可用后重试。</p><code>${escapeHtml(diagnosticId)}</code><button class="button primary" type="button" onclick="location.reload()">${icon("refresh-cw")}<span>重新加载</span></button></section>`;
    refreshIcons();
    console.error(`[${diagnosticId}]`, error);
  }

  function validateResource(data) {
    if (data?.schemaVersion !== "ofw.m07.validation-resource.v1") throw new Error("M07 资源 schema 不匹配");
    if (!Array.isArray(data.objects) || !Array.isArray(data.links) || !Array.isArray(data.series) || !Array.isArray(data.events)) throw new Error("M07 资源集合不完整");
    if (!data.scenarioContext || !data.ontologyContext || !data.source?.dateRange) throw new Error("M07 资源上下文不完整");
  }

  function readyScenarioContext() {
    return Object.fromEntries(["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"].map((key) => [key, resource.scenarioContext[key]]));
  }

  async function start() {
    try {
      const params = new URLSearchParams(global.location.search);
      const resourcePath = params.get("resource") || "resources/portfolio.json";
      const response = await fetch(resourcePath, { cache: "no-store" });
      if (!response.ok) throw new Error(`资源 HTTP ${response.status}`);
      const data = await response.json();
      validateResource(data);
      resource = data;
      indexes = buildIndexes(resource);
      state = readStateFromUrl();
      bindEvents();
      if (pendingWorkspaceContext) {
        const context = pendingWorkspaceContext;
        pendingWorkspaceContext = null;
        applyWorkspaceContext(context);
      } else {
        updateUrl("replace");
        render();
      }
      if (pendingM08Return) {
        const payload = pendingM08Return;
        pendingM08Return = null;
        applyM08Return(payload);
      }
      global.__OFW_M07_DEBUG__ = {
        getState: () => clone(state),
        getContext: () => clone(workspaceContextPatch()),
        getResourceCounts: () => ({ objects: resource.objects.length, links: resource.links.length, series: resource.series.length, events: resource.events.length }),
        openLens,
        openObject
      };
      if (global.parent !== global) {
        global.parent.postMessage({ type: "OFW_M07_READY", moduleId: MODULE_ID, scenarioContext: readyScenarioContext() }, global.location.origin);
        emitWorkspaceContextUpdate();
      }
    } catch (error) {
      fatal(error);
    }
  }

  global.addEventListener("message", handleHostMessage);
  start();
}(window));
