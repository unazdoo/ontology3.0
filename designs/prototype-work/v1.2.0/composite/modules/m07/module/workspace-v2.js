(function () {
  "use strict";

  const C = window.M07Core;
  const MODULE_ID = "m07";
  const MODULE_ROUTE = "#module/m07";
  const HANDOFF_CHANNEL = "ofw.m07.prototype.handoff.v1";
  const SCENARIO_CONTEXT_FIELDS = ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"];
  const root = document.getElementById("m07-workspace");
  const lensNav = document.getElementById("lens-nav");
  const selectionBar = document.getElementById("selection-bar");
  const objectPane = document.getElementById("object-pane");
  const objectList = document.getElementById("object-list");
  const objectCount = document.getElementById("object-count");
  const objectSearch = document.getElementById("object-search");
  const typeFilter = document.getElementById("type-filter");
  const qualityFilter = document.getElementById("quality-filter");
  const sortSelect = document.getElementById("sort-select");
  const viewHeader = document.getElementById("view-header");
  const viewStage = document.getElementById("view-stage");
  const contextContent = document.getElementById("context-content");
  const trustSummary = document.getElementById("trust-summary");
  const scenarioKicker = document.getElementById("scenario-kicker");
  const scenarioName = document.getElementById("scenario-name");
  const roleLabelNode = document.getElementById("role-label");
  const drawer = document.getElementById("action-drawer");
  const drawerBackdrop = document.getElementById("drawer-backdrop");
  const toastArea = document.getElementById("toast-area");

  const LENSES = [
    { id: "catalog", label: "对象目录", short: "找对象", icon: "list-filter" },
    { id: "object360", label: "对象全貌", short: "看全貌", icon: "scan-face" },
    { id: "graph", label: "关系网络", short: "看联系", icon: "share-2" },
    { id: "temporal", label: "时序分析", short: "看变化", icon: "chart-no-axes-combined" },
    { id: "spatial", label: "空间分析", short: "看位置", icon: "map" },
  ];

  const VIEW_COPY = {
    catalog: ["对象目录", "在获准范围内查找对象，单击预览，明确打开后进入对象全貌。"],
    object360: ["对象全貌", "集中核对对象属性、关系、质量、版本和证据。"],
    graph: ["关系网络", "以知识图谱方式查看一至两跳对象联系；选择节点不会改变当前中心。"],
    temporal: ["时序分析", "按系列和受治理时点查看数值、质量与规则事件。"],
    spatial: ["空间分析", "只在存在权威几何、坐标系和有效时间时呈现地图。"],
  };

  const PROPERTY_LABELS = {
    scenario: "场景标识",
    dataAsOf: "数据截至日",
    dataVersion: "数据版本",
    ontologyVersion: "本体版本",
    sourceRows: "来源记录数",
    entityCount: "融资主体数",
    financingBalance: "融资余额",
    weightedAverageCost: "加权平均融资成本",
    floatingRateRatio: "浮动利率余额占比",
    shortTermDebtRatio: "短期债务余额占比",
    sourceObjectId: "语义对象类型",
    unitRef: "融资主体引用",
    sourceCode: "来源编码",
    balance: "融资余额",
    averageFinancingCost: "余额加权平均融资成本",
    loanCount: "融资笔数",
    ruleCode: "规则编号",
    ruleName: "规则名称",
    ruleMetricLabel: "规则指标",
    ruleMetricValue: "规则指标值",
    ownerRef: "负责人引用",
    grain: "数据粒度",
    recordCount: "记录数",
    currency: "币种",
    rateType: "利率形式",
    termType: "期限类型",
    ruleId: "Rule 引用",
    status: "求值状态",
    metricLabel: "指标名称",
    observedValue: "观测值",
    threshold: "阈值",
    condition: "判断条件",
    evaluatedAt: "求值时间",
    evidenceType: "证据类型",
    sourceRefs: "来源引用",
    reportRef: "报告引用",
    displayName: "显示名称",
    candidateRole: "候选角色",
    priorityRank: "候选顺序",
    candidateFor: "候选对象",
    sourceInstitutionCode: "机构来源编码",
    reportId: "报告编号",
    contentVersion: "内容版本",
    evidencePackId: "证据包编号",
    geometry: "空间几何",
    validFrom: "有效时间起点",
    validTo: "有效时间终点",
  };

  const TYPE_COLORS = {
    "m01.object-type.financing-group": "#315fae",
    "m01.object-type.financing-entity": "#8a5c18",
    "m01.object-type.financing-detail": "#167565",
    "m01.object-type.financing-owner": "#685993",
    "m01.object-type.financing-rule-result": "#b4413e",
    "m01.object-type.financial-institution": "#167565",
    "m01.object-type.financing-institution": "#167565",
    "m07.object-type.report-evidence": "#52738c",
    "m07.object-type.report": "#315fae",
  };

  const MODULE_ACTIONS = {
    data: { label: "查看数据快照", target: "数据工程", detail: "核对来源、质量与资产版本", icon: "database" },
    ontology: { label: "查看语义定义", target: "本体管理", detail: "核对对象类型、属性和关系定义", icon: "network" },
    query: { label: "带入智能问数", target: "智能问数", detail: "以当前对象作为问数范围", icon: "sparkles" },
    decision: { label: "查看关联决策", target: "决策中心", detail: "进入受控行动和人工确认入口", icon: "target" },
    agent: { label: "交给 Agent", target: "Agent 应用", detail: "以固定证据启动受控解释", icon: "bot" },
    report: { label: "查看报告与证据", target: "报告中心", detail: "定位报告草稿和证据锚点", icon: "file-text" },
    dashboard: { label: "打开管理视图", target: "仪表盘", detail: "将探索范围带入当前评价驾驶舱", icon: "layout-dashboard" },
    modeling: { label: "进入模型与模拟", target: "模型与模拟", detail: "把对象、Lens、时序范围和版本交给 M08", icon: "activity" },
  };

  const ROUTE_BY_MODULE = {
    data: "#module/data",
    ontology: "#module/ontology",
    query: "#module/query",
    decision: "#module/decision",
    agent: "#module/agent",
    report: "#module/report",
    dashboard: "#dashboard",
    modeling: "#module/modeling",
  };

  let resource = null;
  let activeMap = null;
  let pendingModule = null;
  let state = null;
  let returnedModelResult = null;

  function escape(value) { return C.escapeHtml(value); }
  function icon(name) { return `<i data-lucide="${name}"></i>`; }
  function refreshIcons() {
    if (window.lucide?.createIcons) window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
  }
  function object(id = state.objectId) { return C.objectById(resource, id); }
  function allowed(item = object(), roleId = state.roleId) { return C.isAllowed(item, roleId); }
  function typeMeta(item) { return C.typeMeta(item); }
  function qualityMeta(value) { return C.qualityMeta(value); }
  function roleMeta(roleId = state.roleId) { return resource.roles.find((item) => item.id === roleId) || { id: roleId, label: roleId }; }
  function sourceRef(value) { return Array.isArray(value) ? value.filter(Boolean) : []; }
  function currentGraphRoot() { return object(state.graphRootId) || object(); }
  function currentGraphSelection() {
    const candidate = object(state.graphSelectedId);
    return candidate && allowed(candidate) ? candidate : currentGraphRoot();
  }

  function scenarioAsOf() {
    return resource.scenarioContext.dataAsOf || resource.source.asOf || resource.source.dateRange.to || "未提供";
  }

  function dataVersionId() {
    return resource.sourceContract?.dataAssetVersion
      || resource.source?.sourceAssetVersion
      || resource.moduleResources?.dataEngineering?.assets?.[0]
      || `${resource.scenarioContext.scenarioId}-M07-RESEARCH`;
  }

  function isCandidateSemanticReference() {
    return resource.ontologyContext?.definitionMode === "candidate-reference";
  }

  function semanticModeLabel() {
    return isCandidateSemanticReference() ? "候选语义" : "Published";
  }

  function activeScenarioContext() {
    return Object.freeze(Object.fromEntries(SCENARIO_CONTEXT_FIELDS.map((field) => [field, resource.scenarioContext[field]])));
  }

  function applyHostScenarioContext(params) {
    const requiresHostContext = resource.scenarioContext.scenarioId === "S005";
    const missingFields = SCENARIO_CONTEXT_FIELDS.filter((field) => !params.has(field) || !params.get(field));
    if (requiresHostContext && missingFields.length) {
      throw new Error(`S005 缺少宿主场景字段：${missingFields.join(", ")}`);
    }
    const hostValues = Object.fromEntries(SCENARIO_CONTEXT_FIELDS
      .filter((field) => params.has(field))
      .map((field) => [field, params.get(field)]));
    if (!Object.keys(hostValues).length) return;
    if (hostValues.scenarioId && hostValues.scenarioId !== resource.scenarioContext.scenarioId) {
      throw new Error("宿主场景与探索资源不匹配");
    }
    const next = { ...resource.scenarioContext, ...hostValues };
    if (next.scenarioId === "S005") {
      if (next.scenarioVersion !== "S005-v1") throw new Error("S005 场景版本必须为 S005-v1");
      if (!/^S005-RUN-[0-9]{17}-[a-f0-9]{12}$/.test(next.scenarioRunId || "")) throw new Error("S005 场景轮次格式无效");
      if (!next.formedAt || Number.isNaN(Date.parse(next.formedAt))) throw new Error("S005 场景形成时间无效");
      if (next.status !== "active") throw new Error("S005 当前场景必须为 active");
    }
    resource.scenarioContext = next;
  }

  function toast(message, tone = "info") {
    const item = document.createElement("div");
    const iconName = tone === "success" ? "circle-check" : tone === "warning" ? "triangle-alert" : tone === "danger" ? "circle-x" : "info";
    item.className = `toast ${tone}`;
    item.innerHTML = `${icon(iconName)}<span>${escape(message)}</span>`;
    toastArea.append(item);
    refreshIcons();
    window.setTimeout(() => item.remove(), 3200);
  }

  function defaultState() {
    const preferred = resource.objects.find((item) => item.id === "s001.entity.553") || resource.objects[0];
    return {
      lens: "catalog",
      objectId: preferred?.id || null,
      roleId: "m07.analyst",
      search: "",
      typeFilter: "all",
      qualityFilter: "all",
      sort: "title",
      objectTab: "properties",
      graphRootId: preferred?.id || null,
      graphSelectedId: preferred?.id || null,
      graphHops: 2,
      graphQuality: ["passed", "warning", "blocked"],
      graphZoom: 1,
      seriesIds: [],
      transform: "raw",
      temporalFrom: resource.source.dateRange.from,
      temporalTo: resource.source.dateRange.to,
      eventsVisible: true,
      mapLayers: ["objects"],
      bbox: null,
      returnFrom: null,
      returnPosition: null,
    };
  }

  function parseCsv(value) { return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : []; }

  function readStateFromUrl() {
    const next = defaultState();
    const params = new URLSearchParams(location.search);
    if (LENSES.some((item) => item.id === params.get("lens"))) next.lens = params.get("lens");
    if (params.get("object") && object(params.get("object"))) next.objectId = params.get("object");
    if (resource.roles.some((item) => item.id === params.get("role"))) next.roleId = params.get("role");
    next.search = params.get("q") || "";
    next.typeFilter = params.get("type") || "all";
    next.qualityFilter = params.get("quality") || "all";
    next.sort = ["title", "type", "quality"].includes(params.get("sort")) ? params.get("sort") : "title";
    next.objectTab = ["properties", "links", "quality", "version", "evidence"].includes(params.get("panel")) ? params.get("panel") : "properties";
    next.graphRootId = object(params.get("root"))?.id || next.objectId;
    next.graphSelectedId = object(params.get("selected"))?.id || next.graphRootId;
    next.graphHops = params.get("hops") === "1" ? 1 : 2;
    next.graphQuality = parseCsv(params.get("graphQuality")).filter((item) => ["passed", "warning", "blocked"].includes(item));
    if (!next.graphQuality.length) next.graphQuality = ["passed", "warning", "blocked"];
    const zoom = Number(params.get("zoom"));
    next.graphZoom = Number.isFinite(zoom) ? Math.min(1.4, Math.max(.72, zoom)) : 1;
    next.seriesIds = parseCsv(params.get("series"));
    next.transform = ["raw", "rolling", "diff"].includes(params.get("transform")) ? params.get("transform") : "raw";
    next.temporalFrom = params.get("from") || next.temporalFrom;
    next.temporalTo = params.get("to") || next.temporalTo;
    next.eventsVisible = params.get("events") !== "off";
    next.mapLayers = parseCsv(params.get("layers"));
    if (!next.mapLayers.length) next.mapLayers = ["objects"];
    const bbox = parseCsv(params.get("bbox")).map(Number);
    next.bbox = bbox.length === 4 && bbox.every(Number.isFinite) ? bbox : null;
    next.returnFrom = params.get("returnFrom") || null;
    next.returnPosition = params.get("position") || null;
    return next;
  }

  function updateUrl(mode = "replace", sourceState = state) {
    const current = new URLSearchParams(location.search);
    const params = new URLSearchParams();
    ["embedded", "resource"].forEach((key) => {
      if (current.has(key)) params.set(key, current.get(key));
    });
    const scenarioContext = activeScenarioContext();
    SCENARIO_CONTEXT_FIELDS.forEach((key) => params.set(key, scenarioContext[key]));
    params.set("lens", sourceState.lens);
    if (sourceState.objectId) params.set("object", sourceState.objectId);
    params.set("role", sourceState.roleId);
    if (sourceState.search) params.set("q", sourceState.search);
    if (sourceState.typeFilter !== "all") params.set("type", sourceState.typeFilter);
    if (sourceState.qualityFilter !== "all") params.set("quality", sourceState.qualityFilter);
    if (sourceState.sort !== "title") params.set("sort", sourceState.sort);
    if (sourceState.objectTab !== "properties") params.set("panel", sourceState.objectTab);
    if (sourceState.lens === "graph") {
      params.set("root", sourceState.graphRootId || sourceState.objectId);
      if (sourceState.graphSelectedId) params.set("selected", sourceState.graphSelectedId);
      params.set("hops", String(sourceState.graphHops));
      params.set("graphQuality", sourceState.graphQuality.join(","));
      if (sourceState.graphZoom !== 1) params.set("zoom", sourceState.graphZoom.toFixed(2));
    }
    if (sourceState.lens === "temporal") {
      if (sourceState.seriesIds.length) params.set("series", sourceState.seriesIds.join(","));
      params.set("transform", sourceState.transform);
      params.set("from", sourceState.temporalFrom);
      params.set("to", sourceState.temporalTo);
      params.set("events", sourceState.eventsVisible ? "on" : "off");
    }
    if (sourceState.lens === "spatial") {
      params.set("layers", sourceState.mapLayers.join(","));
      if (sourceState.bbox) params.set("bbox", sourceState.bbox.map((value) => Number(value).toFixed(4)).join(","));
    }
    if (sourceState.returnFrom) params.set("returnFrom", sourceState.returnFrom);
    if (sourceState.returnPosition) params.set("position", sourceState.returnPosition);
    params.set("publishedSemanticVersionId", resource.ontologyContext.publishedSemanticVersionId);
    params.set("bindingId", resource.ontologyContext.authoritativeBindingId);
    params.set("dataVersion", dataVersionId());
    const next = `${location.pathname}?${params.toString()}`;
    if (mode === "push") history.pushState({ m07Workspace: true }, "", next);
    else history.replaceState({ m07Workspace: true }, "", next);
  }

  function setState(patch, options = {}) {
    state = { ...state, ...patch };
    updateUrl(options.history || "replace");
    if (options.render !== false) renderAll();
  }

  function filteredObjects() {
    return C.filteredObjects(resource, {
      roleId: state.roleId,
      search: state.search,
      typeFilter: state.typeFilter,
      qualityFilter: state.qualityFilter,
      sort: state.sort,
      currentObjectId: state.objectId,
    });
  }

  function objectSeries(item = object()) {
    if (!item || !allowed(item)) return [];
    return resource.series.filter((series) => series.ownerObjectId === item.id);
  }

  function objectLinks(item = object()) {
    if (!item || !allowed(item)) return [];
    return C.visibleLinksForObject(resource, item.id, state.roleId);
  }

  function propertyLabel(key) {
    return PROPERTY_LABELS[key] || key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
  }

  function propertyDisplay(property) {
    if (!property) return { value: "未提供", tone: "neutral", note: "该属性未进入当前读取投影" };
    if (property.state === "not_applicable") return { value: "不适用", tone: "neutral", note: property.note || "当前对象不适用该属性" };
    if (property.state === "missing") return { value: "缺数据", tone: "warning", note: property.note || "权威来源未提供观测值" };
    if (property.state === "redacted") return { value: "访问拒绝", tone: "danger", note: property.note || "当前角色不能读取该值" };
    if (property.state === "quality_blocked") return { value: "质量阻断", tone: "danger", note: property.note || "当前值未通过质量门" };
    let value = property.value;
    if (Array.isArray(value)) value = value.join("、");
    else if (value && typeof value === "object") value = JSON.stringify(value);
    else if (typeof value === "number") value = value.toLocaleString("zh-CN", { maximumFractionDigits: 6 });
    else if (value == null || value === "") value = "未提供";
    else value = String(value);
    if (property.unit && value !== "未提供") value = `${value} ${property.unit}`;
    return {
      value,
      tone: property.quality === "blocked" ? "danger" : property.quality === "warning" ? "warning" : "success",
      note: property.note || `${sourceRef(property.sourceRefs).length || 0} 个来源引用`,
    };
  }

  function projectionLabel(item) {
    if (item.objectTypeId?.startsWith("m07.")) return "证据引用";
    if (item.sourceObjectId) return isCandidateSemanticReference() ? "候选对象" : "Published 对象";
    return "场景容器";
  }

  function renderToolbar() {
    scenarioKicker.textContent = `${resource.scenarioContext.scenarioId} · 只读探索`;
    scenarioName.textContent = resource.scenarioContext.scenarioName || `${resource.scenarioContext.scenarioId} 场景`;
    trustSummary.innerHTML = `<span><i></i>${escape(semanticModeLabel())} ${escape(resource.ontologyContext.publishedSemanticVersionId)}</span><span>截至 ${escape(scenarioAsOf())}</span>`;
    roleLabelNode.textContent = roleMeta().label;
    objectSearch.value = state.search;
    qualityFilter.value = state.qualityFilter;
    sortSelect.value = state.sort;
  }

  function renderLensNav() {
    lensNav.innerHTML = LENSES.map((lens) => `
      <button class="lens-button ${state.lens === lens.id ? "active" : ""}" type="button" data-lens="${lens.id}" aria-current="${state.lens === lens.id ? "page" : "false"}">
        ${icon(lens.icon)}<span><strong>${lens.label}</strong><small>${lens.short}</small></span>
      </button>`).join("");
    lensNav.querySelectorAll("[data-lens]").forEach((button) => button.addEventListener("click", () => openLens(button.dataset.lens)));
  }

  function renderSelectionBar() {
    const current = object();
    const canRead = allowed(current);
    const meta = typeMeta(current);
    const q = canRead ? qualityMeta(current?.quality) : { label: "访问拒绝", className: "danger" };
    const returnReceipt = state.returnFrom && MODULE_ACTIONS[state.returnFrom]
      ? `<button class="return-chip" type="button" data-clear-return title="关闭返回提示">${icon("corner-up-left")}已从${escape(MODULE_ACTIONS[state.returnFrom].target)}返回${icon("x")}</button>`
      : "";
    selectionBar.innerHTML = `
      <div class="selection-main">
        <span class="selection-symbol">${icon(canRead ? meta.icon : "lock-keyhole")}</span>
        <div class="selection-copy"><strong>${canRead ? escape(current?.title || "未选择对象") : "受限对象"}</strong><span>${canRead ? `${escape(meta.label)} · ${escape(current?.subtitle || "")}` : "对象引用已保留；当前角色不能读取对象内容"}</span></div>
        <span class="quality-chip ${q.className}"><i></i>${escape(q.label)}</span>${returnReceipt}
      </div>
      <div class="selection-meta">
        <div class="identity-token"><span>ObjectRef</span><code>${canRead ? escape(current?.id || "none") : "REDACTED"}</code></div>
        <div class="identity-token"><span>${escape(semanticModeLabel())}</span><code>${escape(resource.ontologyContext.publishedSemanticVersionId)}</code></div>
        <div class="identity-token"><span>场景轮次</span><code>${escape(resource.scenarioContext.scenarioRunId)}</code></div>
      </div>`;
    selectionBar.querySelector("[data-clear-return]")?.addEventListener("click", () => setState({ returnFrom: null }));
  }

  function renderObjectPane() {
    const allowedObjects = C.allowedObjects(resource, state.roleId);
    const typeIds = [...new Set(allowedObjects.map((item) => item.objectTypeId))].sort((a, b) => typeMeta(a).label.localeCompare(typeMeta(b).label, "zh-CN"));
    typeFilter.innerHTML = `<option value="all">全部类型</option>${typeIds.map((typeId) => `<option value="${escape(typeId)}">${escape(typeMeta(typeId).label)}</option>`).join("")}`;
    if (!typeIds.includes(state.typeFilter)) state.typeFilter = "all";
    typeFilter.value = state.typeFilter;
    const rows = filteredObjects();
    objectCount.textContent = String(rows.length);
    objectPane.querySelector(".pane-header h2").textContent = state.lens === "catalog" ? "筛选对象" : "切换对象";
    if (state.lens === "catalog") {
      const facetRows = C.filteredObjects(resource, {
        roleId: state.roleId,
        search: state.search,
        typeFilter: "all",
        qualityFilter: state.qualityFilter,
        sort: "type",
      });
      objectList.setAttribute("role", "navigation");
      objectList.setAttribute("aria-label", "对象类型分布");
      objectList.innerHTML = `<button class="facet-row ${state.typeFilter === "all" ? "selected" : ""}" type="button" data-type-facet="all"><span class="object-row-icon">${icon("shapes")}</span><span><strong>全部对象</strong><small>当前搜索与质量范围</small></span><b>${facetRows.length}</b></button>${typeIds.map((typeId) => {
        const count = facetRows.filter((item) => item.objectTypeId === typeId).length;
        return `<button class="facet-row ${state.typeFilter === typeId ? "selected" : ""}" type="button" data-type-facet="${escape(typeId)}"><span class="object-row-icon">${icon(typeMeta(typeId).icon)}</span><span><strong>${escape(typeMeta(typeId).label)}</strong><small>${count ? "有可见结果" : "当前条件无结果"}</small></span><b>${count}</b></button>`;
      }).join("")}`;
      objectList.querySelectorAll("[data-type-facet]").forEach((button) => button.addEventListener("click", () => setState({ typeFilter: button.dataset.typeFacet })));
      return;
    }
    objectList.setAttribute("role", "listbox");
    objectList.setAttribute("aria-label", "可见对象");
    objectList.innerHTML = rows.map((item) => {
      const meta = typeMeta(item);
      return `<button type="button" role="option" aria-selected="${item.id === state.objectId}" class="object-row ${item.id === state.objectId ? "selected" : ""}" data-object-id="${escape(item.id)}">
        <span class="object-row-icon">${icon(meta.icon)}</span><span class="object-row-copy"><strong>${escape(item.title)}</strong><span>${escape(meta.label)} · ${escape(item.id)}</span></span><i class="quality-dot ${escape(item.quality)}" title="${escape(qualityMeta(item.quality).label)}"></i>
      </button>`;
    }).join("") || `<div class="object-empty">${icon("search-x")}<strong>没有匹配对象</strong><br>调整搜索或筛选条件后重试。</div>`;
    objectList.querySelectorAll("[data-object-id]").forEach((button) => {
      button.addEventListener("click", () => previewObject(button.dataset.objectId));
      button.addEventListener("dblclick", () => openObject(button.dataset.objectId));
    });
  }

  function renderViewHeader() {
    const [title, copy] = VIEW_COPY[state.lens];
    const actions = {
      catalog: `<button class="view-action" data-view-action="reset-filters">${icon("rotate-ccw")}<span>重置筛选</span></button>`,
      object360: `<button class="view-action" data-open-lens="graph">${icon("share-2")}<span>查看关系</span></button><button class="view-action" data-open-lens="temporal">${icon("chart-no-axes-combined")}<span>查看时序</span></button>`,
      graph: `<button class="view-action" data-open-lens="object360">${icon("scan-face")}<span>对象全貌</span></button>`,
      temporal: `<button class="view-action" data-open-lens="object360">${icon("scan-face")}<span>对象全貌</span></button>`,
      spatial: `<button class="view-action" data-open-lens="graph">${icon("share-2")}<span>关系网络</span></button>`,
    }[state.lens];
    viewHeader.innerHTML = `<div class="view-title"><h1>${title}</h1><p>${copy}</p></div><div class="view-actions">${actions || ""}</div>`;
    viewHeader.querySelectorAll("[data-open-lens]").forEach((button) => button.addEventListener("click", () => openLens(button.dataset.openLens)));
    viewHeader.querySelector('[data-view-action="reset-filters"]')?.addEventListener("click", resetFilters);
  }

  function renderCatalog() {
    const rows = filteredObjects();
    const tableRows = rows.map((item) => {
      const meta = typeMeta(item);
      const q = qualityMeta(item.quality);
      const links = C.visibleLinksForObject(resource, item.id, state.roleId).length;
      const series = resource.series.filter((entry) => entry.ownerObjectId === item.id).length;
      return `<tr class="${item.id === state.objectId ? "preview" : ""}" data-preview-object="${escape(item.id)}" tabindex="0">
        <td><div class="catalog-object"><span class="object-row-icon">${icon(meta.icon)}</span><div><strong>${escape(item.title)}</strong><small>${escape(item.id)}</small></div></div></td>
        <td>${escape(meta.label)}</td><td><span class="state-chip ${q.className}"><i></i>${escape(q.label)}</span></td><td>${links} 条</td><td>${series || "—"}</td><td>${escape(projectionLabel(item))}</td>
        <td><button class="row-open" type="button" data-open-object="${escape(item.id)}" title="打开对象全貌" aria-label="打开 ${escape(item.title)} 的对象全貌">${icon("arrow-right")}</button></td>
      </tr>`;
    }).join("");
    const mobileRows = rows.map((item) => `<button class="catalog-mobile-item ${item.id === state.objectId ? "preview" : ""}" type="button" data-open-object="${escape(item.id)}"><span class="object-row-icon">${icon(typeMeta(item).icon)}</span><div><strong>${escape(item.title)}</strong><span>${escape(typeMeta(item).label)} · ${escape(qualityMeta(item.quality).label)}</span></div>${icon("arrow-right")}</button>`).join("");
    viewStage.innerHTML = rows.length ? `
      <div class="catalog-table-wrap"><table class="catalog-table"><thead><tr><th style="width:31%">对象</th><th style="width:14%">类型</th><th style="width:13%">质量</th><th style="width:9%">关系</th><th style="width:9%">系列</th><th style="width:15%">来源边界</th><th style="width:44px"></th></tr></thead><tbody>${tableRows}</tbody></table></div>
      <div class="catalog-mobile-list">${mobileRows}</div>` : `<div class="object-empty">${icon("search-x")}<strong>当前筛选没有可见对象</strong><br>清除搜索、类型或质量筛选后继续。</div>`;
    viewStage.querySelectorAll("[data-preview-object]").forEach((row) => {
      const preview = () => previewObject(row.dataset.previewObject);
      row.addEventListener("click", (event) => { if (!event.target.closest("button")) preview(); });
      row.addEventListener("dblclick", () => openObject(row.dataset.previewObject));
      row.addEventListener("keydown", (event) => { if (event.key === "Enter") openObject(row.dataset.previewObject); });
    });
    viewStage.querySelectorAll("[data-open-object]").forEach((button) => button.addEventListener("click", (event) => { event.stopPropagation(); openObject(button.dataset.openObject); }));
  }

  function renderProperties(current) {
    const rows = Object.entries(current.properties || {}).map(([key, property]) => {
      const display = propertyDisplay(property);
      const sourceCount = sourceRef(property?.sourceRefs).length;
      return `<div class="property-row"><div class="property-label"><span>${escape(propertyLabel(key))}</span><small>${escape(key)}</small></div><div class="property-value"><strong>${escape(display.value)}</strong><small>${escape(display.note)}${sourceCount && property?.note ? ` · ${sourceCount} 个来源` : ""}</small></div></div>`;
    }).join("");
    const series = objectSeries(current);
    return `<div class="property-list">${rows}</div>${series.length ? `<div class="section-row"><span class="section-icon">${icon("chart-no-axes-combined")}</span><div class="section-row-copy"><strong>${series.length} 条时序系列</strong><span>${escape(resource.source.dateRange.from)} 至 ${escape(resource.source.dateRange.to)} · ${resource.source.snapshots.length} 个受治理时点</span></div><div class="section-row-actions"><button class="inline-button" data-open-lens="temporal">查看时序${icon("arrow-right")}</button></div></div>` : ""}`;
  }

  function renderLinks(current) {
    const links = objectLinks(current);
    if (!links.length) return `<div class="object-empty">${icon("unlink")}<strong>没有可见关系</strong><br>未授权关系不会显示，也不会暴露度数。</div>`;
    return `<div class="section-list">${links.map((link) => {
      const target = C.linkedObject(resource, link, current.id);
      const direction = link.from === current.id ? "出向" : "入向";
      const q = qualityMeta(link.quality);
      return `<div class="section-row"><span class="section-icon">${icon("git-branch")}</span><div class="section-row-copy"><strong>${escape(C.linkMeta(link).label)} · ${escape(target?.title || "不可见对象")}</strong><span>${direction} Link · ${escape(typeMeta(target).label)} · ${escape(q.label)}</span></div><div class="section-row-actions"><button class="inline-button" data-preview-related="${escape(target?.id || "")}">查看对象</button><button class="inline-button" data-graph-target="${escape(target?.id || "")}">关系网络</button></div></div>`;
    }).join("")}</div>`;
  }

  function renderQuality(current) {
    const q = qualityMeta(current.quality);
    const propertyValues = Object.values(current.properties || {});
    const blocked = propertyValues.filter((item) => item?.state === "quality_blocked" || item?.quality === "blocked").length;
    const warning = propertyValues.filter((item) => item?.quality === "warning" || item?.state === "missing").length;
    return `<div class="status-banner ${q.className}"><span>${icon(q.icon)}</span><div><h3>${escape(q.label)}</h3><p>${escape((current.qualityNotes || [`对象级质量状态已随当前${semanticModeLabel()}投影读取。`])[0])}</p></div></div><dl class="fact-list"><div><dt>属性检查</dt><dd>${propertyValues.length} 项</dd></div><div><dt>质量警告</dt><dd>${warning} 项</dd></div><div><dt>质量阻断</dt><dd>${blocked} 项</dd></div><div><dt>传播规则</dt><dd>权限、质量、版本和证据独立传播</dd></div></dl>`;
  }

  function renderVersion(current) {
    return `<dl class="fact-list"><div><dt>ObjectRef</dt><dd><code>${escape(current.id)}</code></dd></div><div><dt>对象类型</dt><dd><code>${escape(current.objectTypeId)}</code></dd></div><div><dt>${escape(semanticModeLabel())}版本</dt><dd><code>${escape(resource.ontologyContext.publishedSemanticVersionId)}</code></dd></div><div><dt>消费绑定</dt><dd><code>${escape(resource.ontologyContext.authoritativeBindingId)}</code></dd></div><div><dt>数据版本</dt><dd><code>${escape(dataVersionId())}</code></dd></div><div><dt>稳定身份指纹</dt><dd><code>${escape(current.stableKeyFingerprint || "未提供")}</code></dd></div></dl><div class="section-row"><span class="section-icon">${icon("network")}</span><div class="section-row-copy"><strong>${escape(semanticModeLabel())}定义由本体管理拥有</strong><span>M07 只保存精确引用，不复制定义或生命周期。</span></div><div class="section-row-actions"><button class="inline-button" data-module="ontology">在本体管理打开</button></div></div>`;
  }

  function renderEvidence(current) {
    const refs = [...new Set([...(current.sourceRefs || []), ...Object.values(current.properties || {}).flatMap((property) => sourceRef(property?.sourceRefs))])];
    const evidenceObjects = objectLinks(current).map((link) => C.linkedObject(resource, link, current.id)).filter((item) => item?.objectTypeId === "m07.object-type.report-evidence");
    const rows = [
      ...evidenceObjects.map((item) => ({ icon: "file-check-2", title: item.title, detail: `${item.id} · 对象证据`, id: item.id })),
      ...resource.source.snapshots.map((item) => ({ icon: "database", title: `${item.date} 受治理快照`, detail: item.version || item.sha256 || item.id || "source-ref", id: `snapshot:${item.date}` })),
      ...refs.slice(0, 8).map((ref) => ({ icon: "link", title: ref, detail: "字段或对象来源引用", id: `ref:${ref}` })),
    ];
    if (!rows.length) return `<div class="object-empty">${icon("file-x")}<strong>没有可定位证据</strong><br>该状态不等同于质量通过。</div>`;
    return `<div class="section-list">${rows.map((item) => `<div class="section-row"><span class="section-icon">${icon(item.icon)}</span><div class="section-row-copy"><strong>${escape(item.title)}</strong><span>${escape(item.detail)}</span></div><div class="section-row-actions"><button class="inline-button" data-evidence-id="${escape(item.id)}">查看详情</button></div></div>`).join("")}</div>`;
  }

  function renderOverview() {
    const current = object();
    if (!current || !allowed(current)) {
      viewStage.innerHTML = deniedState("当前角色不能读取该对象的属性、关系、时序或证据。对象引用已保留，没有回退到其他对象。");
      bindDeniedState();
      return;
    }
    const tabs = [["properties", "属性"], ["links", "关系"], ["quality", "质量"], ["version", "版本"], ["evidence", "证据"]];
    const body = {
      properties: () => renderProperties(current),
      links: () => renderLinks(current),
      quality: () => renderQuality(current),
      version: () => renderVersion(current),
      evidence: () => renderEvidence(current),
    }[state.objectTab]();
    viewStage.innerHTML = `<nav class="overview-tabs" aria-label="对象全貌内容">${tabs.map(([id, label]) => `<button class="overview-tab ${state.objectTab === id ? "active" : ""}" type="button" data-overview-tab="${id}">${label}</button>`).join("")}</nav><section class="overview-body">${body}</section>`;
    viewStage.querySelectorAll("[data-overview-tab]").forEach((button) => button.addEventListener("click", () => setState({ objectTab: button.dataset.overviewTab })));
    viewStage.querySelectorAll("[data-open-lens]").forEach((button) => button.addEventListener("click", () => openLens(button.dataset.openLens)));
    viewStage.querySelectorAll("[data-preview-related]").forEach((button) => button.addEventListener("click", () => openObject(button.dataset.previewRelated)));
    viewStage.querySelectorAll("[data-graph-target]").forEach((button) => button.addEventListener("click", () => openGraph(button.dataset.graphTarget)));
    viewStage.querySelectorAll("[data-module]").forEach((button) => button.addEventListener("click", () => openHandoff(button.dataset.module)));
    viewStage.querySelectorAll("[data-evidence-id]").forEach((button) => button.addEventListener("click", () => openEvidence(button.dataset.evidenceId)));
  }

  function typeColor(item) { return TYPE_COLORS[item?.objectTypeId] || "#52738c"; }

  function graphSlice() {
    return C.graphSlice(resource, {
      currentObjectId: state.graphRootId,
      roleId: state.roleId,
      graphHops: state.graphHops,
      graphQuality: state.graphQuality,
      graphNodeCap: 200,
      graphEdgeCap: 400,
    });
  }

  function graphPositions(slice, width, height) {
    const groups = new Map();
    slice.nodes.forEach((node) => { const group = groups.get(node.hop) || []; group.push(node); groups.set(node.hop, group); });
    const positions = new Map();
    groups.forEach((group, hop) => {
      group.sort((a, b) => a.id.localeCompare(b.id));
      group.forEach((node, index) => {
        if (hop === 0) { positions.set(node.id, { x: width / 2, y: height / 2 }); return; }
        const radiusX = hop === 1 ? width * .23 : width * .39;
        const radiusY = hop === 1 ? height * .24 : height * .39;
        const angle = -Math.PI / 2 + (index / Math.max(group.length, 1)) * Math.PI * 2;
        positions.set(node.id, { x: width / 2 + Math.cos(angle) * radiusX, y: height / 2 + Math.sin(angle) * radiusY });
      });
    });
    return positions;
  }

  function renderGraph() {
    const graphRoot = currentGraphRoot();
    if (!graphRoot || !allowed(graphRoot)) {
      viewStage.innerHTML = deniedState("当前角色不能读取关系图中心对象。关系节点、边和度数均失败关闭。");
      bindDeniedState();
      return;
    }
    const slice = graphSlice();
    if (!slice.nodes.some((item) => item.id === state.graphSelectedId)) state.graphSelectedId = graphRoot.id;
    const width = 960;
    const height = 600;
    const positions = graphPositions(slice, width, height);
    const marker = `<defs><marker id="kg-arrow" viewBox="0 -5 10 10" refX="24" refY="0" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,-5L10,0L0,5" fill="#93a3b2"></path></marker></defs>`;
    const links = slice.links.map((link) => {
      const from = positions.get(link.from); const to = positions.get(link.to);
      if (!from || !to) return "";
      const qClass = link.quality === "blocked" ? "blocked" : link.quality === "warning" ? "warning" : "";
      return `<line class="kg-link ${qClass}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" marker-end="url(#kg-arrow)"></line><text class="kg-link-label" x="${(from.x + to.x) / 2}" y="${(from.y + to.y) / 2 - 6}" text-anchor="middle">${escape(C.linkMeta(link).label)}</text>`;
    }).join("");
    const nodes = slice.nodes.map((node) => {
      const point = positions.get(node.id);
      const selected = node.id === state.graphSelectedId;
      const isRoot = node.id === graphRoot.id;
      const radius = isRoot ? 19 : 15;
      const title = node.title.length > 15 ? `${node.title.slice(0, 15)}…` : node.title;
      return `<g class="kg-node ${selected ? "selected" : ""} ${isRoot ? "root" : ""}" data-graph-node="${escape(node.id)}" transform="translate(${point.x},${point.y})" tabindex="0" role="button" aria-label="选择 ${escape(node.title)}"><circle r="${radius}" fill="${typeColor(node)}"></circle><text x="${radius + 8}" y="1">${escape(title)}</text><text class="kg-type" x="${radius + 8}" y="14">${escape(typeMeta(node).label)}</text><title>${escape(node.title)} · ${escape(typeMeta(node).label)} · ${escape(qualityMeta(node.quality).label)}</title></g>`;
    }).join("");
    const viewWidth = width / state.graphZoom;
    const viewHeight = height / state.graphZoom;
    const viewX = (width - viewWidth) / 2;
    const viewY = (height - viewHeight) / 2;
    const types = [...new Set(slice.nodes.map((node) => node.objectTypeId))];
    viewStage.innerHTML = `<div class="graph-shell"><div class="graph-toolbar"><div class="graph-toolbar-group"><span class="pane-kicker">展开</span><div class="segmented"><button type="button" data-hops="1" class="${state.graphHops === 1 ? "active" : ""}">1 跳</button><button type="button" data-hops="2" class="${state.graphHops === 2 ? "active" : ""}">2 跳</button></div><div class="graph-quality"><button class="view-action" id="graph-quality-button" type="button">${icon("list-filter")}<span>关系质量</span></button><div class="quality-menu">${["passed", "warning", "blocked"].map((id) => `<label><input type="checkbox" data-graph-quality="${id}" ${state.graphQuality.includes(id) ? "checked" : ""}>${escape(qualityMeta(id).label)}</label>`).join("")}</div></div></div><div class="graph-toolbar-group"><button class="icon-button" id="zoom-out" type="button" title="缩小" aria-label="缩小">${icon("zoom-out")}</button><button class="icon-button" id="zoom-in" type="button" title="放大" aria-label="放大">${icon("zoom-in")}</button><button class="view-action" id="fit-graph" type="button">${icon("maximize-2")}<span>适配画布</span></button><button class="view-action" id="reset-graph" type="button">${icon("rotate-ccw")}<span>恢复中心</span></button></div></div><div class="graph-canvas"><svg id="knowledge-graph" viewBox="${viewX} ${viewY} ${viewWidth} ${viewHeight}" aria-label="${escape(resource.scenarioContext.scenarioId)} 对象关系网络">${marker}${links}${nodes}</svg><div class="graph-legend">${types.map((typeId) => `<span><i style="--legend-color:${typeColor({ objectTypeId: typeId })}"></i>${escape(typeMeta(typeId).label)}</span>`).join("")}</div></div></div>`;
    viewStage.querySelectorAll("[data-graph-node]").forEach((node) => {
      const select = () => setState({ graphSelectedId: node.dataset.graphNode }, { history: "replace" });
      node.addEventListener("click", select);
      node.addEventListener("dblclick", () => refocusGraph(node.dataset.graphNode));
      node.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(); } });
    });
    viewStage.querySelectorAll("[data-hops]").forEach((button) => button.addEventListener("click", () => setState({ graphHops: Number(button.dataset.hops), graphSelectedId: state.graphRootId }, { history: "push" })));
    document.getElementById("graph-quality-button")?.addEventListener("click", (event) => { event.stopPropagation(); event.currentTarget.closest(".graph-quality").classList.toggle("open"); });
    viewStage.querySelectorAll("[data-graph-quality]").forEach((input) => input.addEventListener("change", () => {
      const values = [...viewStage.querySelectorAll("[data-graph-quality]:checked")].map((item) => item.dataset.graphQuality);
      setState({ graphQuality: values.length ? values : ["passed"] });
    }));
    document.getElementById("zoom-out")?.addEventListener("click", () => setState({ graphZoom: Math.max(.72, state.graphZoom - .14) }));
    document.getElementById("zoom-in")?.addEventListener("click", () => setState({ graphZoom: Math.min(1.4, state.graphZoom + .14) }));
    document.getElementById("fit-graph")?.addEventListener("click", () => { setState({ graphZoom: 1 }); toast("关系网络已适配当前画布", "success"); });
    document.getElementById("reset-graph")?.addEventListener("click", () => setState({ graphRootId: state.objectId, graphSelectedId: state.objectId, graphZoom: 1 }, { history: "push" }));
  }

  function temporalSeries() {
    const series = objectSeries();
    if (!series.length) return { all: [], selected: [] };
    const validIds = state.seriesIds.filter((id) => series.some((item) => item.id === id));
    const selected = validIds.length ? series.filter((item) => validIds.includes(item.id)) : series.slice(0, 4);
    return { all: series, selected };
  }

  function transformedPoints(series) {
    const points = series.points.filter((point) => point.t >= state.temporalFrom && point.t <= state.temporalTo);
    if (state.transform === "diff") return points.map((point, index) => ({ ...point, v: index && point.v != null && points[index - 1].v != null ? point.v - points[index - 1].v : null }));
    if (state.transform === "rolling") return points.map((point, index) => {
      const values = points.slice(Math.max(0, index - 3), index + 1).map((item) => item.v).filter((value) => value != null);
      return { ...point, v: values.length === 4 ? values.reduce((sum, value) => sum + value, 0) / values.length : null };
    });
    return points.map((point) => ({ ...point }));
  }

  function renderTemporal() {
    const current = object();
    if (!current || !allowed(current)) {
      viewStage.innerHTML = deniedState("当前角色不能读取该对象的时序系列或事件。");
      bindDeniedState();
      return;
    }
    const { all, selected } = temporalSeries();
    if (!all.length) {
      viewStage.innerHTML = `<div class="status-banner warning"><span>${icon("chart-no-axes-combined")}</span><div><h3>当前对象没有可见时序系列</h3><p>不会从其他对象回退系列，也不会用同名指标替代。</p></div></div><div class="section-row"><span class="section-icon">${icon("scan-face")}</span><div class="section-row-copy"><strong>返回对象全貌</strong><span>继续查看当前对象的属性、质量和证据。</span></div><div class="section-row-actions"><button class="inline-button" data-open-lens="object360">对象全貌</button></div></div>`;
      viewStage.querySelector("[data-open-lens]")?.addEventListener("click", () => openLens("object360"));
      return;
    }
    const maxPoints = Math.max(...all.map((series) => series.points.length));
    const canDiff = maxPoints >= 2;
    const canRolling = maxPoints >= 4;
    if ((state.transform === "diff" && !canDiff) || (state.transform === "rolling" && !canRolling)) state.transform = "raw";
    const events = resource.events.filter((event) => event.objectId === current.id && event.t >= state.temporalFrom && event.t <= state.temporalTo);
    const selectors = all.map((series) => {
      const active = selected.some((item) => item.id === series.id);
      const latest = series.points.at(-1);
      return `<label class="series-option"><input type="checkbox" data-series="${escape(series.id)}" ${active ? "checked" : ""}><div><strong>${escape(series.label)}</strong><span>${latest?.v == null ? "缺数据" : `${Number(latest.v).toLocaleString("zh-CN", { maximumFractionDigits: 6 })} ${escape(series.unit || "")}`} · ${series.points.length} 时点</span></div></label>`;
    }).join("");
    const panels = selected.map((series) => `<article class="temporal-panel" data-temporal-series="${escape(series.id)}"><div class="series-summary"><strong>${escape(series.label)}</strong><span class="series-value">${series.points.at(-1)?.v == null ? "—" : `${Number(series.points.at(-1).v).toLocaleString("zh-CN", { maximumFractionDigits: 6 })} ${escape(series.unit || "")}`}</span><span>${escape(series.timeSeriesRef?.granularity || series.granularity || "受治理时点")}</span><small>${escape(series.note || "缺失保持缺失，不前值填充。")}</small></div><div class="series-chart"><svg aria-label="${escape(series.label)} 时序图"></svg></div></article>`).join("");
    const eventRows = events.map((event) => {
      const ruleObject = ruleObjectForEvent(event);
      return `<button class="event-row" type="button" data-event-object="${escape(ruleObject?.id || event.objectId)}"><span>${icon("circle-alert")}</span><div><strong>${escape(event.ruleId)}</strong><small>${escape(event.t)} · ${escape(event.state)} · ${escape(qualityMeta(event.quality).label)}</small></div>${icon("arrow-right")}</button>`;
    }).join("");
    viewStage.innerHTML = `<div class="temporal-shell"><div class="temporal-toolbar"><div class="temporal-toolbar-group"><span class="pane-kicker">时间范围</span><label class="date-control">从 <input id="temporal-from" type="date" value="${escape(state.temporalFrom)}"></label><label class="date-control">至 <input id="temporal-to" type="date" value="${escape(state.temporalTo)}"></label></div><div class="temporal-toolbar-group"><div class="segmented"><button type="button" data-transform="raw" class="${state.transform === "raw" ? "active" : ""}">原值</button><button type="button" data-transform="rolling" class="${state.transform === "rolling" ? "active" : ""}" ${canRolling ? "" : "disabled"}>4 期滚动</button><button type="button" data-transform="diff" class="${state.transform === "diff" ? "active" : ""}" ${canDiff ? "" : "disabled"}>差分</button></div><button class="view-action ${state.eventsVisible ? "primary" : ""}" id="toggle-events" type="button">${icon("flag")}<span>规则事件</span></button></div></div><div class="series-selector" aria-label="系列选择">${selectors}</div>${maxPoints < 2 ? `<div class="history-gate"><span>${icon("triangle-alert")}</span><div><strong>只有 1 个受治理时点，不能形成趋势</strong><small>滚动和差分至少需要 4/2 个时点；当前只定位 2025-12-31 的权威快照和同日规则事件。</small></div></div>` : ""}<div class="temporal-panels">${panels || `<div class="object-empty">未选择系列</div>`}</div>${state.eventsVisible ? `<section class="event-list"><h3>规则事件 · ${events.length}</h3>${eventRows || `<div class="object-empty">当前对象和范围内没有规则事件。</div>`}</section>` : ""}</div>`;
    viewStage.querySelectorAll("[data-series]").forEach((input) => input.addEventListener("change", () => {
      const ids = [...viewStage.querySelectorAll("[data-series]:checked")].map((item) => item.dataset.series);
      if (ids.length > 4) { toast("一次最多叠加 4 条系列", "warning"); renderAll(); return; }
      setState({ seriesIds: ids });
    }));
    viewStage.querySelectorAll("[data-transform]").forEach((button) => button.addEventListener("click", () => setState({ transform: button.dataset.transform }, { history: "push" })));
    document.getElementById("temporal-from")?.addEventListener("change", (event) => setState({ temporalFrom: event.target.value }));
    document.getElementById("temporal-to")?.addEventListener("change", (event) => setState({ temporalTo: event.target.value }));
    document.getElementById("toggle-events")?.addEventListener("click", () => setState({ eventsVisible: !state.eventsVisible }));
    viewStage.querySelectorAll("[data-event-object]").forEach((button) => button.addEventListener("click", () => openObject(button.dataset.eventObject, "evidence")));
    drawTemporalPanels(selected);
  }

  function drawTemporalPanels(seriesList) {
    if (!window.d3) return;
    seriesList.forEach((series, seriesIndex) => {
      const article = [...viewStage.querySelectorAll("[data-temporal-series]")].find((item) => item.dataset.temporalSeries === series.id);
      const svg = article?.querySelector("svg");
      if (!svg) return;
      const width = svg.clientWidth || 640;
      const height = 136;
      const margin = { top: 16, right: 20, bottom: 24, left: 50 };
      const points = transformedPoints(series).map((point) => ({ ...point, date: new Date(`${point.t}T00:00:00+08:00`) }));
      const values = points.map((point) => point.v).filter((value) => value != null);
      const selection = d3.select(svg).attr("viewBox", `0 0 ${width} ${height}`);
      selection.selectAll("*").remove();
      if (!points.length || !values.length) {
        selection.append("text").attr("x", width / 2).attr("y", height / 2).attr("text-anchor", "middle").text("当前范围没有可绘制观测值");
        return;
      }
      const color = C.SERIES_COLORS[seriesIndex % C.SERIES_COLORS.length];
      const xDomain = points.length === 1 ? [new Date(points[0].date.getTime() - 86400000), new Date(points[0].date.getTime() + 86400000)] : d3.extent(points, (point) => point.date);
      const x = d3.scaleTime().domain(xDomain).range([margin.left, width - margin.right]);
      const extent = d3.extent(values); const pad = (extent[1] - extent[0] || Math.abs(extent[0]) || 1) * .12;
      const y = d3.scaleLinear().domain([extent[0] - pad, extent[1] + pad]).nice().range([height - margin.bottom, margin.top]);
      selection.append("g").selectAll("line").data(y.ticks(3)).join("line").attr("class", "grid").attr("x1", margin.left).attr("x2", width - margin.right).attr("y1", (value) => y(value)).attr("y2", (value) => y(value));
      selection.append("line").attr("class", "axis").attr("x1", margin.left).attr("x2", width - margin.right).attr("y1", height - margin.bottom).attr("y2", height - margin.bottom);
      if (points.length > 1) {
        const line = d3.line().defined((point) => point.v != null).x((point) => x(point.date)).y((point) => y(point.v));
        selection.append("path").datum(points).attr("d", line).attr("fill", "none").attr("stroke", color).attr("stroke-width", 2);
      } else {
        selection.append("line").attr("class", "point-stem").attr("x1", x(points[0].date)).attr("x2", x(points[0].date)).attr("y1", margin.top).attr("y2", height - margin.bottom);
      }
      selection.selectAll("circle.point").data(points.filter((point) => point.v != null)).join("circle").attr("class", "point").attr("cx", (point) => x(point.date)).attr("cy", (point) => y(point.v)).attr("r", 5).attr("fill", color);
      selection.append("text").attr("x", margin.left).attr("y", height - 7).text(points[0].t);
      selection.append("text").attr("x", width - margin.right).attr("y", height - 7).attr("text-anchor", "end").text(points.at(-1).t);
      selection.append("text").attr("x", width - margin.right).attr("y", margin.top + 2).attr("text-anchor", "end").text(`${values.at(-1).toLocaleString("zh-CN", { maximumFractionDigits: 6 })} ${series.unit || ""}`);
    });
  }

  function ruleObjectForEvent(event) {
    return resource.objects.find((item) => item.objectTypeId === "m01.object-type.financing-rule-result" && item.properties?.ruleId?.value === event.ruleId && item.scenarioId === resource.scenarioContext.scenarioId) || null;
  }

  function geometryOf(item) { return C.geometryOf(item); }

  function renderSpatial() {
    const current = object();
    if (!current || !allowed(current)) {
      viewStage.innerHTML = deniedState("当前角色不能读取该对象的空间属性。");
      bindDeniedState();
      return;
    }
    const geometry = geometryOf(current);
    if (!geometry) {
      viewStage.innerHTML = `<div class="spatial-gate"><section class="spatial-primary"><span class="spatial-state-icon">${icon("map-pinned")}</span><h2>当前对象不适用空间分析</h2><p>${escape(resource.scenarioContext.scenarioId)} 来源没有提供可证明的 geometry、GeoRef、坐标系或有效时间。M07 不会把机构名称或区域文字转换成业务位置。</p><div class="spatial-actions"><button class="view-action primary" data-open-lens="object360">${icon("scan-face")}<span>返回对象全貌</span></button><button class="view-action" data-open-lens="graph">${icon("share-2")}<span>查看关系网络</span></button><button class="view-action" data-module="data">${icon("database")}<span>查看来源</span></button></div></section><aside class="spatial-contract"><h3>空间读取状态</h3><div class="contract-list"><div class="contract-row"><span>Geometry</span><strong>NOT_APPLICABLE</strong></div><div class="contract-row"><span>坐标系 CRS</span><strong>未提供</strong></div><div class="contract-row"><span>有效时间</span><strong>未提供</strong></div><div class="contract-row"><span>图层归属</span><strong>不适用</strong></div><div class="contract-row"><span>数据截至</span><strong>${escape(scenarioAsOf())}</strong></div></div></aside></div>`;
      viewStage.querySelectorAll("[data-open-lens]").forEach((button) => button.addEventListener("click", () => openLens(button.dataset.openLens)));
      viewStage.querySelector("[data-module]")?.addEventListener("click", () => openHandoff("data"));
      return;
    }
    const spatialObjects = C.allowedObjects(resource, state.roleId).filter((item) => geometryOf(item));
    viewStage.innerHTML = `<div class="map-shell"><aside class="map-controls"><span class="pane-kicker">图层</span><label class="series-option"><input id="map-object-layer" type="checkbox" ${state.mapLayers.includes("objects") ? "checked" : ""}><div><strong>业务点</strong><span>${spatialObjects.length} 个可见对象</span></div></label><div class="map-source-note">当前视图不加载外部底图</div><button class="view-action" id="fit-map" type="button">${icon("maximize-2")}<span>适配范围</span></button><button class="view-action" id="capture-bbox" type="button">${icon("scan")}<span>记录当前范围</span></button></aside><div id="workspace-map"></div></div>`;
    initializeMap(spatialObjects, current);
  }

  function initializeMap(spatialObjects, current) {
    if (!window.L || !document.getElementById("workspace-map")) return;
    activeMap = L.map("workspace-map", { zoomControl: true, attributionControl: false }).setView([34.5, 108.5], 4);
    const markers = [];
    if (state.mapLayers.includes("objects")) spatialObjects.forEach((item) => {
      const geometry = geometryOf(item);
      if (geometry?.type !== "Point") return;
      const marker = L.circleMarker([geometry.coordinates[1], geometry.coordinates[0]], { radius: item.id === current.id ? 9 : 6, color: "#315fae", fillColor: typeColor(item), fillOpacity: .86 }).addTo(activeMap);
      marker.bindTooltip(item.title);
      marker.on("click", () => previewObject(item.id));
      markers.push(marker);
    });
    if (state.bbox) activeMap.fitBounds([[state.bbox[1], state.bbox[0]], [state.bbox[3], state.bbox[2]]], { animate: false });
    else if (markers.length) activeMap.fitBounds(L.featureGroup(markers).getBounds().pad(.25), { animate: false });
    document.getElementById("map-object-layer")?.addEventListener("change", (event) => setState({ mapLayers: event.target.checked ? ["objects"] : [] }));
    document.getElementById("fit-map")?.addEventListener("click", () => { if (markers.length) activeMap.fitBounds(L.featureGroup(markers).getBounds().pad(.25)); });
    document.getElementById("capture-bbox")?.addEventListener("click", () => {
      const bounds = activeMap.getBounds();
      state.bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
      updateUrl("replace");
      toast("当前地图范围已写入探索链接", "success");
    });
    window.setTimeout(() => activeMap?.invalidateSize(), 80);
  }

  function deniedState(message) {
    return `<div class="overview-body"><div class="status-banner danger"><span>${icon("lock-keyhole")}</span><div><h3>访问被拒绝</h3><p>${escape(message)}</p></div></div><div class="section-row"><span class="section-icon">${icon("shield-check")}</span><div class="section-row-copy"><strong>查看权限验证</strong><span>角色切换会重新执行对象和关系端点授权，不复用缓存结果。</span></div><div class="section-row-actions"><button class="inline-button" data-open-permission>权限验证</button></div></div></div>`;
  }

  function bindDeniedState() {
    viewStage.querySelector("[data-open-permission]")?.addEventListener("click", openPermissionDrawer);
  }

  function renderStage() {
    if (activeMap) { activeMap.remove(); activeMap = null; }
    if (state.lens === "catalog") renderCatalog();
    else if (state.lens === "object360") renderOverview();
    else if (state.lens === "graph") renderGraph();
    else if (state.lens === "temporal") renderTemporal();
    else renderSpatial();
  }

  function inspectorTarget() {
    return state.lens === "graph" ? currentGraphSelection() : object();
  }

  function contextualModules() {
    if (state.lens === "graph") return ["query", "decision", "report"];
    if (state.lens === "temporal") return ["modeling", "query", "report"];
    if (state.lens === "spatial") return ["data", "ontology", "dashboard"];
    return ["ontology", "query", "report"];
  }

  function returnedModelResultMarkup() {
    const envelope = returnedModelResult?.resultEnvelope;
    if (!envelope) return "";
    const items = Array.isArray(envelope.resultItems) ? envelope.resultItems.slice(0, 4) : [];
    const itemValue = (item) => {
      if (item.value == null) return item.missingReason || "无法评价";
      if (Array.isArray(item.value)) return item.value.slice(0, 3).map((entry) => `${entry.name || entry.label || "贡献项"}${Number.isFinite(Number(entry.contribution)) ? ` ${Number(entry.contribution).toFixed(2)}` : ""}`).join("；") || "无贡献项";
      if (typeof item.value === "object") return Object.entries(item.value).map(([key, value]) => `${key} ${value}`).join(" · ");
      return `${item.value}${item.unit ? ` ${item.unit}` : ""}`;
    };
    return `<section class="inspector-section"><h3>M08 返回结果</h3><div class="state-list"><div class="state-line"><span>结果身份</span><strong>${escape(envelope.resultKind || "—")}</strong></div><div class="state-line"><span>Objective</span><strong>${escape(envelope.objectiveId || "—")}</strong></div><div class="state-line"><span>Model Version</span><strong>${escape(envelope.modelVersionId || "—")}</strong></div><div class="state-line"><span>Result ID</span><code>${escape(envelope.resultId || "—")}</code></div></div>${items.length ? `<div class="inspector-actions">${items.map((item) => `<div class="state-line"><span>${escape(item.label || item.outputId)}</span><strong>${escape(itemValue(item))}</strong></div>`).join("")}</div>` : ""}<p class="drawer-copy">该结果保持 ${escape(envelope.resultKind || "非事实")} 身份；M07 只读展示，不写事实或行动。</p></section>`;
  }

  function renderInspector() {
    const target = inspectorTarget();
    const canRead = allowed(target);
    if (!target || !canRead) {
      contextContent.innerHTML = `<section class="inspector-section"><div class="inspector-object"><span class="selection-symbol">${icon("lock-keyhole")}</span><div><strong>受限对象</strong><span>ObjectRef 已保留，属性和关系未暴露。</span></div></div><div class="inspector-facts"><div class="inspector-fact"><span>对象引用</span><code>REDACTED</code></div><div class="inspector-fact"><span>角色</span><strong>${escape(roleMeta().label)}</strong></div></div></section><section class="inspector-section"><button class="inspector-primary" data-open-permission>${icon("shield-check")}权限验证</button></section>`;
      contextContent.querySelector("[data-open-permission]")?.addEventListener("click", openPermissionDrawer);
      return;
    }
    const links = C.visibleLinksForObject(resource, target.id, state.roleId).length;
    const series = resource.series.filter((item) => item.ownerObjectId === target.id).length;
    const sources = [...new Set([...(target.sourceRefs || []), ...Object.values(target.properties || {}).flatMap((property) => sourceRef(property?.sourceRefs))])].length;
    const primaryAction = state.lens === "catalog"
      ? `<button class="inspector-primary" data-open-object="${escape(target.id)}">${icon("scan-face")}打开对象全貌</button>`
      : state.lens === "graph" && target.id !== state.graphRootId
        ? `<button class="inspector-primary" data-refocus="${escape(target.id)}">${icon("focus")}以此对象为中心</button><button class="inline-button" style="width:100%;justify-content:center;margin-top:6px" data-open-object="${escape(target.id)}">打开对象全貌</button>`
        : `<button class="inspector-primary" data-open-lens="object360">${icon("scan-face")}查看对象全貌</button>`;
    contextContent.innerHTML = `<section class="inspector-section"><div class="inspector-object"><span class="selection-symbol">${icon(typeMeta(target).icon)}</span><div><strong>${escape(target.title)}</strong><span>${escape(typeMeta(target).label)} · ${escape(target.subtitle || "")}</span></div></div><div class="inspector-facts"><div class="inspector-fact"><span>质量</span><strong>${escape(qualityMeta(target.quality).label)}</strong></div><div class="inspector-fact"><span>可见关系</span><strong>${links} 条</strong></div><div class="inspector-fact"><span>时序系列</span><strong>${series} 条</strong></div><div class="inspector-fact"><span>来源引用</span><strong>${sources} 个</strong></div></div><div style="margin-top:10px">${primaryAction}</div></section>${returnedModelResultMarkup()}<section class="inspector-section"><h3>继续处理</h3><div class="inspector-actions">${contextualModules().map((id) => moduleActionHtml(id)).join("")}</div></section><section class="inspector-section"><h3>读取上下文</h3><div class="state-list"><div class="state-line"><span>${escape(semanticModeLabel())}</span><strong>${escape(resource.ontologyContext.publishedSemanticVersionId)}</strong></div><div class="state-line"><span>数据截至</span><strong>${escape(resource.scenarioContext.dataAsOf)}</strong></div><div class="state-line"><span>角色视图</span><strong>${escape(roleMeta().label)}</strong></div><div class="state-line"><span>当前 Lens</span><strong>${escape(LENSES.find((item) => item.id === state.lens)?.label)}</strong></div></div></section>`;
    contextContent.querySelectorAll("[data-module]").forEach((button) => button.addEventListener("click", () => openHandoff(button.dataset.module)));
    contextContent.querySelectorAll("[data-open-object]").forEach((button) => button.addEventListener("click", () => openObject(button.dataset.openObject)));
    contextContent.querySelectorAll("[data-open-lens]").forEach((button) => button.addEventListener("click", () => openLens(button.dataset.openLens)));
    contextContent.querySelectorAll("[data-refocus]").forEach((button) => button.addEventListener("click", () => refocusGraph(button.dataset.refocus)));
  }

  function moduleActionHtml(moduleId) {
    const action = MODULE_ACTIONS[moduleId];
    return `<button class="module-action" type="button" data-module="${moduleId}"><span>${icon(action.icon)}</span><div><strong>${escape(action.label)}</strong><small>${escape(action.detail)}</small></div>${icon("chevron-right")}</button>`;
  }

  function renderAll() {
    root.dataset.lens = state.lens;
    renderToolbar();
    renderLensNav();
    renderSelectionBar();
    renderObjectPane();
    renderViewHeader();
    renderStage();
    renderInspector();
    refreshIcons();
    root.setAttribute("aria-busy", "false");
    if (window.parent !== window) {
      window.parent.postMessage({
        channel: HANDOFF_CHANNEL,
        operation: "sync-breadcrumb",
        moduleId: MODULE_ID,
        route: MODULE_ROUTE,
        scenarioId: resource.scenarioContext.scenarioId,
        label: LENSES.find((item) => item.id === state.lens)?.label || "多视图探索",
      }, window.location.origin);
    }
  }

  function openLens(lens) {
    if (!LENSES.some((item) => item.id === lens)) return;
    const patch = { lens };
    if (lens === "graph") {
      patch.graphRootId = state.graphRootId && allowed(object(state.graphRootId)) ? state.graphRootId : state.objectId;
      patch.graphSelectedId = patch.graphRootId;
    }
    if (lens === "temporal") patch.transform = "raw";
    setState(patch, { history: "push" });
    document.querySelector(".primary-pane")?.scrollTo(0, 0);
  }

  function previewObject(objectId) {
    if (!object(objectId)) { toast("对象引用不存在，已失败关闭", "danger"); return; }
    const patch = { objectId };
    if (state.lens === "graph") { patch.graphRootId = objectId; patch.graphSelectedId = objectId; }
    if (state.lens === "temporal") { patch.seriesIds = []; patch.transform = "raw"; }
    setState(patch, { history: "replace" });
    closeMobilePanes();
  }

  function openObject(objectId, tab = "properties") {
    if (!object(objectId)) { toast("对象引用不存在，已失败关闭", "danger"); return; }
    setState({ objectId, lens: "object360", objectTab: tab, graphRootId: objectId, graphSelectedId: objectId, seriesIds: [], transform: "raw" }, { history: "push" });
    closeMobilePanes();
  }

  function openGraph(objectId = state.objectId) {
    if (!object(objectId)) return;
    setState({ objectId, lens: "graph", graphRootId: objectId, graphSelectedId: objectId, graphZoom: 1 }, { history: "push" });
  }

  function refocusGraph(objectId) {
    const next = object(objectId);
    if (!next || !allowed(next)) { toast("当前角色不能将该对象设为中心", "danger"); return; }
    setState({ objectId, graphRootId: objectId, graphSelectedId: objectId, graphZoom: 1 }, { history: "push" });
    toast(`已以“${next.title}”为中心重新展开`, "success");
  }

  function resetFilters() {
    state = { ...state, search: "", typeFilter: "all", qualityFilter: "all", sort: "title" };
    updateUrl("replace");
    renderAll();
    objectSearch.focus();
    toast("对象筛选已重置", "success");
  }

  function openDrawer(markup) {
    drawer.innerHTML = markup;
    drawerBackdrop.hidden = false;
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    drawer.querySelectorAll("[data-close-drawer]").forEach((button) => button.addEventListener("click", closeDrawer));
    refreshIcons();
  }

  function closeDrawer() {
    pendingModule = null;
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    window.setTimeout(() => { drawerBackdrop.hidden = true; drawer.innerHTML = ""; }, 190);
  }

  function drawerHead(title, kicker = "上下文操作") {
    return `<header class="drawer-head"><div><span class="pane-kicker">${escape(kicker)}</span><h2>${escape(title)}</h2></div><button class="icon-button" type="button" data-close-drawer title="关闭" aria-label="关闭">${icon("x")}</button></header>`;
  }

  function contextRows(target = object()) {
    return `<div class="drawer-context"><div class="drawer-context-row"><span>ObjectRef</span><code>${allowed(target) ? escape(target.id) : "REDACTED"}</code></div><div class="drawer-context-row"><span>Lens</span><strong>${escape(LENSES.find((item) => item.id === state.lens)?.label)}</strong></div><div class="drawer-context-row"><span>${escape(semanticModeLabel())}</span><code>${escape(resource.ontologyContext.publishedSemanticVersionId)}</code></div><div class="drawer-context-row"><span>数据截至</span><strong>${escape(resource.scenarioContext.dataAsOf)}</strong></div><div class="drawer-context-row"><span>角色</span><strong>${escape(roleMeta().label)}</strong></div></div>`;
  }

  function openUseObjectDrawer() {
    const target = inspectorTarget() || object();
    openDrawer(`${drawerHead("使用此对象", "带上下文继续")}<div class="drawer-body"><p class="drawer-copy">选择目标模块。打开时传递当前对象、Lens、场景、版本和返回位置；目标模块仍按自身权限和 Owner 合同处理。</p><div class="drawer-object"><span class="selection-symbol">${icon(allowed(target) ? typeMeta(target).icon : "lock-keyhole")}</span><div><strong>${allowed(target) ? escape(target.title) : "受限对象"}</strong><code>${allowed(target) ? escape(target.id) : "REDACTED"}</code></div></div><div class="drawer-section"><h3>读取上下文</h3>${contextRows(target)}</div><div class="drawer-section"><h3>目标模块</h3><div class="drawer-module-list">${Object.keys(MODULE_ACTIONS).map((id) => moduleActionHtml(id)).join("")}</div></div></div><footer class="drawer-foot"><button class="drawer-button" type="button" data-close-drawer>关闭</button></footer>`);
    drawer.querySelectorAll("[data-module]").forEach((button) => button.addEventListener("click", () => openHandoff(button.dataset.module)));
  }

  function openHandoff(moduleId) {
    const action = MODULE_ACTIONS[moduleId];
    if (!action) return;
    pendingModule = moduleId;
    const target = inspectorTarget() || object();
    openDrawer(`${drawerHead(action.label, `继续到${action.target}`)}<div class="drawer-body"><p class="drawer-copy">${escape(action.detail)}。此次跳转只传递稳定引用和读取上下文，不复制对象、质量或业务状态。</p><div class="drawer-object"><span class="selection-symbol">${icon(allowed(target) ? typeMeta(target).icon : "lock-keyhole")}</span><div><strong>${allowed(target) ? escape(target.title) : "受限对象"}</strong><code>${allowed(target) ? escape(target.id) : "REDACTED"}</code></div></div><div class="drawer-section"><h3>即将传递</h3>${contextRows(target)}</div><div class="drawer-section"><div class="status-banner warning"><span>${icon("shield-check")}</span><div><h3>目标模块会重新授权</h3><p>返回多视图探索后也会重新读取当前对象和 Lens。</p></div></div></div></div><footer class="drawer-foot"><button class="drawer-button" type="button" data-close-drawer>取消</button><button id="confirm-handoff" class="drawer-button primary" type="button">带上下文打开</button></footer>`);
    document.getElementById("confirm-handoff")?.addEventListener("click", () => navigateParentModule(moduleId));
  }

  function navigateParentModule(moduleId) {
    const route = ROUTE_BY_MODULE[moduleId];
    if (!route) return;
    const target = inspectorTarget() || object();
    const returnUrl = new URL(location.href);
    returnUrl.searchParams.set("object", state.objectId || "");
    returnUrl.searchParams.set("lens", state.lens);
    returnUrl.searchParams.set("returnFrom", moduleId);
    const primary = document.querySelector(".primary-pane");
    returnUrl.searchParams.set("position", `scroll:${Math.round(primary?.scrollTop || 0)}`);
    const selectedSeries = state.seriesIds
      .map((seriesId) => resource.series.find((series) => series.id === seriesId))
      .find(Boolean)
      || objectSeries(target)[0]
      || null;
    const scenarioContext = activeScenarioContext();
    const localObjectRef = allowed(target) ? { id: target.id, title: target.title, objectTypeRef: target.objectTypeId } : null;
    const objectRef = allowed(target) ? { ...(target.canonicalObjectRef || localObjectRef) } : null;
    const handoffContext = C.createModuleHandoffContext({
      objectRef,
      lensRef: { moduleId: MODULE_ID, lensId: state.lens, route: MODULE_ROUTE },
      seriesRef: selectedSeries ? { id: selectedSeries.id, label: selectedSeries.label, unit: selectedSeries.unit, ownerObjectId: selectedSeries.ownerObjectId } : null,
      timeRange: { start: state.temporalFrom, end: state.temporalTo },
      dataVersionId: dataVersionId(),
      ontologyVersionId: resource.ontologyContext.publishedSemanticVersionId,
      bindingId: resource.ontologyContext.authoritativeBindingId,
      usageIntent: resource.modelingIntent || "SIMULATION",
      scenarioContext
    });
    const isModelingHandoff = moduleId === "modeling";
    const explorationResultEnvelope = isModelingHandoff && scenarioContext.scenarioId === "S005"
      ? {
          type: "OFW_S005_M07_EXPLORATION_RESULT",
          schemaVersion: "ofw.s005.m07-exploration-result.v1",
          moduleId: "M07",
          scenarioContext,
          result: {
            clientResultId: `S005-M07-EXPLORATION-${scenarioContext.scenarioRunId}-${objectRef?.id || "none"}`,
            outputKind: "M07_EXPLORATION_RESULT",
            status: "complete",
            producedAt: new Date().toISOString(),
            explorationResultRef: `exploration://${scenarioContext.scenarioRunId}/${objectRef?.id || "none"}/${state.lens}`,
            objectRef,
            lensRef: handoffContext.lensRef,
            seriesRef: handoffContext.seriesRef,
            timeRange: handoffContext.timeRange,
            dataVersionId: handoffContext.dataVersionId,
            ontologyVersionId: handoffContext.ontologyVersionId,
            bindingId: handoffContext.bindingId,
            evidenceRefs: [objectRef?.id, handoffContext.dataVersionId, handoffContext.ontologyVersionId, handoffContext.seriesRef?.id || "SERIES_NOT_AVAILABLE"].filter(Boolean),
            missingReasons: handoffContext.seriesRef ? [] : ["当前 InvestmentProduct 没有受治理的产品级时序系列。"]
          }
        }
      : null;
    const envelope = {
      channel: HANDOFF_CHANNEL,
      operation: isModelingHandoff ? "open-m08" : "navigate-parent-module",
      ...(isModelingHandoff ? { type: "OFW_M07_OPEN_M08", payload: handoffContext } : {}),
      ...(explorationResultEnvelope ? { explorationResultEnvelope } : {}),
      moduleId,
      route,
      sourceModuleId: MODULE_ID,
      sourceRoute: MODULE_ROUTE,
      returnUrl: returnUrl.href,
      objectId: objectRef?.id || "",
      objectTitle: objectRef?.title || "",
      rootObjectId: state.objectId || "",
      lens: state.lens,
      publishedSemanticVersionId: resource.ontologyContext.publishedSemanticVersionId,
      bindingId: resource.ontologyContext.authoritativeBindingId,
      scenarioContext,
      scenarioId: scenarioContext.scenarioId,
      scenarioVersion: scenarioContext.scenarioVersion,
      scenarioRunId: scenarioContext.scenarioRunId,
      formedAt: scenarioContext.formedAt,
      status: scenarioContext.status,
      context: handoffContext,
    };
    closeDrawer();
    if (window.parent !== window) {
      window.parent.postMessage(envelope, window.location.origin);
      return;
    }
    window.dispatchEvent(new CustomEvent("m07:handoff", { detail: envelope }));
    toast("交接上下文已形成；请从统一入口接收", "success");
  }

  function openPermissionDrawer() {
    const current = object();
    const visibleNow = C.allowedObjects(resource, state.roleId).length;
    openDrawer(`${drawerHead("权限验证", "角色视图")}<div class="drawer-body"><p class="drawer-copy">角色切换用于核对数据隔离。每次切换都会重新过滤对象、关系端点和关系本身；不会把被拒对象替换为其他对象。</p><div class="drawer-section"><h3>选择角色</h3><div class="permission-role-list">${resource.roles.map((role) => `<label class="permission-role"><input type="radio" name="m07-role" value="${escape(role.id)}" ${role.id === state.roleId ? "checked" : ""}><span><strong>${escape(role.label)}</strong><small>${escape(role.objectVisibility || "按策略读取")} · ${escape(role.policyVersion || "policy")}</small></span></label>`).join("")}</div></div><div class="drawer-section"><h3>当前结果</h3><div class="drawer-context"><div class="drawer-context-row"><span>可见对象</span><strong>${visibleNow} / ${resource.objects.length}</strong></div><div class="drawer-context-row"><span>当前对象</span><strong>${allowed(current) ? "已授权" : "访问拒绝"}</strong></div><div class="drawer-context-row"><span>策略版本</span><code>${escape(roleMeta().policyVersion || "policy-v1")}</code></div></div></div></div><footer class="drawer-foot"><button class="drawer-button" type="button" data-close-drawer>完成</button></footer>`);
    drawer.querySelectorAll('input[name="m07-role"]').forEach((input) => input.addEventListener("change", () => {
      const nextRole = input.value;
      const stillAllowed = allowed(current, nextRole);
      state = { ...state, roleId: nextRole };
      updateUrl("push");
      renderAll();
      openPermissionDrawer();
      toast(stillAllowed ? `已按“${roleMeta(nextRole).label}”重新授权` : "当前对象已拒绝；ObjectRef 保持不变", stillAllowed ? "success" : "warning");
    }));
  }

  function openEvidence(evidenceId) {
    const current = object();
    const item = evidenceId.startsWith("snapshot:")
      ? resource.source.snapshots.find((snapshot) => `snapshot:${snapshot.date}` === evidenceId)
      : object(evidenceId) || null;
    const title = item?.title || (item?.date ? `${item.date} 受治理快照` : evidenceId.replace(/^ref:/, ""));
    const refs = item?.sourceRefs || current?.sourceRefs || [];
    openDrawer(`${drawerHead("证据详情", "只读证据定位")}<div class="drawer-body"><p class="drawer-copy">证据定位用于解释当前对象与属性的来源，不在 M07 内创建报告或改写正式证据。</p><div class="drawer-object"><span class="selection-symbol">${icon("file-check-2")}</span><div><strong>${escape(title)}</strong><code>${escape(evidenceId)}</code></div></div><div class="drawer-section"><h3>证据身份</h3><div class="drawer-context"><div class="drawer-context-row"><span>数据截至</span><strong>${escape(item?.date || resource.scenarioContext.dataAsOf)}</strong></div><div class="drawer-context-row"><span>版本 / 摘要</span><code>${escape(item?.version || item?.sha256 || item?.stableKeyFingerprint || "由来源引用定位")}</code></div><div class="drawer-context-row"><span>来源引用</span><strong>${sourceRef(refs).length || sourceRef(current?.sourceRefs).length} 个</strong></div><div class="drawer-context-row"><span>${escape(semanticModeLabel())}</span><code>${escape(resource.ontologyContext.publishedSemanticVersionId)}</code></div></div></div><div class="drawer-section"><h3>继续核对</h3><div class="drawer-module-list">${moduleActionHtml("data")}${moduleActionHtml("report")}</div></div></div><footer class="drawer-foot"><button class="drawer-button" type="button" data-close-drawer>关闭</button></footer>`);
    drawer.querySelectorAll("[data-module]").forEach((button) => button.addEventListener("click", () => openHandoff(button.dataset.module)));
  }

  function copyDeepLink() {
    updateUrl("replace");
    const value = location.href;
    const fallback = () => {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      document.body.append(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    };
    (navigator.clipboard?.writeText ? navigator.clipboard.writeText(value) : Promise.reject()).then(() => toast("当前对象和 Lens 链接已复制；打开时会重新授权", "success")).catch(() => { fallback(); toast("当前探索链接已复制", "success"); });
  }

  function openObjectPane() { root.classList.add("object-open"); root.classList.remove("context-open"); }
  function openContextPane() { root.classList.add("context-open"); root.classList.remove("object-open"); }
  function closeMobilePanes() { root.classList.remove("object-open", "context-open"); }

  function bindStaticEvents() {
    objectSearch.addEventListener("input", (event) => {
      state.search = event.target.value;
      updateUrl("replace");
      renderObjectPane();
      if (state.lens === "catalog") renderCatalog();
      refreshIcons();
    });
    document.getElementById("clear-search").addEventListener("click", () => {
      state.search = "";
      objectSearch.value = "";
      updateUrl("replace");
      renderObjectPane();
      if (state.lens === "catalog") renderCatalog();
      refreshIcons();
      objectSearch.focus();
    });
    typeFilter.addEventListener("change", (event) => setState({ typeFilter: event.target.value }));
    qualityFilter.addEventListener("change", (event) => setState({ qualityFilter: event.target.value }));
    sortSelect.addEventListener("change", (event) => setState({ sort: event.target.value }));
    document.getElementById("copy-deep-link").addEventListener("click", copyDeepLink);
    document.getElementById("use-object-button").addEventListener("click", openUseObjectDrawer);
    document.getElementById("permission-button").addEventListener("click", openPermissionDrawer);
    document.getElementById("mobile-objects").addEventListener("click", openObjectPane);
    document.getElementById("mobile-context").addEventListener("click", openContextPane);
    document.querySelectorAll("[data-close-pane]").forEach((button) => button.addEventListener("click", closeMobilePanes));
    drawerBackdrop.addEventListener("click", closeDrawer);
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") { closeDrawer(); closeMobilePanes(); } });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".graph-quality")) document.querySelector(".graph-quality.open")?.classList.remove("open");
    });
    window.addEventListener("popstate", () => {
      state = readStateFromUrl();
      renderAll();
      restoreReturnPosition();
    });
    window.addEventListener("message", (event) => {
      if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== "OFW_M08_RETURN_TO_M07") return;
      const payload = event.data.payload || {};
      if (!SCENARIO_CONTEXT_FIELDS.every((field) => payload[field] === resource.scenarioContext[field])) return;
      if (!payload.resultEnvelope?.resultId || !new Set(["PREDICTION", "SIMULATION"]).has(payload.resultEnvelope.resultKind)) return;
      const inputObject = payload.inputManifest?.objectRef;
      const activeObject = object();
      const activeObjectRef = activeObject?.canonicalObjectRef || { id: activeObject?.id, objectTypeRef: activeObject?.objectTypeId };
      const subjectRefs = Array.isArray(payload.resultEnvelope.subjectRefs) ? payload.resultEnvelope.subjectRefs : [];
      if (!inputObject?.id || inputObject.id !== activeObjectRef?.id || inputObject.objectTypeRef !== activeObjectRef?.objectTypeRef) return;
      if (!subjectRefs.some((subject) => subject?.id === inputObject.id && subject?.objectTypeRef === inputObject.objectTypeRef)) return;
      if (payload.resultEnvelope.factWriteAllowed !== false || payload.resultEnvelope.actionWriteAllowed !== false || payload.resultEnvelope.actionSourceAllowed !== false || payload.resultEnvelope.sideEffectsEmitted !== 0) return;
      returnedModelResult = payload;
      renderInspector();
      toast(`已读取 ${payload.resultEnvelope.resultKind} 结果；正式事实保持不变`, "success");
    });
  }

  function restoreReturnPosition() {
    const match = /^scroll:([0-9]+)$/.exec(state.returnPosition || "");
    if (!match) return;
    const top = Number(match[1]);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      document.querySelector(".primary-pane")?.scrollTo({ top, left: 0, behavior: "auto" });
    }));
  }

  function showReturnReceipt() {
    if (!state.returnFrom || !MODULE_ACTIONS[state.returnFrom]) return;
    window.setTimeout(() => toast(`已从${MODULE_ACTIONS[state.returnFrom].target}返回，并恢复当前对象与${LENSES.find((item) => item.id === state.lens)?.label}`, "success"), 180);
  }

  function fatal(error) {
    const diagnosticId = `M07-LOAD-${Date.now().toString(36).toUpperCase()}`;
    document.body.innerHTML = `<main class="fatal-state"><section class="fatal-panel"><span>${icon("circle-x")}</span><h1>探索资源加载失败</h1><p>无法读取当前 M07 资源。请确认本地服务仍在运行，再重新加载。</p><p><code>${escape(diagnosticId)}</code></p><div class="fatal-actions"><button class="view-action primary" id="retry-load" type="button">${icon("refresh-cw")}<span>重新加载</span></button></div></section></main>`;
    document.getElementById("retry-load")?.addEventListener("click", () => location.reload());
    refreshIcons();
    console.error(`[${diagnosticId}]`, error);
  }

  async function start() {
    try {
      const params = new URLSearchParams(location.search);
      const resourcePath = params.get("resource") || "../resources/s001.json";
      const response = await fetch(resourcePath, { cache: "no-store" });
      if (!response.ok) throw new Error(`资源 HTTP ${response.status}`);
      resource = await response.json();
      if (resource.schemaVersion !== "ofw.m07.validation-resource.v1" || resource.namespace !== "ofw.m07.research.v1") throw new Error("资源 schema 或 namespace 不匹配");
      applyHostScenarioContext(params);
      state = readStateFromUrl();
      bindStaticEvents();
      updateUrl("replace");
      renderAll();
      restoreReturnPosition();
      showReturnReceipt();
      if (window.parent !== window) window.parent.postMessage({ type: "OFW_M07_READY", moduleId: MODULE_ID, scenarioContext: activeScenarioContext() }, location.origin);
    } catch (error) {
      fatal(error);
    }
  }

  start();
}());
