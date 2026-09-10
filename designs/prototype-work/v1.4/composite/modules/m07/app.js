(function mountBusinessObjectExplorer(global) {
  "use strict";

  const MODULE_ID = "m07";
  const MODULE_ROUTE = "#module/m07";
  const HANDOFF_CHANNEL = "ofw.m07.prototype.handoff.v1";
  const STORAGE_KEY = "ofw.m07.v1.4.saved-explorations";
  const RECENT_KEY = "ofw.m07.v1.4.recent-objects";
  const numeric = (value) => global.OFW_WORKFLOW.number(value) !== null;
  const ROUTES = new Set(["discover", "explore"]);
  const PRESERVED_QUERY_KEYS = [
    "embedded", "resource", "scenarioId", "scenarioVersion", "scenarioRunId",
    "formedAt", "status", "contextCreatedAt", "contextStatus",
    "scenarioFormedAt", "scenarioStatus", "v"
  ];

  const LENSES = Object.freeze([
    { id: "collection", label: "业务记录", short: "汇总与关联记录", icon: "table-properties" },
    { id: "overview", label: "业务全景", short: "情况、判断与行动", icon: "panels-top-left" },
    { id: "catalog", label: "对象目录", short: "结果表", icon: "table-properties" },
    { id: "object360", label: "对象全貌", short: "业务明细", icon: "scan-face" },
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
    enterpriseId: "企业主身份", sourceUnitName: "融资来源名称", financingCoverage: "融资数据覆盖", mapLocation: "演示位置", identityBasis: "身份依据",
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
    scopeStatus: "投资范围适配", reviewPriority: "复核优先级", reviewStatus: "复核状态", riskScore: "风险评分",
    riskTier: "风险分档", ruleCode: "规则编号", ruleId: "规则引用", ruleMetricLabel: "规则指标",
    ruleMetricValue: "规则指标值", ruleName: "规则名称", scenario: "业务域",
    seedReportId: "来源报告", selectionStatus: "选择状态", shortTermDebtRatio: "短期债务占比",
    snapshotCount: "快照数", sourceCode: "来源编码", sourceObjectId: "对象定义", sector: "所属板块", year: "预算年度", period: "预算期间", asOf: "数据截至", account: "预算科目", category: "产品类别", actualRevenue: "实际收入", costToRevenue: "成本占收比", loanId: "借据编号", balanceYuan: "借据余额", rate: "当前利率", guaranteeType: "担保方式", value: "当前市值", price: "现价", cost: "投资金额", pnl: "浮动盈亏",
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
  let decisionSeed = { requests: [], tasks: [] };
  let provinceGeometry = null;
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

  function displayUnit(unit) { return ({ score_0_100: "分", pct: "%", risk_tier: "", ratio: "比例" })[unit] ?? unit ?? ""; }

  function formatValue(property, precision = 2) {
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
    const value = typeof property.value === "number" ? formatNumber(property.value, precision) : String(property.value);
    const unit = ({ score_0_100: "分", ratio: "比例", risk_tier: "", pct: "%" })[property.unit] ?? property.unit;
    return `${value}${unit ? ` ${unit}` : ""}`;
  }

  function presentationType(item) { return item?.presentationTypeId || item?.objectTypeId; }

  function objectGeometry(item) { return item?.location?.geometry || item?.properties?.geometry?.value; }

  function typeMeta(objectOrType) {
    const id = typeof objectOrType === "string" ? objectOrType : objectOrType?.objectTypeId;
    return resource?.typeMetadata?.[id] || TYPE_META[id] || { label: id?.split(".").at(-1) || "业务对象", group: "其他对象", icon: "box", color: "#607386" };
  }

  function qualityMeta(value) {
    return QUALITY[value] || QUALITY.warning;
  }

  function propertyEntries(item) {
    return global.OFW_M07_BUSINESS.entries(item);
  }

  function propertyLabel(key) {
    return PROPERTY_LABELS[key] || key.replace(/([a-z])([A-Z])/g, "$1 $2");
  }

  function propertyValue(item, key) {
    return item?.properties?.[key]?.value;
  }

  function linkLabel(link, fromId = null) {
    if (fromId && link.to === fromId && link.reverseLabel) return link.reverseLabel;
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
      (item.aliases || []).forEach((alias) => byCanonicalId.set(alias, item));
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
      return indexes.byId.get(value.id) || indexes.byCanonicalId.get(global.OFW_WORKFLOW.canonicalId(value.id)) || null;
    }
    return indexes.byId.get(value) || indexes.byCanonicalId.get(global.OFW_WORKFLOW.canonicalId(value)) || null;
  }

  function activeObject() {
    return resolveObject(state?.activeId) || null;
  }

  function canonicalObjectRef(item = activeObject()) {
    if (!item) return null;
    if (item.bindingId && resource.typeMetadata) {
      const scenarioId = item.sourceFacets?.[state?.businessScenario] || item.budgetOwnership && state?.businessScenario === "S002" ? state.businessScenario : item.scenarioId;
      return { ...clone(item.canonicalObjectRef), scenarioId };
    }
    const fallbackResource = resource.portfolioResources?.find((entry) => entry.scenarioId === item.scenarioId) || {};
    const sourceRef = item.sourceFacets?.[state?.businessScenario]?.canonicalObjectRef || item.canonicalObjectRef;
    return {
      id: item.canonicalObjectRef?.id || item.objectRef?.id || item.id,
      title: item.canonicalObjectRef?.title || item.title,
      objectTypeRef: item.canonicalObjectRef?.objectTypeRef || item.objectRef?.objectTypeRef || item.objectTypeId,
      scenarioId: sourceRef?.scenarioId || item.objectRef?.scenarioId || item.scenarioId,
      dataVersionId: sourceRef?.dataVersionId || fallbackResource.dataVersionId || null,
      ontologyVersionId: sourceRef?.ontologyVersionId || fallbackResource.ontologyVersionId || null,
      bindingId: sourceRef?.bindingId || fallbackResource.bindingId || null,
      ...(item.enterpriseId ? { enterpriseId: item.enterpriseId, sourceObjectId: sourceRef?.sourceObjectId || sourceRef?.id, identityVersionId: resource.identityVersionId } : {})
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
    if (state.lens === "collection") {
      const collection = resource.collections?.find(item => item.id === state.collectionId);
      if (collection) return collection.memberIds.map(resolveObject).filter(Boolean);
    }
    const selected = selectedObjects();
    return state.selectedIds.length ? selected : filteredObjects();
  }

  function searchableText(item) {
    const properties = propertyEntries(item).flatMap(([key, property]) => [key, propertyLabel(key), formatValue(property)]);
    return [item.id, item.title, ...(item.aliasNames || []), ...(item.aliases || []), item.subtitle, ...(item.roles || []).map(role => ({ DEBT_RISK_SUBJECT: "债务风险", FINANCING_SUBJECT: "融资", BUDGET_OWNER: "预算", LOAN_APPLICANT: "借款申请人" })[role] || role), typeMeta(item).label, typeMeta(item).group, item.canonicalObjectRef?.id, ...properties]
      .filter(Boolean).join(" ").toLocaleLowerCase("zh-CN");
  }

  function filteredObjects() {
    if (state.selectedIds.some((id) => !resolveObject(id))) return [];
    const query = state.search.trim().toLocaleLowerCase("zh-CN");
    return global.OFW_M07_BUSINESS.directory(resource)
      .filter((item) => state.typeFilter === "all" || item.objectTypeId === state.typeFilter || state.typeFilter === "m01.object-type.financing-entity" && item.roles?.includes("FINANCING_SUBJECT"))

      .filter((item) => !query || searchableText(item).includes(query))
      .sort((left, right) => {
        if (query) {
          const rank = (item) => [item.title, ...(item.aliasNames || [])].some((name) => name.toLocaleLowerCase("zh-CN") === query) ? 0 : item.title.toLocaleLowerCase("zh-CN").startsWith(query) ? 1 : 2;
          if (rank(left) !== rank(right)) return rank(left) - rank(right);
        }
        const qualityOrder = { blocked: 0, warning: 1, passed: 2 };
        const qualityDelta = qualityOrder[left.quality] - qualityOrder[right.quality];
        return left.title.localeCompare(right.title, "zh-CN");
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
    const legacyView = resource.legacyViews?.[params.get("object")];
    const preferred = requestedObject || resolveObject(legacyView?.activeId) || recent || resolveObject("ENT-020") || resource.objects[0];
    const requestedSet = parseCsv(params.get("set")).flatMap(id => resolveObject(id) ? [resolveObject(id).id] : resource.legacyViews?.[id] ? [] : [id]);
    const range = normalizeDateRange({ start: params.get("from"), end: params.get("to") });
    const requestedLens = params.get("lens");
    return {
      route: currentRoute(),
      businessScenario: legacyView?.businessScenario || params.get("businessScenario") || "S003",
      lens: legacyView?.collectionId ? "collection" : LENSES.some((item) => item.id === requestedLens) ? requestedLens : "overview",
      collectionId: params.get("collection") || legacyView?.collectionId || null,
      collectionPage: 0,
      search: params.get("q") || "",
      typeFilter: resource.typeMetadata?.[params.get("type")] ? params.get("type") : "all",
      quality: "all",
      selectedIds: [...new Set(requestedSet)],
      activeId: preferred?.id || null,
      previewId: preferred?.id || null,
      timeRange: range,
      objectTab: ["properties", "relations", "events", "evidence"].includes(params.get("tab")) ? params.get("tab") : "properties",
      graphExpanded: [...new Set(parseCsv(params.get("expanded")).map(resolveObject).filter(Boolean).map((item) => item.id))],
      graphSelectedId: resolveObject(params.get("graphSelected"))?.id || preferred?.id || null,
      graphTransform: { x: Number(params.get("graphX")) || 0, y: Number(params.get("graphY")) || 0, k: Math.min(3, Math.max(.5, Number(params.get("graphScale")) || 1)) },
      timelineSeriesIds: parseCsv(params.get("series")),
      compareChart: ["bar", "dot", "radar"].includes(params.get("chart")) ? params.get("chart") : "bar",
      compareMetric: params.get("metric") || null,
      compareLimit: [8, 16, 1000].includes(Number(params.get("limit"))) ? Number(params.get("limit")) : 8,
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
    if (nextState.collectionId) params.set("collection", nextState.collectionId);
    if (nextState.search) params.set("q", nextState.search);
    if (nextState.businessScenario) params.set("businessScenario", nextState.businessScenario);
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
    if (nextState.graphTransform?.k !== 1 || nextState.graphTransform?.x || nextState.graphTransform?.y) {
      params.set("graphX", String(Math.round(nextState.graphTransform?.x || 0)));
      params.set("graphY", String(Math.round(nextState.graphTransform?.y || 0)));
      params.set("graphScale", String(nextState.graphTransform?.k || 1));
    }
    if (nextState.timelineSeriesIds.length) params.set("series", nextState.timelineSeriesIds.join(","));
    if (nextState.compareChart !== "bar") params.set("chart", nextState.compareChart);
    if (nextState.compareMetric) params.set("metric", nextState.compareMetric);
    if (nextState.compareLimit !== 8) params.set("limit", String(nextState.compareLimit));
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
    const collection = state.lens === "collection" ? resource.collections?.find(item => item.id === state.collectionId) : null;
    const explicit = state.selectedIds.length > 0 || Boolean(collection);
    return {
      id: `object-set:m07:${hashString(signature || "empty")}`,
      title: collection?.title || (state.selectedIds.length ? `已选 ${objects.length} 个对象` : `当前结果 ${objects.length} 个对象`),
      count: objects.length,
      selectionMode: explicit ? "EXPLICIT" : "FILTERED",
      filters: explicit ? null : {
        query: state.search || "",
        objectTypeId: state.typeFilter,
        quality: state.quality
      },
      objectIds: canonicalRefs.map((item) => item.id),
      objectRefs: canonicalRefs
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
    const explicitSet = context.objectSetRef?.selectionMode === "EXPLICIT" || context.objectSetRef?.explicit === true || (!context.objectSetRef?.selectionMode && objectIds.length > 0);
    const selectedIds = explicitSet ? objectIds.map((id) => resolveObject(id)?.id || id) : [];
    const active = resolveObject(context.activeObjectRef || context.objectRef);
    const lensId = context.lensRef?.lensId || context.lens;
    const patch = {};
    if (context.scenarioId && active?.sourceFacets?.[context.scenarioId]) patch.businessScenario = context.scenarioId;
    if (explicitSet) Object.assign(patch, { selectedIds: [...new Set(selectedIds)], route: selectedIds.some((id) => !resolveObject(id)) ? "discover" : "explore", activeId: active?.id || selectedIds.map(resolveObject).find(Boolean)?.id || null });
    if (!explicitSet && context.objectSetRef?.selectionMode === "FILTERED") {
      const filters = context.objectSetRef.filters || {};
      patch.selectedIds = [];
      if (typeof filters.query === "string") patch.search = filters.query;
      if (filters.objectTypeId === "all" || TYPE_META[filters.objectTypeId]) patch.typeFilter = filters.objectTypeId;
      if (["all", ...Object.keys(QUALITY)].includes(filters.quality)) patch.quality = filters.quality;
    }
    if (!context.objectSetRef && context.activeObjectRef === null) Object.assign(patch, { selectedIds: [], search: "", typeFilter: "all", quality: "all", route: "discover" });
    if (active) patch.activeId = active.id;
    if (!active && context.activeObjectRef?.id) toast(`未找到对象“${context.activeObjectRef.title || context.activeObjectRef.id}”`, "warning");
    if (context.timeRange) patch.timeRange = normalizeDateRange(context.timeRange);
    if (LENSES.some((item) => item.id === lensId)) patch.lens = lensId;
    const explicitlyExploring = context.route === "#explore" || context.lensRef?.route === "#explore" || LENSES.some((item) => item.id === lensId);
    if (active || explicitlyExploring) patch.route = "explore";
    if (selectedIds.some((id) => !resolveObject(id))) patch.route = "discover";
    const departmentSet = selectedIds.map(resolveObject);
    if ((!active || context.objectSetRef?.id?.startsWith("query-run:") || context.sourceModuleId === "query") && departmentSet.length && departmentSet.every(item => item?.objectTypeId === "OBJ-ENTERPRISE-DEPARTMENT") && new Set(departmentSet.map(item => item.parentEnterpriseId)).size === 1) {
      Object.assign(patch, { route: "explore", lens: "overview", activeId: departmentSet[0].parentEnterpriseId, businessScenario: "S002", collectionId: null });
    }
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
    toastRegion.replaceChildren(node);
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
    global.__OFW_REFRESH_LAYOUT__?.();
  }

  function renderDiscover() {
    const filtered = filteredObjects();
    document.getElementById("stat-objects").textContent = formatNumber(global.OFW_M07_BUSINESS.directory(resource).length, 0);
    document.getElementById("stat-links").textContent = resource.objects.filter(o => o.objectTypeId === "OBJ-ENTERPRISE-DEPARTMENT").length;
    document.getElementById("stat-series").textContent = resource.objects.filter(o => o.objectTypeId === "OBJ-INVESTMENT-PRODUCT").length;
    objectSearch.value = state.search;
    qualityFilter.querySelectorAll("[data-quality]").forEach((button) => button.classList.toggle("active", button.dataset.quality === state.quality));
    renderTypeFacets();
    typeFacets.insertAdjacentHTML("beforeend", `<section class="facet-group"><h3>常用业务</h3><button class="facet-button" data-open-object="ENT-020">${escapeHtml(resolveObject(resource.budgetOwnership.enterpriseId)?.title)} · 企业预算</button><button class="facet-button" data-open-collection="group-finance">集团融资总览</button><button class="facet-button" data-open-collection="investment-analysis">投资产品分析集</button></section>`);
    renderSavedExplorations();
    renderDiscoveryResults(filtered);
    renderPreview();
    const type = state.typeFilter === "all" ? null : typeMeta(state.typeFilter);
    document.getElementById("result-title").textContent = state.search ? `“${state.search}”的搜索结果` : type?.label || "全部对象";
    if (state.selectedIds.some((id) => !resolveObject(id))) document.getElementById("result-title").textContent = "这组查询结果暂不支持对象视图，请返回问数继续分析。";
    document.getElementById("result-count").textContent = `${filtered.length} 个结果`;
    const selectedCount = state.selectedIds.length;
    document.getElementById("selection-summary").textContent = selectedCount ? `已选择 ${selectedCount} 个对象` : `将探索当前 ${filtered.length} 个结果`;
    document.getElementById("clear-selection").hidden = !selectedCount;
    document.getElementById("explore-selection").disabled = (!filtered.length && !selectedCount) || state.selectedIds.some((id) => !resolveObject(id));
  }

  function renderTypeFacets() {
    const counts = new Map();
    global.OFW_M07_BUSINESS.directory(resource).forEach((item) => counts.set(item.objectTypeId, (counts.get(item.objectTypeId) || 0) + 1));
    const groups = new Map();
    [...counts.keys()].forEach((typeId) => {
      const meta = typeMeta(typeId);
      if (!groups.has(meta.group)) groups.set(meta.group, []);
      groups.get(meta.group).push({ typeId, ...meta, count: counts.get(typeId) });
    });
    const groupOrder = ["融资管理", "预算监督", "债务风险", "贷前评估", "投后评价", "分析交付", "其他对象"];
    typeFacets.innerHTML = `<button class="facet-button all ${state.typeFilter === "all" ? "active" : ""}" type="button" data-type="all"><span>${icon("boxes")}<strong>全部对象</strong></span><b>${global.OFW_M07_BUSINESS.directory(resource).length}</b></button>${[...groups.entries()]
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
    if (presentationType(item) === "m01.object-type.investment-holding") { const latest = latestSeriesSummary(item); if (latest) return latest; }
    const preferred = ["riskScore", "averageFinancingCost", "executionRate", "balance", "financingBalance", "weightedAverageCost", "debtRatio", "categoryLevel2"];
    const key = preferred.find(candidate => propertyEntries(item).some(([key]) => key === candidate));
    if (key) return { label: propertyLabel(key), value: formatValue(item.properties[key]) };
    const first = propertyEntries(item).find(([, property]) => property.value != null && typeof property.value !== "object");
    return first ? { label: propertyLabel(first[0]), value: formatValue(first[1]) } : { label: "关联业务", value: `${objectLinks(item).length} 项` };
  }

  function renderDiscoveryResults(items) {
    if (!items.length) {
      discoveryResults.innerHTML = `<div class="empty-state"><span>${icon("search-x")}</span><h2>没有匹配的对象</h2><p>调整搜索词或清除筛选后继续查找。</p><button class="button primary" type="button" data-reset-discovery>清除筛选</button></div>`;
      return;
    }
    const selected = new Set(state.selectedIds);
    const allSelected = items.every((item) => selected.has(item.id));
    const table = `<div class="result-table-wrap"><table class="result-table"><thead><tr><th class="check-cell"><label class="check-control"><input type="checkbox" data-select-all ${allSelected ? "checked" : ""}><span></span></label></th><th>业务对象</th><th>对象类型</th><th>关键值</th><th>业务状态</th><th>关系</th><th>数据截至</th><th></th></tr></thead><tbody>${items.map((item) => {
      const metric = primaryMetric(item);
      const links = objectLinks(item).length;
      const asOf = businessAsOf(item);
      return `<tr class="${state.previewId === item.id ? "previewing" : ""}" data-preview-object="${escapeHtml(item.id)}"><td class="check-cell"><label class="check-control"><input type="checkbox" data-select-object="${escapeHtml(item.id)}" ${selected.has(item.id) ? "checked" : ""}><span></span></label></td><td><div class="object-cell">${objectGlyph(item, "small")}<div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.subtitle || item.canonicalObjectRef?.id || item.id)}</small></div></div></td><td><span class="type-label">${escapeHtml(typeMeta(item).label)}</span></td><td><div class="metric-cell"><strong>${escapeHtml(metric.value)}</strong><small>${escapeHtml(metric.label)}</small></div></td><td>${businessChip(item)}</td><td>${links}</td><td>${escapeHtml(formatDate(asOf))}</td><td><button class="row-arrow" type="button" data-open-object="${escapeHtml(item.id)}" aria-label="打开${escapeHtml(item.title)}">${icon("arrow-right")}</button></td></tr>`;
    }).join("")}</tbody></table></div>`;
    const cards = `<div class="result-cards">${items.map((item) => {
      const metric = primaryMetric(item);
      return `<article class="result-card ${state.previewId === item.id ? "previewing" : ""}" data-preview-object="${escapeHtml(item.id)}"><header><label class="check-control"><input type="checkbox" data-select-object="${escapeHtml(item.id)}" ${selected.has(item.id) ? "checked" : ""}><span></span></label>${objectGlyph(item, "small")}<div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(typeMeta(item).label)}</small></div>${businessChip(item)}</header><div class="mobile-metric"><span>${escapeHtml(metric.label)}</span><strong>${escapeHtml(metric.value)}</strong></div><button class="mobile-open" type="button" data-open-object="${escapeHtml(item.id)}">查看对象 ${icon("arrow-right")}</button></article>`;
    }).join("")}</div>`;
    discoveryResults.innerHTML = table + cards;
  }

  function keyProperties(item, limit = 5) {
    const preferred = ["riskScore", "riskTier", "averageFinancingCost", "balance", "executionRate", "budgetAmount", "actualAmount", "debtRatio", "categoryLevel2", "scopeStatus", "snapshotCount"];
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
    previewPane.innerHTML = `<div class="preview-scroll"><header class="preview-header"><div class="preview-icon">${objectGlyph(item, "large")}</div><span class="type-label">${escapeHtml(typeMeta(item).label)}</span><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.subtitle || "")}</p>${businessChip(item)}</header><section class="preview-metrics">${metrics.map(([key, property]) => `<div><span>${escapeHtml(propertyLabel(key))}</span><strong>${escapeHtml(formatValue(property))}</strong></div>`).join("") || `<div><span>对象标识</span><strong>${escapeHtml(item.canonicalObjectRef?.id || item.id)}</strong></div>`}</section><section class="preview-footprint"><div><strong>${links.length}</strong><span>关系</span></div><div><strong>${series.length}</strong><span>时序</span></div><div><strong>${currentEvidenceRefs(item).length}</strong><span>证据</span></div></section>${links.length ? `<section class="preview-relations"><h3>直接关系</h3>${links.slice(0, 4).map((link) => { const related = relatedObject(link, item.id); return related ? `<button type="button" data-preview-object="${escapeHtml(related.id)}"><span>${escapeHtml(linkLabel(link))}</span><strong>${escapeHtml(related.title)}</strong>${icon("chevron-right")}</button>` : ""; }).join("")}</section>` : ""}<footer class="preview-actions"><button class="button quiet" type="button" data-toggle-object="${escapeHtml(item.id)}">${state.selectedIds.includes(item.id) ? icon("check") + "已加入对象集" : icon("plus") + "加入对象集"}</button><button class="button primary" type="button" data-open-object="${escapeHtml(item.id)}">打开对象</button></footer></div>`;
  }

  function renderExplore() {
    ensureWorkspaceState();
    renderWorkspaceContext();
    renderLensNav();
    renderPathPane();
    renderCanvasHeader();
    renderCanvasStage();
    renderInspector();
    if (state.lens === "overview") inspectorPane.innerHTML = "";
  }

  function businessChip(item) {
    const label = global.OFW_M07_BUSINESS.status(item);
    return label ? `<span class="business-status ${["红灯", "黑灯"].includes(label) ? "risk-high" : ["黄灯", "预算超支"].includes(label) ? "risk-attention" : label === "绿灯" ? "risk-normal" : ""}">${escapeHtml(label)}</span>` : "";
  }

  function businessAsOf(item) {
    if (presentationType(item) === "m01.object-type.investment-holding") {
      const latest = objectSeries(item).flatMap(series => (series.points || []).filter(point => numeric(point.v)).map(point => point.t)).sort().at(-1);
      if (latest) return latest;
    }
    const dates = propertyEntries(item).map(([, p]) => comparisonPolicy().propertyDate(item, p)).filter(Boolean);
    return [...new Set(dates)].sort().join("、") || resource.portfolioResources?.find(r => r.scenarioId === item?.scenarioId)?.dataAsOf || "";
  }

  function businessPeers(item) {
    return resource.objects.filter(other => other.objectTypeId === item?.objectTypeId && (other.id === item.id || metricCandidates([item, other]).some(metric => metric.available === 2)));
  }

  function businessCapabilities(item) {
    return [
      ...(objectLinks(item).length ? ["graph"] : []),
      ...(objectSeries(item).some(series => new Set((series.points || []).filter(p => numeric(p.v)).map(p => p.t)).size > 1) ? ["temporal"] : []),
      ...(item?.location?.city && objectGeometry(item) ? ["spatial"] : []),
      ...(metricCandidates(businessPeers(item)).some(metric => metric.available >= 2) ? ["compare"] : [])
    ];
  }

  function businessRules(item) {
    const rules = (resource.businessRules || []).filter(rule => rule.ownerId === item.id);
    if (presentationType(item) === "m01.object-type.financing-rule-result") rules.unshift(item);
    return rules.map(rule => `<article class="business-finding"><strong>${escapeHtml(rule.title)}</strong><p>${escapeHtml(propertyValue(rule, "metricLabel"))}：${escapeHtml(formatValue(rule.properties.observedValue))}；判断条件 ${escapeHtml(propertyValue(rule, "condition"))}</p><small>按已发布规则形成 · 数据截至 ${escapeHtml(businessAsOf(rule))}</small></article>`).join("");
  }

  function businessRecords(item = activeObject()) {
    return global.OFW_M07_BUSINESS.records(item, decisionSeed, global.localStorage);
  }

  function visibleBusinessLinks(item) {
    return objectLinks(item).filter(link => !["OBJ-FINANCING-DETAIL", "OBJ-HOLDING-OBSERVATION", "OBJ-ENTERPRISE-BUDGET-DETAIL"].includes(relatedObject(link, item.id)?.objectTypeId));
  }

  function annualBudgets(enterpriseId, departmentId = null) {
    return resource.objects.filter(o => o.objectTypeId === "OBJ-ENTERPRISE-BUDGET-ANNUAL" && o.parentEnterpriseId === enterpriseId && (!departmentId || o.departmentId === departmentId));
  }

  function selectedBudgetAnnuals(enterpriseId) {
    const selection = selectedObjects().filter(o => o.objectTypeId === "OBJ-ENTERPRISE-DEPARTMENT" && o.parentEnterpriseId === enterpriseId);
    return annualBudgets(enterpriseId).filter(o => propertyValue(o, "year") === 2025 && (!selection.length || selection.some(d => d.id === o.departmentId)));
  }

  function budgetTable(items) {
    return `<div class="business-table-scroll budget-table-desktop"><table class="workspace-table"><thead><tr><th>责任部门 / 年度</th><th>费用预算（万元）</th><th>实际费用（万元）</th><th>执行率</th><th>成本占收比</th><th></th></tr></thead><tbody>${items.map(o => `<tr><td>${escapeHtml(o.title)}</td><td>${formatNumber(propertyValue(o, "budgetAmount"), 4)}</td><td>${formatNumber(propertyValue(o, "actualAmount"), 4)}</td><td>${formatNumber(propertyValue(o, "executionRate"))}%</td><td>${formatNumber(propertyValue(o, "costToRevenue"))}%</td><td><button class="button quiet" data-open-object="${escapeHtml(o.id)}">查看明细</button></td></tr>`).join("")}</tbody></table></div><div class="business-budget-cards">${items.map(o => `<article><h4>${escapeHtml(o.title)}</h4><dl><div><dt>费用预算（万元）</dt><dd>${formatNumber(propertyValue(o, "budgetAmount"), 4)}</dd></div><div><dt>实际费用（万元）</dt><dd>${formatNumber(propertyValue(o, "actualAmount"), 4)}</dd></div><div><dt>预算执行率</dt><dd>${formatNumber(propertyValue(o, "executionRate"))}%</dd></div><div><dt>成本占收比</dt><dd>${formatNumber(propertyValue(o, "costToRevenue"))}%</dd></div></dl><button class="button quiet full" data-open-object="${escapeHtml(o.id)}">查看部门预算明细</button></article>`).join("")}</div>`;
  }

  function renderBusinessDetails(item) {
    let html = "";
    const collection = resource.collections.find(c => c.id === `financing:${item.id}` || c.id === `financing:${propertyValue(item, "enterpriseId")}`);
    if (collection) html += `<section class="business-section"><header><h3>${item.objectTypeId === "OBJ-FINANCING-DETAIL" ? "同企业融资记录" : "融资借据"}</h3><span>${collection.memberIds.length} 笔</span></header><p>按原借据编号逐笔查看余额、利率、融资机构及来源时点。</p><button class="button primary" data-open-collection="${escapeHtml(collection.id)}">查看 ${collection.memberIds.length} 笔融资</button></section>`;
    if (item.budgetOwnership) {
      const departmentSelection = selectedObjects().filter(o => o.objectTypeId === "OBJ-ENTERPRISE-DEPARTMENT" && o.parentEnterpriseId === item.id);
      const annuals = selectedBudgetAnnuals(item.id);
      const budget = annuals.reduce((sum, o) => sum + propertyValue(o, "budgetAmount"), 0);
      const actual = annuals.reduce((sum, o) => sum + propertyValue(o, "actualAmount"), 0);
      const costPressure = annuals.filter(o => propertyValue(o, "actualAmount") > propertyValue(o, "actualRevenue")).map(o => resolveObject(o.departmentId)?.title).filter(Boolean);
      html += `<section id="enterprise-budget" class="business-section"><header><h3>企业预算 · 2025年${departmentSelection.length ? " · 所选部门" : ""}</h3><span>${annuals.length} 个责任部门</span></header><div class="business-metrics"><article><span>费用预算</span><strong>${formatNumber(budget, 4)} 万元</strong></article><article><span>实际费用</span><strong>${formatNumber(actual, 4)} 万元</strong></article><article><span>预算执行率</span><strong>${formatNumber(actual / budget * 100)}%</strong></article></div>${budgetTable(annuals)}<p>${costPressure.length ? `${escapeHtml(costPressure.join("、"))}本期费用高于收入，可继续查看部门收支和科目明细。` : ""}${departmentSelection.length ? "部门选择仅限定预算范围，融资与风险仍按企业口径展示。" : ""}预算数据沿用原预算模块口径，企业归属为本轮演示设置。</p><div class="business-tools"><button class="button quiet" data-budget-history="${item.id}">查看部门年度预算</button><button class="button primary" data-budget-report>将企业预算加入报告</button><button class="button quiet" data-budget-query>在问数中分析预算</button></div></section>`;
    }
    if (item.objectTypeId === "OBJ-ENTERPRISE-DEPARTMENT") html += `<section class="business-section"><header><h3>部门年度预算</h3></header>${budgetTable(annualBudgets(item.parentEnterpriseId, item.id))}<button class="button quiet" data-open-object="${escapeHtml(item.parentEnterpriseId)}">返回企业全景</button></section>`;
    if (item.objectTypeId === "OBJ-ENTERPRISE-BUDGET-ANNUAL") {
      const details = resource.objects.filter(o => o.objectTypeId === "OBJ-ENTERPRISE-BUDGET-DETAIL" && o.annualId === item.id);
      html += `<section class="business-section"><header><h3>科目与期间明细</h3><span>${details.length} 条</span></header><p>科目与季度沿用原预算模块的演示分配口径，汇总与年度记录一致。</p><button class="button primary" data-budget-details="${escapeHtml(item.id)}">查看科目期间明细</button><button class="button quiet" data-open-object="${escapeHtml(item.parentEnterpriseId)}">返回企业全景</button></section>`;
    }
    if (item.parentEnterpriseId && item.objectTypeId !== "OBJ-ENTERPRISE-DEPARTMENT" && item.objectTypeId !== "OBJ-ENTERPRISE-BUDGET-ANNUAL") html += `<section class="business-section"><button class="button quiet" data-open-object="${escapeHtml(item.parentEnterpriseId)}">返回所属企业</button></section>`;
    return html;
  }

  function openCollection(id) {
    const collection = resource.collections.find(c => c.id === id);
    if (!collection) return;
    setState({ route: "explore", lens: "collection", collectionId: id, collectionPage: 0 }, { history: "push" });
  }

  function renderCollectionLens() {
    const collection = resource.collections.find(c => c.id === state.collectionId);
    if (!collection) { canvasStage.innerHTML = emptyLens("table", "请选择业务记录范围", "从企业或产品下探相关记录。", "返回企业全景", "overview"); return; }
    const items = collection.memberIds.map(resolveObject).filter(Boolean);
    const pageSize = 12, pages = Math.max(1, Math.ceil(items.length / pageSize));
    state.collectionPage = Math.min(state.collectionPage || 0, pages - 1);
    const visible = items.slice(state.collectionPage * pageSize, (state.collectionPage + 1) * pageSize);
    const loans = visible[0]?.objectTypeId === "OBJ-FINANCING-DETAIL", details = visible[0]?.objectTypeId === "OBJ-ENTERPRISE-BUDGET-DETAIL";
    const summary = collection.summary;
    canvasStage.innerHTML = `<div class="business-overview"><section class="business-section"><header><h2>${escapeHtml(collection.title)}</h2><span>${items.length} 个可下探对象</span></header>${summary ? `<div class="business-metrics"><article><span>集团融资余额</span><strong>${formatNumber(summary.balanceYuan / 1e8, 3)} 亿元</strong></article><article><span>余额加权成本</span><strong>${formatNumber(summary.weightedCost, 4)}%</strong></article><article><span>全量融资记录</span><strong>${summary.loanCount} 笔 / ${summary.subjectCount} 主体</strong></article></div><p>${escapeHtml(collection.scopeNote)}</p>` : ""}<div class="business-table-scroll"><table class="workspace-table"><thead><tr><th>${loans ? "借据编号" : "业务记录"}</th><th>${loans ? "借据余额（元）" : details ? "预算（万元）" : "关键值"}</th><th>${loans ? "当前利率" : details ? "实际（万元）" : "类型"}</th><th>数据截至</th><th></th></tr></thead><tbody>${visible.map(o => `<tr><td><strong>${escapeHtml(o.title)}</strong>${loans ? `<small>${escapeHtml(o.subtitle)}</small>` : ""}</td><td>${loans ? formatNumber(propertyValue(o, "balanceYuan"), 2) : details ? formatNumber(propertyValue(o, "budgetAmount"), 4) : escapeHtml(primaryMetric(o).value)}</td><td>${loans ? `${formatNumber(propertyValue(o, "rate"), 4)}%` : details ? formatNumber(propertyValue(o, "actualAmount"), 4) : escapeHtml(typeMeta(o).label)}</td><td>${escapeHtml(businessAsOf(o))}</td><td><button class="button quiet" data-open-object="${escapeHtml(o.id)}">打开</button></td></tr>`).join("")}</tbody></table></div><div class="business-tools"><button class="button quiet" data-collection-page="-1" ${!state.collectionPage ? "disabled" : ""}>上一页</button><span>${state.collectionPage + 1} / ${pages}</span><button class="button quiet" data-collection-page="1" ${state.collectionPage === pages - 1 ? "disabled" : ""}>下一页</button>${collection.parentId ? `<button class="button quiet" data-open-object="${escapeHtml(collection.parentId)}">返回企业 / 业务对象</button>` : ""}</div></section></div>`;
  }

  function renderBusinessOverview() {
    const item = activeObject();
    const metrics = keyProperties(item, 12).filter(([key]) => !["dataAsOf", "asOf", "assessmentAsOf", "evaluatedAt", "validFrom", "validTo", "snapshotCount"].includes(key)).slice(0, 6);
    const latest = objectSeries(item).map(series => ({ series, point: (series.points || []).filter(p => numeric(p.v)).at(-1) })).filter(entry => entry.point);
    const records = businessRecords(item);
    const links = visibleBusinessLinks(item);
    const tier = propertyValue(item, "riskTier");
    const rate = propertyValue(item, "executionRate");
    const findings = businessRules(item) + (tier ? `<article class="business-finding"><strong>债务风险评估：${escapeHtml(tier)}</strong><p>正式风险评分 ${escapeHtml(formatValue(item.properties.riskScore))}，按已发布风险模型分档。${["红灯", "黄灯", "黑灯"].includes(tier) ? "需结合薄弱指标开展业务跟踪。" : "可结合后续评估持续观察。"}</p><small>评估截至 ${escapeHtml(comparisonPolicy().propertyDate(item, item.properties.riskScore))}</small></article>` : "") + (rate > 100 ? `<article class="business-finding"><strong>${item.objectTypeId === "OBJ-ENTERPRISE-BUDGET-DETAIL" ? "期间预算执行超出" : "年度预算超支"}</strong><p>实际执行 ${escapeHtml(formatValue(item.properties.actualAmount))} / 预算 ${escapeHtml(formatValue(item.properties.budgetAmount))}，执行率 ${escapeHtml(formatValue(item.properties.executionRate))}，超过预算 ${formatNumber(rate - 100)} 个百分点。</p></article>` : "");
    const actions = records.map(record => `<button class="button primary" type="button" data-business-action="${escapeHtml(record.request.id)}">${record.task ? "查看 / 办理待办" : "查看 / 审批事项"} · ${escapeHtml(record.request.actionType?.name || "业务事项")}</button>`).join("");
    canvasStage.innerHTML = `<div class="business-overview">
      <section class="business-intro"><div><span>${escapeHtml(typeMeta(item).label)}</span><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.subtitle || "")}</p><small>数据截至 ${escapeHtml(businessAsOf(item))}</small></div>${businessChip(item)}</section>
      <nav class="business-steps" aria-label="业务阅读路径"><a href="#business-facts">了解情况</a><span>→</span>${findings ? `<a href="#business-findings">理解判断</a><span>→</span>` : ""}<a href="#business-actions">推进业务</a><span>→</span><a href="#business-progress">跟踪结果</a></nav>
      <section id="business-facts" class="business-section"><header><h3>当前业务情况</h3><button class="button quiet" data-business-basis>数据与口径</button></header><div class="business-metrics">${metrics.map(([key, p]) => `<article><span>${escapeHtml(propertyLabel(key))}</span><strong>${escapeHtml(formatValue(p))}</strong><small>截至 ${escapeHtml(comparisonPolicy().propertyDate(item, p) || businessAsOf(item))}</small></article>`).join("")}${latest.length && !metrics.some(([, p]) => numeric(p.value)) ? latest.slice(0, 3).map(({ series, point }) => `<article><span>${escapeHtml(series.label)}</span><strong>${escapeHtml(formatValue({ value: point.v, unit: series.unit }))}</strong><small>最近观测 ${escapeHtml(point.t)}</small></article>`).join("") : ""}</div><div class="business-tools">${businessCapabilities(item).map(id => `<button class="button quiet" data-business-lens="${id}">${icon(LENSES.find(l => l.id === id).icon)}${({ graph: "查看业务关系", temporal: "查看指标变化", spatial: "查看企业分布", compare: "选择同类对象比较" })[id]}</button>`).join("")}</div></section>
      ${findings ? `<section id="business-findings" class="business-section"><header><h3>需要关注的业务问题</h3><button class="button quiet" data-business-basis>查看判断依据</button></header>${findings}</section>` : ""}
      <section class="business-section"><header><h3>关联业务</h3><span>${links.length} 项</span></header><div class="business-relations">${links.map(link => { const other = relatedObject(link, item.id); return `<button data-business-related="${escapeHtml(other.id)}"><small>${escapeHtml(linkLabel(link, item.id))}</small><strong>${escapeHtml(other.objectTypeId === "OBJ-FINANCING-ENTITY" ? "融资角色、负责人及机构" : other.title)}</strong><span>${escapeHtml(typeMeta(other).label)} →</span></button>`; }).join("") || `<p>从当前对象继续提问或形成业务分析报告。</p>`}</div></section>
      ${renderBusinessDetails(item)}
      <section id="business-actions" class="business-section"><header><h3>可采取的行动</h3></header><div class="business-tools">${actions}${["OBJ-ENTERPRISE", "OBJ-INVESTMENT-PRODUCT"].includes(item.objectTypeId) ? `<button class="button quiet" data-navigate-module="query">围绕此对象提问</button>` : ""}<button class="button quiet" data-navigate-module="report">加入业务报告</button></div><p>${records.length ? "审批、分办、执行与反馈统一在决策中心办理；返回此处查看最新进展。" : ({ S002: "预算复核通过业务分析与报告开展。", S004: "贷前评估通过业务分析与报告内人工复核开展。", S005: "投资评价可进入模型分析，试算与正式业务事实分别保留。" })[item.scenarioId] || "结合业务判断开展分析，或在驾驶舱查看风险处置。"}</p></section>
      <section id="business-progress" class="business-section"><header><h3>办理进展与业务结果</h3></header>${records.map(record => {
        const task = record.task;
        const feedback = typeof task?.result === "string" ? task.result : task?.result?.summary || task?.result?.note || task?.result?.conclusion;
        return `<article class="business-progress"><header><strong>${escapeHtml(record.request.actionType?.name || "业务事项")}</strong><span class="business-status">${escapeHtml(record.stage)}</span></header><p>责任人：${escapeHtml(task?.owner || record.request.recipientName || record.request.owner || "待审批后分办")}${task?.dueDate ? ` · 截止日期：${escapeHtml(task.dueDate)}` : ""}</p><p>${escapeHtml(task?.instructions || record.request.recommendation || "")}</p>${task?.progress?.length ? `<p><b>最新进展：</b>${escapeHtml(task.progress.at(-1).content)}</p>` : ""}${feedback ? `<p><b>办理反馈：</b>${escapeHtml(feedback)}</p>` : ""}<small>来源：决策中心${record.live ? "当前办理记录" : "初始业务记录；进入决策中心继续办理"}</small></article>`;
      }).join("") || `<p>本对象的业务分析与报告可从上方入口继续。</p>`}<p class="business-outcome-note">办理状态与经营结果分别记录。成本、预算执行和风险分档以各自截至日的业务数据为准；待办完成后仍需依据后续数据评价业务效果。</p></section>
      ${renderReturnedResult()}
    </div>`;
    canvasStage.querySelectorAll('.business-steps a').forEach(anchor => anchor.addEventListener('click', event => { event.preventDefault(); canvasStage.querySelector(anchor.getAttribute('href'))?.scrollIntoView({ behavior: 'instant', block: 'start' }); }));
  }

  function openBusinessAnalysis(lens) {
    if (!businessCapabilities(activeObject()).includes(lens)) return;
    if (lens === "compare") {
      const peers = businessPeers(activeObject());
      openDrawer(`${drawerHeader("选择同类对象比较")}<div class="drawer-body"><p>只比较同类型、同指标口径与版本的对象；每行保留真实截至日。</p>${peers.map(item => `<label class="business-compare-choice"><input type="checkbox" data-business-peer="${escapeHtml(item.id)}" ${item.id === state.activeId ? "checked" : ""}>${escapeHtml(item.title)}</label>`).join("")}<button class="button primary" data-business-compare-start>开始比较</button></div>`);
      drawer.querySelector('[data-business-compare-start]').addEventListener('click', () => {
        const ids = [...drawer.querySelectorAll('[data-business-peer]:checked')].map(input => input.dataset.businessPeer);
        if (ids.length < 2 || !metricCandidates(ids.map(resolveObject)).some(m => m.available >= 2)) { toast("请选择至少两个具有共同业务指标的对象", "warning"); return; }
        setState({ selectedIds: ids, activeId: ids.includes(state.activeId) ? state.activeId : ids[0], lens: "compare" });
        closeDrawer();
      });
      return;
    }
    openLens(lens);
  }

  function navigateDecision(requestId) {
    const record = businessRecords().find(entry => entry.request.id === requestId);
    if (!record) return;
    if (global.parent === global) { toast("请从平台业务全景进入，继续在决策中心办理。", "warning"); return; }
    global.parent.postMessage({ channel: HANDOFF_CHANNEL, operation: "open-business-decision", requestId,
      route: record.route, scenarioId: record.request.scenarioContext?.scenarioId || record.request.scenarioIdentity?.scenarioId,
      returnUrl: global.location.href, context: buildHandoffContext() }, global.location.origin);
  }

  function ensureWorkspaceState() {
    const set = objectSetObjects();
    if (!resolveObject(state.activeId)) {
      state.activeId = set[0]?.id || null;
    }
    if (!state.graphExpanded.length && state.activeId) state.graphExpanded = [state.activeId];
    if (!resolveObject(state.graphSelectedId)) state.graphSelectedId = state.activeId;
  }

  function renderWorkspaceContext() {
    const objects = objectSetObjects();
    const active = activeObject();
    const ref = canonicalObjectRef(active);
    const domains = active?.sourceFacets ? `<label class="enterprise-domain">业务视角<select data-enterprise-domain aria-label="企业业务视角">${Object.keys({ ...active.sourceFacets, ...(active.budgetOwnership ? { S002: {} } : {}) }).map((scenario) => `<option value="${scenario}" ${ref.scenarioId === scenario ? "selected" : ""}>${scenario === "S001" ? "融资分析" : scenario === "S002" ? "企业预算" : "债务风险"}</option>`).join("")}</select></label>` : "";
    workspaceContext.innerHTML = `<div class="context-leading"><button class="back-button" type="button" data-route="discover">${icon("arrow-left")}<span>返回对象发现</span></button><div class="context-divider"></div><button class="context-token" type="button" data-open-mobile="path"><span class="token-icon">${icon("boxes")}</span><span><small>当前对象集</small><strong>${objects.length} 个对象</strong></span>${icon("chevron-down")}</button><button class="context-token active-object-token" type="button" data-open-mobile="inspector"><span class="token-icon object-token">${icon(typeMeta(active).icon)}</span><span><small>当前对象</small><strong>${escapeHtml(active?.title || "未选择")}</strong></span>${icon("chevron-down")}</button></div>${domains}<div class="time-context" ${["temporal", "compare"].includes(state.lens) ? "" : "hidden"}><span>${icon("calendar-range")}<b>历史分析区间</b></span><label><span>开始</span><input id="context-time-start" type="date" min="${escapeHtml(resource.source.dateRange.from)}" max="${escapeHtml(state.timeRange.end)}" value="${escapeHtml(state.timeRange.start)}"></label><i>至</i><label><span>结束</span><input id="context-time-end" type="date" min="${escapeHtml(state.timeRange.start)}" max="${escapeHtml(resource.source.dateRange.to)}" value="${escapeHtml(state.timeRange.end)}"></label></div><div class="context-trailing"><span class="version-pill">数据截至 ${escapeHtml(businessAsOf(active))}</span><button class="icon-button mobile-context-button" type="button" data-open-mobile="path" aria-label="打开对象集">${icon("panel-left-open")}</button><button class="icon-button mobile-context-button" type="button" data-open-mobile="inspector" aria-label="打开对象详情">${icon("panel-right-open")}</button></div>`;
  }

  function shortVersion(value) {
    if (!value) return "未绑定版本";
    return value.length > 28 ? `${value.slice(0, 12)}…${value.slice(-9)}` : value;
  }

  function renderLensNav() {
    const primary = LENSES.filter(lens => ["overview", "catalog"].includes(lens.id) || state.lens === lens.id);
    lensNav.innerHTML = primary.map(lens => `<button class="lens-button ${state.lens === lens.id ? "active" : ""}" type="button" data-lens="${lens.id}" aria-current="${state.lens === lens.id ? "page" : "false"}">${icon(lens.icon)}<span><strong>${lens.label}</strong><small>${lens.short}</small></span></button>`).join("") + `<span class="business-nav-hint">在对象全景中选择相关分析</span>`;
  }

  function renderPathPane() {
    const objects = objectSetObjects();
    const query = state.pathSearch.trim().toLocaleLowerCase("zh-CN");
    const visible = objects.filter((item) => !query || searchableText(item).includes(query));
    pathPane.innerHTML = `<header class="pane-heading"><div><span class="eyebrow">OBJECT SET</span><h2>分析对象集</h2></div><span class="count-badge">${objects.length}</span><button class="icon-button pane-close" type="button" data-close-mobile aria-label="关闭">${icon("x")}</button></header><div class="path-summary"><div class="path-step complete"><span>1</span><div><strong>${state.selectedIds.length ? "已选对象" : "搜索结果"}</strong><small>${objects.length} 个对象进入当前分析</small></div></div><div class="path-connector"></div><div class="path-step active"><span>2</span><div><strong>${escapeHtml(LENSES.find((lens) => lens.id === state.lens)?.label)}</strong><small>${escapeHtml(state.timeRange.start)} 至 ${escapeHtml(state.timeRange.end)}</small></div></div></div><label class="pane-search">${icon("search")}<input id="path-search" type="search" value="${escapeHtml(state.pathSearch)}" placeholder="在对象集中查找"><button type="button" data-clear-path-search aria-label="清除">${icon("x")}</button></label><div class="path-object-list">${visible.map((item) => `<button class="path-object ${item.id === state.activeId ? "active" : ""}" type="button" data-set-active="${escapeHtml(item.id)}">${objectGlyph(item, "tiny")}<span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(typeMeta(item).label)}</small></span>${businessChip(item)}</button>`).join("") || `<div class="empty-compact">${icon("search-x")}<span>对象集中没有匹配项</span></div>`}</div><footer class="path-footer"><button class="button quiet full" type="button" data-route="discover">${icon("list-filter")}<span>调整对象范围</span></button></footer>`;
  }

  function lensHeading() {
    const active = activeObject();
    const headings = {
      collection: { title: resource.collections.find(c => c.id === state.collectionId)?.title || "业务记录", subtitle: "与业务对象关联的记录与汇总范围", icon: "table-properties" },
      overview: { title: active?.title || "业务全景", subtitle: "当前情况 · 判断依据 · 关联业务 · 办理进展", icon: "panels-top-left" },
      catalog: { title: "对象目录", subtitle: "扫描当前对象集并选择下一步分析对象", icon: "table-properties" },
      object360: { title: active?.title || "对象全貌", subtitle: `${typeMeta(active).label} · 属性、关系、事件与证据`, icon: "scan-face" },
      graph: { title: "关系网络", subtitle: `关系中心：${(resolveObject(state.graphExpanded[0]) || active)?.title || "未选择"} · 当前节点：${active?.title || "未选择"}`, icon: "share-2" },
      temporal: { title: "时序分析", subtitle: "多序列联动查看变化、异常与业务事件", icon: "chart-no-axes-combined" },
      spatial: { title: "企业地图", subtitle: "城市级演示布点 · 颜色为债务风险分档", icon: "map" },
      compare: { title: "对比分析", subtitle: "比较同类对象的指标、分布与差异", icon: "columns-3" }
    };
    return headings[state.lens];
  }

  function renderCanvasHeader() {
    const heading = lensHeading();
    let controls = "";
    if (state.lens === "object360") {
      controls = `<div class="segmented compact" aria-label="对象全貌分区">${[
        ["properties", "属性"], ["relations", "关系"], ["events", "事件"], ["evidence", "数据与口径"]
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
    if (!activeObject() && state.lens !== "collection") { canvasStage.innerHTML = emptyLens("search-x", "当前范围没有业务对象", "", "调整对象范围", "catalog"); return; }
    const renderers = {
      collection: renderCollectionLens,
      overview: renderBusinessOverview,
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
    const points = (first.points || []).filter((point) => point.t >= state.timeRange.start && point.t <= state.timeRange.end && numeric(point.v));
    const point = points.at(-1) || first.points?.at(-1);
    return point ? { label: first.label, value: `${formatNumber(point.v)}${first.unit ? ` ${first.unit}` : ""}`, date: point.t } : null;
  }

  function renderCatalogLens() {
    const items = objectSetObjects();
    const rows = items.map((item) => {
      const metric = latestSeriesSummary(item) || primaryMetric(item);
      const events = objectEvents(item).length;
      return `<tr class="${item.id === state.activeId ? "active" : ""}" data-set-active="${escapeHtml(item.id)}"><td><div class="object-cell">${objectGlyph(item, "small")}<div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.subtitle || "")}</small></div></div></td><td>${escapeHtml(typeMeta(item).label)}</td><td><div class="metric-cell"><strong>${escapeHtml(metric?.value || "—")}</strong><small>${escapeHtml(metric?.label || "暂无关键值")}</small></div></td><td>${objectLinks(item).length}</td><td>${events}</td><td>${businessChip(item)}</td><td><button class="row-arrow" type="button" data-open-object="${escapeHtml(item.id)}" aria-label="查看${escapeHtml(item.title)}">${icon("arrow-right")}</button></td></tr>`;
    }).join("");
    canvasStage.innerHTML = `<div class="lens-surface catalog-lens"><div class="table-summary"><span>${icon("boxes")}<strong>${items.length} 个对象</strong><small>${new Set(items.map((item) => item.objectTypeId)).size} 种类型 · ${items.filter((item) => global.OFW_M07_BUSINESS.status(item)).length} 个业务提示</small></div><div class="table-density"><span>点击一行切换当前对象</span></div></div><div class="workspace-table-wrap"><table class="workspace-table"><thead><tr><th>业务对象</th><th>类型</th><th>当前关键值</th><th>关系</th><th>事件</th><th>业务状态</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="workspace-card-list">${items.map((item) => { const metric = latestSeriesSummary(item) || primaryMetric(item); return `<button class="workspace-card ${item.id === state.activeId ? "active" : ""}" type="button" data-set-active="${escapeHtml(item.id)}"><header>${objectGlyph(item, "small")}<span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(typeMeta(item).label)}</small></span>${businessChip(item)}</header><div><span>${escapeHtml(metric?.label || "关键值")}</span><strong>${escapeHtml(metric?.value || "—")}</strong></div></button>`; }).join("")}</div>`;
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
    const header = `<section class="object-hero"><div class="object-hero-main">${objectGlyph(item, "hero")}<div><span class="type-label">${escapeHtml(typeMeta(item).label)}</span><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.subtitle || "")}</p></div></div><div class="object-hero-quality">${businessChip(item)}<span>${objectLinks(item).length} 条关系 · ${objectSeries(item).length} 条时序</span></div></section>${metrics.length ? `<section class="metric-ribbon">${metrics.map((metric) => `<div><span>${escapeHtml(metric.label)}</span><strong>${escapeHtml(metric.value)}</strong></div>`).join("")}</section>` : ""}`;
    let body = "";
    if (state.objectTab === "properties") body = renderPropertiesPanel(item);
    if (state.objectTab === "relations") body = renderRelationsPanel(item);
    if (state.objectTab === "events") body = renderEventsPanel(item);
    if (state.objectTab === "evidence") body = renderEvidencePanel(item);
    canvasStage.innerHTML = `<div class="object360-lens">${header}${body}</div>`;
  }

  function renderPropertiesPanel(item) {
    const entries = propertyEntries(item);
    return `<section class="detail-section"><header><div><span class="eyebrow">PROPERTIES</span><h3>业务属性</h3></div><span>${entries.length} 项</span></header><div class="property-grid">${entries.map(([key, property]) => `<div class="property-card"><div><span>${escapeHtml(propertyLabel(key))}</span></div><strong>${escapeHtml(formatValue(property))}</strong></div>`).join("")}</div></section>`;
  }

  function renderRelationsPanel(item) {
    const links = objectLinks(item);
    if (!links.length) return emptyInline("unlink", "当前对象没有已登记关系", "可继续查看属性、时序或证据。");
    return `<section class="detail-section"><header><div><span class="eyebrow">RELATIONSHIPS</span><h3>对象关系</h3></div><button class="button quiet" type="button" data-open-lens="graph">${icon("share-2")}<span>在关系网络中打开</span></button></header><div class="relation-list">${links.map((link) => { const related = relatedObject(link, item.id); return related ? `<button type="button" data-set-active="${escapeHtml(related.id)}" data-open-lens="object360"><span class="relation-direction">${link.from === item.id ? icon("arrow-up-right") : icon("arrow-down-left")}</span>${objectGlyph(related, "small")}<span class="relation-copy"><small>${escapeHtml(linkLabel(link))}</small><strong>${escapeHtml(related.title)}</strong><em>${escapeHtml(typeMeta(related).label)}</em></span>${icon("chevron-right")}</button>` : ""; }).join("")}</div></section>`;
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
    const owner = resolveObject(event.objectId || event.ownerObjectId);
    return event.title || (event.eventType === "rule-evaluation" ? `${propertyValue(owner, "ruleName") || "业务规则"} · 截至日判断` : titles[event.eventType]) || "业务事件";
  }

  function renderEventsPanel(item) {
    const events = objectEvents(item).sort((left, right) => eventDate(right).localeCompare(eventDate(left)));
    if (!events.length) return emptyInline("calendar-x-2", "当前对象没有业务事件", "所选时间范围内未登记规则、异常或复核事件。");
    return `<section class="detail-section"><header><div><span class="eyebrow">EVENTS</span><h3>业务事件</h3></div><button class="button quiet" type="button" data-open-lens="temporal">${icon("chart-no-axes-combined")}<span>查看时间轴</span></button></header><div class="event-timeline">${events.map((event) => `<article><time>${escapeHtml(formatDate(eventDate(event)))}</time><span class="event-marker ${event.severity === "warning" || event.state === "triggered" ? "warning" : ""}">${icon(event.state === "triggered" ? "zap" : "circle")}</span><div><strong>${escapeHtml(eventTitle(event))}</strong><p>${escapeHtml(event.ruleId || event.state || event.eventType || "")}</p><small>${(event.evidenceRefs || event.sourceRefs || []).length} 项证据</small></div></article>`).join("")}</div></section>`;
  }

  function renderEvidencePanel(item) {
    return `<section class="detail-section"><header><h3>数据与指标口径</h3><button class="button quiet" data-open-definition>查看本体中的对象定义</button></header><p>融资指标来自融资台账与已发布规则；风险分档来自正式债务风险评估；预算来自年度执行记录；投资指标来自持仓观测。各指标沿用原业务来源与截至日。平均融资成本按融资余额加权；预算执行率为实际执行除以预算金额。下方保留来源精度。</p><div class="property-grid">${propertyEntries(item).map(([key, property]) => `<div class="property-card"><span>${escapeHtml(propertyLabel(key))}</span><strong>${escapeHtml(formatValue(property, 8))}</strong><small>${escapeHtml(comparisonPolicy().propertyDate(item, property) || businessAsOf(item))}</small></div>`).join("")}</div>${businessRules(item)}</section>`;
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
    const visited = new Set();
    const visibleLinks = new Map();
    while (queue.length && depths.size < 24) {
      const currentId = queue.shift();
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      const depth = depths.get(currentId) || 0;
      const leaf = link => ["OBJ-FINANCING-DETAIL", "OBJ-HOLDING-OBSERVATION", "OBJ-ENTERPRISE-BUDGET-DETAIL"].includes(resolveObject(link.from === currentId ? link.to : link.from)?.objectTypeId) ? 1 : 0;
      const links = [...(indexes.linksByObject.get(currentId) || [])].sort((a, b) => leaf(a) - leaf(b));
      links.forEach((link) => {
        const nextId = link.from === currentId ? link.to : link.from;
        if (!resolveObject(nextId)) return;
        visibleLinks.set(link.id, link);
        if (!depths.has(nextId) && depths.size >= 24) return;
        if (!depths.has(nextId)) depths.set(nextId, Math.min(depth + 1, 3));
        if (expanded.has(nextId) && depth < 2 && !queue.includes(nextId)) queue.push(nextId);
      });
    }
    const nodes = [...depths.entries()].map(([id, depth]) => ({ item: resolveObject(id), depth })).filter((entry) => entry.item);
    const links = [...visibleLinks.values()].filter((link) => depths.has(link.from) && depths.has(link.to));
    const positions = new Map([[root.id, { x: 500, y: 285 }]]);
    let previousRadius = 0;
    [1, 2, 3].forEach((depth) => {
      const ring = nodes.filter((entry) => entry.depth === depth).sort((a, b) => a.item.id.localeCompare(b.item.id));
      if (!ring.length) return;
      // Uniform angles and separated rings reserve space for circles, labels and handles.
      const radius = Math.max(previousRadius + 190, ring.length > 1 ? 190 / (2 * Math.sin(Math.PI / ring.length)) : 190);
      previousRadius = radius;
      ring.forEach((entry, index) => {
        const angle = -Math.PI / 2 + index / ring.length * Math.PI * 2;
        positions.set(entry.item.id, {
          x: 500 + Math.cos(angle) * radius,
          y: 285 + Math.sin(angle) * radius
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
    canvasStage.innerHTML = `<div class="graph-lens"><div class="graph-canvas"><svg viewBox="0 0 1000 570" role="img" aria-label="${escapeHtml(graph.root.title)}关系网络"><defs><filter id="node-shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#142536" flood-opacity=".18"></feDropShadow></filter></defs><g class="graph-grid"><path d="M0 95H1000M0 190H1000M0 285H1000M0 380H1000M0 475H1000M166 0V570M333 0V570M500 0V570M666 0V570M833 0V570"></path></g><g class="graph-viewport">${lines}${nodes}</g></svg><div class="graph-legend"><span><i style="--legend:#2878bd"></i>当前对象</span><span><i style="--legend:#8b9aaa"></i>已展开关系</span></div><div class="graph-status"><span>${icon("waypoints")}</span><div><strong>${graph.nodes.length} 个节点 · ${graph.links.length} 条关系</strong><small>${hiddenNeighbors ? `${hiddenNeighbors} 个相邻节点待展开` : "当前分支已展开"}</small></div></div></div><aside class="graph-selection"><header>${objectGlyph(selected, "small")}<div><small>当前节点</small><strong>${escapeHtml(selected.title)}</strong></div>${businessChip(selected)}</header><div class="graph-selection-facts"><div><span>对象类型</span><strong>${escapeHtml(typeMeta(selected).label)}</strong></div><div><span>直接关系</span><strong>${objectLinks(selected).length} 条</strong></div><div><span>已显示</span><strong>${objectLinks(selected).filter((link) => graph.positions.has(relatedObject(link, selected.id)?.id)).length} 条</strong></div></div><div class="graph-selection-actions"><button class="button quiet full" data-toggle-object="${escapeHtml(selected.id)}">${state.selectedIds.includes(selected.id) ? "从对象集移除" : "加入分析对象集"}</button><button class="button primary full" type="button" data-graph-expand="${escapeHtml(selected.id)}">${icon("unfold-vertical")}<span>展开相邻节点</span></button><button class="button quiet full" type="button" data-open-lens="object360">${icon("scan-face")}<span>查看对象全貌</span></button></div></aside></div>`;
    setupGraphZoom();
  }

  function setupGraphZoom() {
    const svg = canvasStage.querySelector(".graph-canvas > svg");
    if (!svg || !global.d3) return;
    const points = [...graphProjection().positions.values()];
    const xs = global.d3.extent(points, (point) => point.x), ys = global.d3.extent(points, (point) => point.y);
    const width = Math.max(460, xs[1] - xs[0] + 180), height = Math.max(340, ys[1] - ys[0] + 180);
    svg.setAttribute("viewBox", `${(xs[0] + xs[1] - width) / 2} ${(ys[0] + ys[1] - height) / 2} ${width} ${height}`);
    svg.style.minWidth = `${Math.ceil(width * .75)}px`;
    svg.style.minHeight = `${Math.ceil(height * .75)}px`;
    const selection = global.d3.select(svg);
    const zoom = global.d3.zoom().scaleExtent([.75, 3]).filter((event) => event.type === "wheel" || !event.target.closest(".graph-node"))
      .on("zoom", (event) => {
        selection.select(".graph-viewport").attr("transform", event.transform);
        state.graphTransform = { x: event.transform.x, y: event.transform.y, k: event.transform.k };
      }).on("end", () => updateUrl("replace"));
    selection.call(zoom);
    const saved = state.graphTransform || { x: 0, y: 0, k: 1 };
    selection.call(zoom.transform, global.d3.zoomIdentity.translate(saved.x, saved.y).scale(saved.k));
    svg.parentElement.insertAdjacentHTML("beforeend", `<div class="graph-zoom-tools"><button class="icon-button" type="button" data-graph-scale="in" title="放大关系图" aria-label="放大关系图">${icon("plus")}</button><button class="icon-button" type="button" data-graph-scale="out" title="缩小关系图" aria-label="缩小关系图">${icon("minus")}</button><button class="icon-button" type="button" data-graph-scale="fit" title="恢复关系图视野" aria-label="恢复关系图视野">${icon("scan")}</button></div>`);
    svg.parentElement.querySelectorAll("[data-graph-scale]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.graphScale === "fit") selection.call(zoom.transform, global.d3.zoomIdentity);
      else selection.call(zoom.scaleBy, button.dataset.graphScale === "in" ? 1.2 : 1 / 1.2);
    }));
  }

  function allTimelineDates() {
    const dates = availableSeries().flatMap(series => (series.points || []).filter(point => numeric(point.v)).map(point => point.t)).filter(Boolean);
    return [...new Set(dates)].sort();
  }

  function availableSeries() {
    return objectSeries(activeObject());
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
      .sort((a, b) => a.t.localeCompare(b.t));
    const validPoints = points.filter((point) => numeric(point.v));
    if (!validPoints.length) {
      return `<svg viewBox="0 0 ${width} ${height}" class="series-svg empty" role="img" aria-label="${escapeHtml(series.label)}无区间数据"><text x="${width / 2}" y="${height / 2}" text-anchor="middle">当前时间范围没有可用观测值</text></svg>`;
    }
    const values = validPoints.map((point) => point.v);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) { min -= Math.abs(min || 1) * 0.08; max += Math.abs(max || 1) * 0.08; }
    const startMs = Date.parse(state.timeRange.start);
    const endMs = Date.parse(state.timeRange.end);
    const spanMs = Math.max(86400000, endMs - startMs);
    const x = (date) => left + ((Date.parse(date) - startMs) / spanMs) * (width - left - right);
    const y = (value) => top + (1 - (value - min) / (max - min)) * (height - top - bottom);
    const path = global.d3.line().defined((point) => numeric(point.v)).x((point) => x(point.t)).y((point) => y(point.v))(points);
    const area = "";
    const last = validPoints.at(-1);
    const grid = [0, .5, 1].map((ratio) => {
      const gy = top + ratio * (height - top - bottom);
      const label = max - ratio * (max - min);
      return `<line x1="${left}" y1="${gy}" x2="${width - right}" y2="${gy}"></line><text x="${left - 7}" y="${gy + 3}" text-anchor="end">${escapeHtml(formatNumber(label, 1))}</text>`;
    }).join("");
    const circles = validPoints.length <= 24 ? validPoints.map((point) => `<circle cx="${x(point.t)}" cy="${y(Number(point.v))}" r="3.5" data-series-point="${escapeHtml(series.id)}" data-point-date="${escapeHtml(point.t)}"><title>${escapeHtml(`${point.t} · ${formatNumber(point.v)} ${series.unit || ""}`)}</title></circle>`).join("") : "";
    return `<svg viewBox="0 0 ${width} ${height}" class="series-svg" style="--series-color:${color}" role="img" aria-label="${escapeHtml(series.label)}时序图"><g class="chart-grid">${grid}</g>${area ? `<path class="chart-area" d="${area}"></path>` : ""}<path class="chart-line" d="${path}"></path>${circles}<circle class="last-point" cx="${x(last.t)}" cy="${y(Number(last.v))}" r="5"></circle><line class="last-guide" x1="${x(last.t)}" y1="${top}" x2="${x(last.t)}" y2="${height - bottom}"></line><text class="last-label" x="${Math.min(width - 95, Math.max(left + 5, x(last.t) + 8))}" y="${Math.max(16, y(Number(last.v)) - 9)}">${escapeHtml(formatNumber(last.v))} ${escapeHtml(displayUnit(series.unit))}</text><text class="axis-label" x="${left}" y="${height - 9}">${escapeHtml(formatDate(state.timeRange.start))}</text><text class="axis-label" x="${width - right}" y="${height - 9}" text-anchor="end">${escapeHtml(formatDate(state.timeRange.end))}</text><text class="series-index" x="${width - right}" y="${top + 2}" text-anchor="end">${String(index + 1).padStart(2, "0")}</text></svg>`;
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
    const events = objectEvents(activeObject())
      .filter((event) => eventDate(event) >= state.timeRange.start && eventDate(event) <= state.timeRange.end)
      .sort((left, right) => eventDate(right).localeCompare(eventDate(left)));
    canvasStage.innerHTML = `<div class="temporal-lens">${renderTimeBrush()}<section class="series-picker"><header><div><span class="eyebrow">SERIES</span><h3>分析序列</h3></div><span>已选 ${selected.length} / ${available.length}</span></header><div class="series-options">${available.map((series, index) => { const owner = resolveObject(series.ownerObjectId); return `<label class="series-option" style="--series-color:${CHART_COLORS[index % CHART_COLORS.length]}"><input type="checkbox" data-series-toggle="${escapeHtml(series.id)}" ${selectedIds.has(series.id) ? "checked" : ""}><span class="series-swatch"></span><span><strong>${escapeHtml(series.label)}</strong><small>${escapeHtml(owner?.title || "对象")} · ${series.points?.length || 0} 个观测</small></span></label>`; }).join("")}</div></section><section class="series-stack">${selected.map((series, index) => { const points = (series.points || []).filter((point) => point.t >= state.timeRange.start && point.t <= state.timeRange.end && numeric(point.v)); const latest = points.at(-1); const first = points[0]; const delta = latest && first ? Number(latest.v) - Number(first.v) : null; const owner = resolveObject(series.ownerObjectId); return `<article class="series-panel" style="--series-color:${CHART_COLORS[index % CHART_COLORS.length]}"><header><div><span class="series-swatch"></span><div><strong>${escapeHtml(series.label)}</strong><small>${escapeHtml(owner?.title || "对象")} · ${"按实际观测日期"}</small></div></div><div class="series-latest"><span>${latest ? escapeHtml(formatDate(latest.t)) : "当前范围"}</span><strong>${latest ? `${escapeHtml(formatNumber(latest.v))} ${escapeHtml(displayUnit(series.unit))}` : "无观测"}</strong>${delta != null && points.length > 1 ? `<small class="${delta >= 0 ? "up" : "down"}">${delta >= 0 ? "+" : ""}${escapeHtml(formatNumber(delta))}</small>` : ""}</div></header>${lineChartSvg(series, CHART_COLORS[index % CHART_COLORS.length], index)}</article>`; }).join("")}</section><section class="event-band"><header><div><span class="eyebrow">EVENTS</span><h3>区间事件</h3></div><span>${events.length} 项</span></header>${events.length ? `<div class="event-band-list">${events.map((event) => { const owner = resolveObject(event.objectId || event.ownerObjectId); return `<button type="button" data-set-active="${escapeHtml(owner?.id || "")}"><time>${escapeHtml(formatDate(eventDate(event)))}</time><span class="event-marker warning">${icon("zap")}</span><div><strong>${escapeHtml(eventTitle(event))}</strong><small>${escapeHtml(owner?.title || "业务对象")}</small></div>${icon("chevron-right")}</button>`; }).join("")}</div>` : `<div class="event-none">${icon("calendar-check")}所选时间范围内没有业务事件</div>`}</section></div>`;
  }

  function geoObjects() {
    return objectSetObjects().filter((item) => objectGeometry(item)?.type === "Point" && Array.isArray(objectGeometry(item).coordinates));
  }

  function renderSpatialLens() {
    const objects = geoObjects();
    if (!objects.length) {
      const totalGeo = resource.objects.filter((item) => objectGeometry(item)?.type === "Point").length;
      canvasStage.innerHTML = `<div class="map-empty">${emptyLens("map-pin-off", "当前对象集没有可用坐标", `资源目录中有 ${totalGeo} 个位置对象，可返回对象发现将其加入当前对象集。`, "调整对象范围", "catalog")}</div>`;
      return;
    }
    const width = 860;
    const height = 500;
    const plot = { left: 62, top: 35, right: 38, bottom: 52 };
    const longitudes = objects.map((item) => Number(objectGeometry(item).coordinates[0]));
    const latitudes = objects.map((item) => Number(objectGeometry(item).coordinates[1]));
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
    const mercator = global.d3.geoMercator().fitExtent([[plot.left, plot.top], [width - plot.right, height - plot.bottom]], { type: "MultiPoint", coordinates: [[minLon, minLat], [maxLon, maxLat]] });
    const x = (lon) => mercator([lon, centerLat])[0];
    const y = (lat) => mercator([centerLon, lat])[1];
    const projection = global.d3.geoTransform({ point(lon, lat) { this.stream.point(x(lon), y(lat)); } });
    const geometryPath = global.d3.geoPath(projection);
    const provincePaths = provinceGeometry ? `<g class="province-boundaries">${provinceGeometry.features.map((feature) => `<path d="${geometryPath(feature)}"><title>${escapeHtml(feature.properties?.name || "区域")}</title></path>`).join("")}</g>` : "";
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
      const from = objectGeometry(resolveObject(link.from)).coordinates;
      const to = objectGeometry(resolveObject(link.to)).coordinates;
      return `<line class="map-relation ${link.quality || "passed"}" x1="${x(from[0])}" y1="${y(from[1])}" x2="${x(to[0])}" y2="${y(to[1])}"></line>`;
    }).join("") : "";
    const markers = objects.map((item, index) => {
      const [lon, lat] = objectGeometry(item).coordinates;
      const active = item.id === state.activeId;
      return `<g class="map-marker ${active ? "active" : ""}" transform="translate(${x(lon)} ${y(lat)})" data-set-active="${escapeHtml(item.id)}" tabindex="0" role="button" aria-label="${escapeHtml(item.title)}"><circle class="marker-pulse" r="${active ? 19 : 15}"></circle><circle class="marker-core" r="${active ? 8 : 7}" style="--marker:${({ "红灯": "#c74b45", "黄灯": "#b78623", "绿灯": "#287e6a", "黑灯": "#354448" })[propertyValue(item, "riskTier")] || "#3573aa"}"></circle><text y="-21" text-anchor="middle">${escapeHtml(item.location?.city || item.title)}</text><title>${escapeHtml(`${item.title} · ${lon}, ${lat}`)}</title></g>`;
    }).join("");
    canvasStage.innerHTML = `<div class="spatial-lens"><section class="map-surface"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="对象位置分布"><rect class="map-water" x="0" y="0" width="${width}" height="${height}"></rect><rect class="map-plot" x="${plot.left}" y="${plot.top}" width="${width - plot.left - plot.right}" height="${height - plot.top - plot.bottom}"></rect>${provincePaths}<g class="map-grid">${gridLines}</g>${mapLinks}${markers}</svg><div class="map-scale"><span></span><b>坐标范围 ${formatNumber(minLon, 1)}°E–${formatNumber(maxLon, 1)}°E</b></div><div class="map-crs">演示布点 · 非实际地址 · 底图 DataV</div></section><aside class="map-list"><header><div><span class="eyebrow">MAP OBJECTS</span><h3>位置对象</h3></div><span>${objects.length}</span></header>${objects.map((item) => { const coordinates = objectGeometry(item).coordinates; return `<button type="button" class="${item.id === state.activeId ? "active" : ""}" data-set-active="${escapeHtml(item.id)}">${objectGlyph(item, "small")}<span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.location?.city || "观测点")} · ${escapeHtml(propertyValue(item, "riskTier") || "位置对象")}</small></span>${icon("locate-fixed")}</button>`; }).join("")}<footer><div><strong>${objects.length}</strong><span>有坐标</span></div><div><strong>${objectSetObjects().length - objects.length}</strong><span>无坐标</span></div></footer></aside></div>`;
  }

  function metricCandidates(items) {
    return comparisonPolicy().candidates(items, state.timeRange).filter(metric => metric.kind === "series" || items.some(item => propertyEntries(item).some(([key]) => key === metric.key)));
  }

  function comparisonPolicy() {
    return global.OFW_M07_COMPARISON.create({ seriesFor: objectSeries, resources: resource.portfolioResources || [], labelFor: propertyLabel });
  }

  function metricTimeNote(items, metric) {
    return comparisonPolicy().timeNote(items, metric, state.timeRange);
  }

  function metricLabel(metric) {
    return `${metric.label} · ${metric.kind === "property" ? "静态快照" : "区间最新观测"}`;
  }

  function valueForMetric(item, metric) {
    return comparisonPolicy().observation(item, metric, state.timeRange).value;
  }

  function comparisonItems() {
    const set = objectSetObjects();
    const active = activeObject();
    const sameType = set.filter((item) => item.objectTypeId === active?.objectTypeId);
    if (sameType.length >= 2) return sameType.slice(0, state.compareLimit);
    const metrics = metricCandidates(set);
    if (!metrics.length) return set.slice(0, state.compareLimit);
    return set.filter((item) => valueForMetric(item, metrics[0]) != null).slice(0, state.compareLimit);
  }

  function comparisonMetric(items) {
    const metrics = metricCandidates(items).filter(metric => metric.coverage === items.length);
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
    return `<div class="bar-comparison">${values.map((entry, index) => `<button type="button" class="bar-row ${entry.item.id === state.activeId ? "active" : ""}" data-set-active="${escapeHtml(entry.item.id)}"><span class="bar-label"><b>${index + 1}</b><span><strong>${escapeHtml(entry.item.title)}</strong><small>${escapeHtml(typeMeta(entry.item).label)}</small></span></span><span class="bar-track"><i style="width:${Math.max(2, Math.abs(entry.value) / max * 100)}%;--bar-color:${CHART_COLORS[index % CHART_COLORS.length]}"></i></span><strong class="bar-value">${escapeHtml(formatNumber(entry.value))}<small>${escapeHtml(displayUnit(metric.unit))}</small></strong></button>`).join("")}</div>`;
  }

  function renderDotComparison(items, metric) {
    const values = items.map((item) => ({ item, value: valueForMetric(item, metric) })).filter((entry) => entry.value != null).sort((left, right) => left.value - right.value);
    if (!comparisonPolicy().aligned(items, metric, state.timeRange)) return emptyInline("calendar-clock", "当前观测不适合汇总比较", "请使用同一实际观测日；此状态不计算中位数。 ");
    let min = Math.min(...values.map((entry) => entry.value));
    let max = Math.max(...values.map((entry) => entry.value));
    if (min === max) { min -= 1; max += 1; }
    const position = (value) => 4 + ((value - min) / (max - min)) * 92;
    const median = global.d3.median(values, (entry) => entry.value);
    return `<div class="dot-comparison"><div class="dot-axis"><span>${escapeHtml(formatNumber(min))}</span><span>中位数 ${escapeHtml(formatNumber(median))}</span><span>${escapeHtml(formatNumber(max))} ${escapeHtml(displayUnit(metric.unit))}</span></div>${values.map((entry, index) => `<button type="button" class="dot-row ${entry.item.id === state.activeId ? "active" : ""}" data-set-active="${escapeHtml(entry.item.id)}"><span class="dot-label">${escapeHtml(entry.item.title)}</span><span class="dot-track"><i class="median" style="left:${position(median)}%"></i><i class="dot" style="left:${position(entry.value)}%;--dot-color:${CHART_COLORS[index % CHART_COLORS.length]}"></i><b style="left:${position(entry.value)}%">${escapeHtml(formatNumber(entry.value))}</b></span></button>`).join("")}</div>`;
  }

  function renderRadarComparison(items, metrics, selected) {
    const referenceDates = items.slice(0, 4).map(item => comparisonPolicy().observation(item, selected, state.timeRange).asOf).join();
    const chosenMetrics = metrics.filter((metric) => metric.kind === selected.kind && comparisonPolicy().aligned(items.slice(0, 4), metric, state.timeRange)
      && items.slice(0, 4).map(item => comparisonPolicy().observation(item, metric, state.timeRange).asOf).join() === referenceDates).slice(0, 5);
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
    const chart = !selected.available ? emptyInline("calendar-x", "所选区间无观测", "没有可比较的有效观测，不以旧快照补填。")
      : !comparisonPolicy().aligned(items.filter(item => valueForMetric(item, selected) !== null), selected, state.timeRange)
        ? emptyInline("calendar-clock", "观测时点不一致", "请核对下方真实时点，当前不进行排序或统计。")
        : state.compareChart === "dot" ? renderDotComparison(items, selected)
          : state.compareChart === "radar" ? renderRadarComparison(items, metrics, selected)
            : renderBarComparison(items, selected);
    canvasStage.innerHTML = `<div class="compare-lens"><section class="compare-toolbar"><label><span>对比指标</span><select id="compare-metric">${metrics.map((metric) => `<option value="${escapeHtml(metric.id)}" ${metric.id === selected.id ? "selected" : ""}>${escapeHtml(metricLabel(metric))}${metric.unit ? ` (${escapeHtml(displayUnit(metric.unit))})` : ""} · ${metric.coverage}/${items.length}</option>`).join("")}</select></label><label><span>对象数量</span><select data-compare-limit aria-label="对比对象数量">${[8,16,1000].map((limit) => `<option value="${limit}" ${state.compareLimit === limit ? "selected" : ""}>${limit === 1000 ? "全部对象" : `前 ${limit} 个`}</option>`).join("")}</select></label><div class="compare-summary"><div><strong>${items.length}</strong><span>对比对象</span></div><div><strong>${metrics.length}</strong><span>共同指标</span></div><div><strong>${escapeHtml(displayUnit(selected.unit) || "数值")}</strong><span>当前单位</span></div></div></section><section class="comparison-chart ${state.compareChart}"><header><div><span class="eyebrow">COMPARISON</span><h3>${escapeHtml(state.compareChart === "radar" ? "多指标轮廓（前4个对象，完整观测指标）" : selected.label)}</h3></div><span>所选区间：${escapeHtml(state.timeRange.start)} 至 ${escapeHtml(state.timeRange.end)}</span></header><p class="comparison-time-note">${escapeHtml(metricTimeNote(items, selected))}</p>${chart}</section><p class="comparison-time-note">仅显示所有所选对象共有的业务指标。规则中的不同指标值分别解释。</p><section class="comparison-table"><header><div><span class="eyebrow">DETAILS</span><h3>数值明细</h3></div></header><div class="comparison-table-scroll"><table><thead><tr><th>业务对象</th>${metrics.slice(0, 6).map((metric) => `<th>${escapeHtml(metricLabel(metric))}${metric.unit ? `<small>${escapeHtml(displayUnit(metric.unit))}</small>` : ""}</th>`).join("")}</tr></thead><tbody>${items.map((item) => `<tr class="${item.id === state.activeId ? "active" : ""}" data-set-active="${escapeHtml(item.id)}"><td><div class="object-cell">${objectGlyph(item, "tiny")}<strong>${escapeHtml(item.title)}</strong></div></td>${metrics.slice(0, 6).map((metric) => { const observation = comparisonPolicy().observation(item, metric, state.timeRange); return `<td>${observation.value == null ? `<span class="missing-value">${escapeHtml(observation.reason)}</span>` : escapeHtml(formatNumber(observation.value))}<small>${escapeHtml(observation.asOf || "无有效观测日")}</small></td>`; }).join("")}</tr>`).join("")}</tbody></table></div></section></div>`;
  }

  function renderReturnedResult() {
    const envelope = returnedModelResult?.resultEnvelope;
    if (!envelope || resolveObject(returnedModelResult.inputManifest?.objectRef)?.id !== activeObject()?.id) return "";
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
    if (!item) { inspectorPane.innerHTML = ""; return; }
    inspectorPane.innerHTML = `<header class="pane-heading"><h2>当前对象</h2><button class="icon-button pane-close" data-close-mobile aria-label="关闭">${icon("x")}</button></header><div class="inspector-scroll"><section class="inspector-identity">${objectGlyph(item, "large")}<h3>${escapeHtml(item.title)}</h3>${businessChip(item)}</section><p>数据截至 ${escapeHtml(businessAsOf(item))}</p><section class="inspector-actions"><button class="button primary full" data-open-lens="overview">返回业务全景</button><button class="button quiet full" data-business-basis>数据与判断依据</button>${businessCapabilities(item).map(id => `<button class="button quiet full" data-business-lens="${id}">${escapeHtml(LENSES.find(l => l.id === id).label)}</button>`).join("")}</section>${renderReturnedResult()}</div>`;
  }

  function syncBreadcrumb() {
    if (global.parent === global) return;
    global.parent.postMessage({
      channel: HANDOFF_CHANNEL,
      operation: "sync-breadcrumb",
      moduleId: MODULE_ID,
      route: state.route === "discover" ? "#discover" : "#explore",
      label: state.route === "discover" ? "对象发现" : "对象全景"
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
    if (patch.selectedIds) toast(`已加入对象集：${item.title}（${typeMeta(item).label}）· 现有 ${patch.selectedIds.length} 个对象`, "success");
  }

  function openObject(objectId) {
    const item = resolveObject(objectId);
    if (!item) return;
    const currentSelection = state.selectedIds.length ? [...state.selectedIds] : [];
    if (!currentSelection.includes(item.id)) currentSelection.unshift(item.id);
    rememberObject(item);
    setState({
      route: "explore",
      lens: "overview",
      selectedIds: [...state.selectedIds],
      activeId: item.id,
      previewId: item.id,
      graphExpanded: [item.id],
      graphSelectedId: item.id,
      timelineSeriesIds: objectSeries(item).slice(0, 4).map((series) => series.id)
    }, { history: "push" });
  }

  function openLens(lensId) {
    if (!LENSES.some((lens) => lens.id === lensId)) return;
    if (["graph", "temporal", "spatial"].includes(lensId) && !businessCapabilities(activeObject()).includes(lensId)) return;
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
      collectionId: state.collectionId,
      selectedIds: [...state.selectedIds],
      activeId: state.activeId,
      timeRange: { ...state.timeRange },
      objectTab: state.objectTab,
      graphExpanded: [...state.graphExpanded],
      timelineSeriesIds: [...state.timelineSeriesIds],
      compareChart: state.compareChart,
      compareMetric: state.compareMetric,
      compareLimit: state.compareLimit,
      mapZoom: state.mapZoom,
      mapLinks: state.mapLinks,
      graphSelectedId: state.graphSelectedId,
      graphTransform: clone(state.graphTransform),
      objectSetRef: objectSetRef(),
      filters: { search: state.search, typeFilter: state.typeFilter, quality: state.quality },
      businessScenario: state.businessScenario
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
    const migratedView = resource.legacyViews?.[saved.activeId];
    const active = resolveObject(saved.activeId) || resolveObject(migratedView?.activeId) || resolveObject(selectedIds[0]);
    state = {
      ...state,
      route: "explore",
      lens: migratedView?.collectionId ? "collection" : LENSES.some((lens) => lens.id === saved.lens) ? saved.lens : "overview",
      collectionId: saved.collectionId || migratedView?.collectionId || null,
      collectionPage: 0,
      businessScenario: migratedView?.businessScenario || saved.businessScenario || "S003",
      selectedIds,
      activeId: active?.id || state.activeId,
      previewId: active?.id || state.previewId,
      timeRange: normalizeDateRange(saved.timeRange),
      objectTab: saved.objectTab || "properties",
      graphExpanded: (saved.graphExpanded || []).map(resolveObject).filter(Boolean).map((item) => item.id),
      timelineSeriesIds: saved.timelineSeriesIds || [],
      compareChart: saved.compareChart || "bar",
      compareMetric: saved.compareMetric || null,
      compareLimit: saved.compareLimit || 8,
      mapZoom: saved.mapZoom || 1,
      mapLinks: saved.mapLinks !== false,
      graphSelectedId: resolveObject(saved.graphSelectedId)?.id || active?.id || null,
      graphTransform: clone(saved.graphTransform) || { x: 0, y: 0, k: 1 },
      search: saved.filters?.search || saved.objectSetRef?.filters?.query || "",
      typeFilter: resource.typeMetadata?.[saved.filters?.typeFilter] ? saved.filters.typeFilter : "all",
      quality: saved.filters?.quality || saved.objectSetRef?.filters?.quality || "all"
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
    const types = [...new Set(objectSetObjects().map(object => typeMeta(object).label))];
    openDrawer(`${drawerHeader("继续分析", "带当前上下文前往")}<div class="drawer-body"><section class="handoff-object">${objectGlyph(item, "large")}<div><span>${escapeHtml(objectSetRef().title)}</span><strong>${escapeHtml(item?.title || "未选择对象")}</strong><small>${escapeHtml(state.timeRange.start)} 至 ${escapeHtml(state.timeRange.end)}</small></div></section><p class="handoff-scope-types">对象集类型：${escapeHtml(types.join("、"))}${types.length > 1 ? "；包含多种对象类型，目标模块将校验适用范围。" : ""}</p><div class="target-list">${Object.entries(MODULE_TARGETS).filter(([id]) => id === "report" || state.lens !== "collection" && (id === "dashboard" ? item?.objectTypeId === "OBJ-ENTERPRISE" : ["OBJ-ENTERPRISE", "OBJ-INVESTMENT-PRODUCT"].includes(item?.objectTypeId))).map(([id, target]) => `<button type="button" data-navigate-module="${id}"><span>${icon(target.icon)}</span><div><strong>${escapeHtml(target.label)}</strong><small>${escapeHtml(target.detail)}</small></div>${icon("arrow-up-right")}</button>`).join("")}</div></div>`, "action-drawer");
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

  function navigateParentModule(moduleId, options = {}) {
    const target = MODULE_TARGETS[moduleId];
    if (!target) return;
    const context = buildHandoffContext();
    context.ontologyBinding = clone(canonicalObjectRef());
    if (["query", "modeling"].includes(moduleId)) {
      const item = activeObject();
      const legacy = item.sourceFacets?.[state.businessScenario]?.canonicalObjectRef || item.legacyCanonicalObjectRef;
      if (legacy) { context.objectRef = { ...clone(legacy), id: item.id.startsWith("ENT-APPLICANT-") ? legacy.id : item.id, title: item.title }; context.activeObjectRef = context.objectRef; context.dataVersionId = legacy.dataVersionId; context.ontologyVersionId = legacy.ontologyVersionId; context.bindingId = legacy.bindingId; }
    }
    if (options.budget) {
      context.objectRef = { ...context.objectRef, scenarioId: "S002", objectTypeRef: moduleId === "query" ? "Enterprise" : context.objectRef.objectTypeRef };
      context.activeObjectRef = context.objectRef;
      context.budgetEnterpriseId = activeObject().id;
      context.usageIntent = "ANALYSIS";
      context.budgetScope = { enterpriseId: activeObject().id, sourceDepartmentIds: resource.objects.filter(o => o.objectTypeId === "OBJ-ENTERPRISE-DEPARTMENT" && o.parentEnterpriseId === activeObject().id).map(o => o.sourceDepartmentId) };
      if (moduleId === "query") {
        Object.assign(context.objectRef, { dataVersionId: "S002-DATA-v1", ontologyVersionId: "SEM-S002-BUDGET-v1", bindingId: "T019-S002-v1" });
        context.dataVersionId = "S002-DATA-v1"; context.ontologyVersionId = "SEM-S002-BUDGET-v1"; context.bindingId = "T019-S002-v1";
      }
    }
    if (state.lens === "overview") {
      context.objectSetRef = { id: `object-set:m07:${hashString(context.objectRef.id)}`, title: context.objectRef.title, count: 1,
        selectionMode: "EXPLICIT", filters: null, objectIds: [context.objectRef.id], objectRefs: [context.objectRef] };
    }
    const collection = state.lens === "collection" ? resource.collections.find(c => c.id === state.collectionId) : null;
    if (collection) {
      context.viewRef = { id: collection.id, kind: collection.kind, title: collection.title, sourceScope: collection.scopeNote || null };
      const representative = collection.memberIds.map(resolveObject).find(Boolean);
      if (representative) context.objectRef = canonicalObjectRef(representative);
      if (collection.id === "group-finance") context.objectRef.scenarioId = "S001";
      context.activeObjectRef = null;
    }
    if (!context.objectRef?.id || !context.objectRef.objectTypeRef) {
      toast("当前对象缺少稳定引用，无法交接", "warning");
      return;
    }
    const isModeling = moduleId === "modeling";
    if (isModeling && state.lens === "overview" && /^\d{4}-\d{2}-\d{2}$/.test(activeObject()?.dataAsOf || "")) {
      context.requestedTimeRange = clone(context.timeRange);
      context.timeRange = { ...normalizeDateRange({ start: activeObject().dataAsOf, end: activeObject().dataAsOf }), label: `${activeObject().dataAsOf} 对象快照` };
    }
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
      context,
      contentBlock: moduleId === "report" ? {
        type: "exploration", sourceModuleId: "m07", ontologyBinding: context.ontologyBinding, title: options.budget ? `${activeObject().title} · 企业预算` : collection ? collection.title : `${context.objectRef.title} · ${LENSES.find((item) => item.id === state.lens)?.label}`,
        text: `${context.objectSetRef.title}；${state.lens === "overview" ? "业务静态快照，各指标按其截至日展示；历史分析区间不改变快照值。" : ""}所选区间 ${state.timeRange.label}${state.lens === "compare" ? "。静态快照不受区间筛选影响，各行列示真实截至日；区间序列仅取范围内最新观测。" : ""}`,
        resultMode: options.budget || activeObject().budgetMarker ? "demo" : "formal", workspaceContext: { ...workspaceContextPatch(), objectSetRef: context.objectSetRef, ...(collection ? { activeObjectRef: null, viewRef: context.viewRef } : {}) },
        dataVersionId: context.dataVersionId, ontologyVersionId: context.ontologyVersionId,
        evidenceRefs: context.evidenceRefs, returnUrl: global.location.href,
        rows: options.budget ? selectedBudgetAnnuals(activeObject().id).flatMap(o => ["budgetAmount", "actualAmount", "executionRate", "costToRevenue"].map(key => ({ name: `${o.title} / ${propertyLabel(key)}`, value: propertyValue(o, key), unit: o.properties[key].unit, status: "截至2025-12-31；企业归属为演示映射", evidenceRefs: o.sourceRefs, dataVersionId: o.canonicalObjectRef.dataVersionId, ontologyVersionId: o.canonicalObjectRef.ontologyVersionId }))) : reportRowsForLens(),
        series: effectiveReportSeries()
      } : null,
      additionalContentBlock: moduleId === "report" ? returnedResultBlock() : null
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

    if (event.target.closest("#copy-link")) {
      const url = new URL("../../s001-e2e-integration/index.html", global.location.href);
      url.searchParams.set("exploration", serializeState());
      if (global.parent !== global) url.searchParams.set("m08ApiBase", new URLSearchParams(global.parent.location.search).get("m08ApiBase") || "http://127.0.0.1:4373");
      url.hash = "module/m07";
      void copyText(url.href, "完整工作台链接已复制"); return;
    }
    if (event.target.closest("#save-exploration")) { openSaveDialog(); return; }
    if (event.target.closest("#enterprise-map")) { setState({ route: "explore", lens: "spatial", typeFilter: "m01.object-type.enterprise", search: "", quality: "all", selectedIds: [], businessScenario: "S003", activeId: "ENT-020", mapZoom: 1 }, { history: "push" }); return; }
    if (event.target.closest("#open-saved-explorations")) { renderSavedExplorations(); openDrawer(`${drawerHeader("已保存探索")}<div class="drawer-body">${savedList.innerHTML}</div>`); return; }
    if (event.target.closest("#continue-analysis")) { openContinueDrawer(); return; }

    const businessAction = event.target.closest("[data-business-action]");
    if (businessAction) { navigateDecision(businessAction.dataset.businessAction); return; }
    if (event.target.closest("[data-business-basis]")) { openDrawer(`${drawerHeader("业务判断依据")}<div class="drawer-body">${renderEvidencePanel(activeObject())}</div>`); return; }
    const relatedBusiness = event.target.closest("[data-business-related]");
    if (relatedBusiness) { openObject(relatedBusiness.dataset.businessRelated); return; }
    const relatedAnalysis = event.target.closest("[data-business-lens]");
    if (relatedAnalysis) { openBusinessAnalysis(relatedAnalysis.dataset.businessLens); return; }
    if (event.target.closest("[data-open-definition]")) {
      global.parent.postMessage({ operation: "open-business-ontology", semanticVersionId: resource.ontologyVersionId, objectTypeId: activeObject().objectTypeId, returnUrl: global.location.href }, global.location.origin);
      return;
    }
    const collectionTarget = event.target.closest("[data-open-collection]");
    if (collectionTarget) { openCollection(collectionTarget.dataset.openCollection); return; }
    const budgetHistory = event.target.closest("[data-budget-history]");
    if (budgetHistory) { openCollection(`budget-history:${budgetHistory.dataset.budgetHistory}`); return; }
    const budgetDetails = event.target.closest("[data-budget-details]");
    if (budgetDetails) { openCollection(`budget-details:${budgetDetails.dataset.budgetDetails}`); return; }
    const collectionPage = event.target.closest("[data-collection-page]");
    if (collectionPage) { setState({ collectionPage: Math.max(0, (state.collectionPage || 0) + Number(collectionPage.dataset.collectionPage)) }, { emit: false }); return; }
    if (event.target.closest("[data-budget-report]")) { navigateParentModule("report", { budget: true }); return; }
    if (event.target.closest("[data-budget-query]")) { navigateParentModule("query", { budget: true }); return; }
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
    if (openSaved) { openSavedExploration(openSaved.dataset.openSaved); closeDrawer(); return; }
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

    const lensButton = event.target.closest("button[data-lens]");
    if (lensButton) { openLens(lensButton.dataset.lens); return; }

    const objectTab = event.target.closest("[data-object-tab]");
    if (objectTab) { setState({ objectTab: objectTab.dataset.objectTab }, { history: "replace", emit: false }); return; }

    if (event.target.closest("[data-expand-all]")) {
      const graph = graphProjection();
      setState({ graphExpanded: [...new Set([...state.graphExpanded, ...graph.nodes.map((entry) => entry.item.id)])] }, { history: "replace", emit: false });
      return;
    }
    if (event.target.closest("[data-reset-graph]")) {
      setState({ graphExpanded: [state.activeId], graphSelectedId: state.activeId, graphTransform: { x: 0, y: 0, k: 1 } }, { history: "replace", emit: false });
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
    if (target.matches("[data-enterprise-domain]")) { setState({ businessScenario: target.value }); emitWorkspaceContextUpdate(); return; }
    if (target.matches("[data-compare-limit]")) { setState({ compareLimit: Number(target.value) }, { emit: false }); return; }
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


  function effectiveReportSeries() {
    const selected = state.lens === "temporal" ? effectiveTimelineSeries() : [];
    return selected.map((series) => ({ label: series.label, unit: series.unit, points: (series.points || []).filter((point) => point.t >= state.timeRange.start && point.t <= state.timeRange.end).map((point) => ({ date: point.t, value: numeric(point.v) ? point.v : null })) }));
  }

  function returnedResultBlock() {
    const envelope = returnedModelResult?.resultEnvelope;
    if (!envelope || resolveObject(returnedModelResult.inputManifest?.objectRef)?.id !== activeObject()?.id) return null;
    const mode = envelope.useKind === "SHADOW" ? "shadow" : global.OFW_WORKFLOW.normalizeMode(envelope.resultKind);
    return {
      type: "model-result", title: `${canonicalObjectRef().title} · ${global.OFW_WORKFLOW.modes[mode]}`, sourceModuleId: "m07", resultMode: mode,
      workspaceContext: { ...workspaceContextPatch(), resultView: mode }, returnUrl: global.location.href,
      resultId: envelope.sourceProvenance?.resultId || envelope.resultId, modelVersionId: envelope.modelVersionId,
      dataVersionId: envelope.dataVersionId, ontologyVersionId: envelope.semanticContractVersionId,
      text: "模型结果快照；原对象属性单独保留，不以预测或模拟替代事实。",
      rows: (envelope.resultItems || []).map((item) => ({ name: item.label || item.outputId, value: item.value, unit: item.unit || "" })),
      evidenceRefs: [envelope.sourceProvenance?.resultId, envelope.resultId, envelope.dataVersionId].filter(Boolean)
    };
  }

  function reportRowsForLens() {
    if (state.lens === "collection") {
      const collection = resource.collections.find(c => c.id === state.collectionId);
      if (collection?.summary) return [{ name: "集团融资余额", value: collection.summary.balanceYuan / 1e8, unit: "亿元", status: collection.scopeNote }, { name: "集团加权融资成本", value: collection.summary.weightedCost, unit: "%", status: collection.scopeNote }];
      return (collection?.memberIds || []).map(resolveObject).filter(Boolean).map(o => ({ name: o.title, value: propertyValue(o, "balanceYuan") ?? primaryMetric(o).value, unit: propertyValue(o, "balanceYuan") != null ? "元" : "", status: `数据截至 ${businessAsOf(o)}`, evidenceRefs: o.sourceRefs }));
    }
    if (state.lens === "compare") {
      const items = comparisonItems();
      return metricCandidates(items).flatMap((metric) => items.map((item) => {
        const observation = comparisonPolicy().observation(item, metric, state.timeRange);
        return { name: `${item.title} / ${metricLabel(metric)}`, value: observation.value, unit: metric.unit === "score_0_100" ? "分" : metric.unit,
          status: metricTimeNote([item], metric), missingReason: observation.value === null ? `${observation.reason}；${metricTimeNote([item], metric)}` : "",
          metricId: metric.metricId, sourceKind: metric.kind, asOf: observation.asOf, dataVersionId: metric.dataVersionId, ontologyVersionId: metric.ontologyVersionId };
      }));
    }
    if (state.lens === "graph") return graphProjection().links.map((link) => ({ name: resolveObject(link.from)?.title || link.from, value: linkLabel(link), status: resolveObject(link.to)?.title || link.to }));
    if (state.lens === "spatial") return geoObjects().map((item) => ({ name: item.title, value: formatValue({ value: objectGeometry(item) }), status: "演示城市位置；非实际地址" }));
    if (state.lens === "catalog") return objectSetObjects().map((item) => ({ name: item.title, value: primaryMetric(item).value, status: primaryMetric(item).label }));
    return propertyEntries(activeObject()).map(([key, property]) => ({ name: propertyLabel(key), value: property.value, unit: property.unit === "score_0_100" ? "分" : property.unit || "", status: `数据截至 ${comparisonPolicy().propertyDate(activeObject(), property) || businessAsOf(activeObject())}`, dataVersionId: property.dataVersionId, ontologyVersionId: property.ontologyVersionId, evidenceRefs: property.sourceRefs || [] }));
  }

  async function start() {
    try {
      const params = new URLSearchParams(global.location.search);
      const resourcePath = params.get("resource") || "resources/portfolio.json";
      const response = await fetch(resourcePath, { cache: "no-store" });
      if (!response.ok) throw new Error(`资源 HTTP ${response.status}`);
      const data = await response.json();
      validateResource(data);
      const mapResponse = await fetch(new URL("../../resources/china-provinces.geojson", global.location.href));
      if (mapResponse.ok) provinceGeometry = await mapResponse.json();
      const businessResponse = await fetch("../../resources/business-source.json", { cache: "no-store" });
      if (!businessResponse.ok) throw new Error("Business source unavailable");
      const sourceText = await businessResponse.text();
      const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sourceText));
      const sourceHash = [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, "0")).join("");
      if (sourceHash !== global.OFW_M01_BUSINESS_RELEASE?.sourceContract?.sourceFingerprint?.value) throw new Error("Business source fingerprint mismatch");
      resource = global.OFW_BUSINESS_CATALOG.create(data, JSON.parse(sourceText), global.OFW_M01_BUSINESS_RELEASE);
      localStorage.setItem("ofw.m07.ontology-binding.v1", JSON.stringify({ semanticVersionId: resource.ontologyVersionId, dataVersionId: resource.dataVersionId, sourceHash, status: "validated", checkedAt: new Date().toISOString(), instances: resource.objects.length, links: resource.links.length, typeIds: Object.keys(resource.typeMetadata) }));
      const decisions = await fetch("resources/decision-seed.json");
      if (!decisions.ok) throw new Error("办理进展加载失败，请刷新重试");
      decisionSeed = await decisions.json();
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
        if (params.get("restore") === "1") emitWorkspaceContextUpdate();
      }
    } catch (error) {
      fatal(error);
    }
  }

  global.addEventListener("message", handleHostMessage);
  global.addEventListener("storage", event => { if (event.key === global.OFW_M07_BUSINESS.storageKey && state?.lens === "overview") render(); });
  start();
}(window));
