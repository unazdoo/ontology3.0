(function () {
  "use strict";

  const LENSES = [
    { id: "catalog", label: "目录", title: "对象目录", icon: "search" },
    { id: "object360", label: "360", title: "对象 360", icon: "scan-face" },
    { id: "graph", label: "关系", title: "关系图", icon: "share-2" },
    { id: "temporal", label: "时序", title: "时序探索", icon: "chart-no-axes-combined" },
    { id: "spatial", label: "空间", title: "空间探索", icon: "map" },
  ];

  const TYPE_META = {
    "m01.object-type.investment-portfolio": { label: "投资组合", icon: "briefcase-business" },
    "m01.object-type.financial-product": { label: "金融产品", icon: "package-search" },
    "m01.object-type.investment-holding": { label: "投资持仓", icon: "layers-3" },
    "m01.object-type.manager-candidate": { label: "管理人候选", icon: "building-2" },
    "m01.object-type.issuer-candidate": { label: "发行人候选", icon: "landmark" },
    "m01.object-type.validation-location": { label: "空间技术夹具", icon: "map-pin" },
    "m01.object-type.financing-group": { label: "融资集团", icon: "building-2" },
    "m01.object-type.financing-entity": { label: "融资主体", icon: "landmark" },
    "m01.object-type.financing-detail": { label: "贷款集合", icon: "layers-3" },
    "m01.object-type.financing-institution": { label: "金融机构", icon: "banknote" },
    "m01.object-type.financing-owner": { label: "负责人", icon: "user-round" },
    "m01.object-type.financing-rule-result": { label: "规则命中", icon: "circle-alert" },
    "m07.object-type.report": { label: "报告", icon: "file-text" },
    "m07.object-type.report-evidence": { label: "报告证据", icon: "file-check-2" },
  };

  const QUALITY_META = {
    passed: { label: "质量通过", className: "success", icon: "circle-check" },
    warning: { label: "质量警告", className: "warning", icon: "triangle-alert" },
    blocked: { label: "质量阻断", className: "danger", icon: "octagon-x" },
  };

  const SERIES_COLORS = ["#2d6aa0", "#13715d", "#91611d", "#66538b", "#16718a", "#ad403c"];

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function typeMeta(objectOrType) {
    const typeId = typeof objectOrType === "string" ? objectOrType : objectOrType?.objectTypeId;
    return TYPE_META[typeId] || { label: typeId?.split(".").at(-1) || "未知对象", icon: "box" };
  }

  function qualityMeta(quality) {
    return QUALITY_META[quality] || QUALITY_META.warning;
  }

  const LINK_META = {
    "m01.link-type.portfolio-has-holding": "持有",
    "m01.link-type.holding-refers-product": "对应产品",
    "m01.link-type.managedByCandidate": "候选管理人",
    "m01.link-type.issuedByCandidate": "候选发行人",
    "m01.link-type.validation-related-location": "空间关联",
    "m07.link-type.group-has-entity": "包含融资主体",
    "m01.link-type.entity-has-financing-detail": "拥有贷款集合",
    "m01.link-type.entity-owned-by-owner": "由负责人承接",
    "m07.link-type.entity-triggered-rule": "命中规则",
    "m07.link-type.rule-supported-by-evidence": "由证据支持",
    "m07.link-type.priority-negotiation-candidate": "优先协商候选",
    "m06.link-type.report-has-evidence": "绑定固定证据",
  };

  function linkMeta(linkOrType) {
    const typeId = typeof linkOrType === "string" ? linkOrType : linkOrType?.linkTypeId;
    return { label: (typeof linkOrType === "object" && linkOrType?.label) || LINK_META[typeId] || typeId?.split(".").at(-1) || "未命名关系", typeId };
  }

  function parseCsv(value) {
    return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
  }

  function defaultState(resource) {
    const firstProduct = resource.objects.find((object) => object.objectTypeId === "m01.object-type.financial-product");
    return {
      lens: "object360",
      currentObjectId: firstProduct?.id || resource.objects[0]?.id || null,
      roleId: "m07.analyst",
      search: "",
      typeFilter: "all",
      qualityFilter: "all",
      sort: "title",
      objectTab: "properties",
      graphHops: 2,
      graphQuality: ["passed", "warning", "blocked"],
      graphSelectedId: null,
      seriesIds: [],
      temporalMetric: "marketValue",
      temporalTransform: "raw",
      temporalThreshold: true,
      temporalFrom: resource.source.dateRange.from,
      temporalTo: resource.source.dateRange.to,
      eventIndex: 0,
      bbox: null,
      mapLayers: ["fixtures", "relations"],
      mapSelection: [],
      returnLens: null,
      returnObjectId: null,
      returnPosition: null,
    };
  }

  function stateFromUrl(resource) {
    const state = defaultState(resource);
    const params = new URLSearchParams(location.search);
    const lens = params.get("lens");
    if (LENSES.some((item) => item.id === lens)) state.lens = lens;
    if (params.get("object")) state.currentObjectId = params.get("object");
    if (resource.roles.some((role) => role.id === params.get("role"))) state.roleId = params.get("role");
    state.search = params.get("q") || "";
    state.typeFilter = params.get("type") || "all";
    state.qualityFilter = params.get("quality") || "all";
    state.sort = params.get("sort") || "title";
    state.objectTab = params.get("panel") || "properties";
    state.graphHops = Number(params.get("hops")) === 1 ? 1 : 2;
    state.graphQuality = parseCsv(params.get("graphQuality"));
    if (!state.graphQuality.length) state.graphQuality = ["passed", "warning", "blocked"];
    state.seriesIds = parseCsv(params.get("series"));
    state.temporalMetric = params.get("metric") || "marketValue";
    state.temporalTransform = ["raw", "rolling", "diff"].includes(params.get("transform")) ? params.get("transform") : "raw";
    state.temporalThreshold = params.get("threshold") !== "off";
    state.temporalFrom = params.get("from") || state.temporalFrom;
    state.temporalTo = params.get("to") || state.temporalTo;
    const bbox = parseCsv(params.get("bbox")).map(Number);
    state.bbox = bbox.length === 4 && bbox.every(Number.isFinite) ? bbox : null;
    const layers = parseCsv(params.get("layers"));
    if (layers.length) state.mapLayers = layers;
    state.returnLens = params.get("returnLens") || null;
    state.returnObjectId = params.get("returnObject") || null;
    state.returnPosition = params.get("position") || null;
    return state;
  }

  function stateToUrl(state) {
    const params = new URLSearchParams();
    params.set("lens", state.lens);
    if (state.currentObjectId) params.set("object", state.currentObjectId);
    params.set("role", state.roleId);
    if (state.search) params.set("q", state.search);
    if (state.typeFilter !== "all") params.set("type", state.typeFilter);
    if (state.qualityFilter !== "all") params.set("quality", state.qualityFilter);
    if (state.sort !== "title") params.set("sort", state.sort);
    if (state.objectTab !== "properties") params.set("panel", state.objectTab);
    if (state.lens === "graph") {
      params.set("hops", String(state.graphHops));
      params.set("graphQuality", state.graphQuality.join(","));
    }
    if (state.lens === "temporal") {
      if (state.seriesIds.length) params.set("series", state.seriesIds.join(","));
      params.set("metric", state.temporalMetric);
      params.set("transform", state.temporalTransform);
      params.set("threshold", state.temporalThreshold ? "on" : "off");
      params.set("from", state.temporalFrom);
      params.set("to", state.temporalTo);
    }
    if (state.lens === "spatial") {
      if (state.bbox) params.set("bbox", state.bbox.map((value) => Number(value).toFixed(4)).join(","));
      params.set("layers", state.mapLayers.join(","));
    }
    if (state.returnLens) params.set("returnLens", state.returnLens);
    if (state.returnObjectId) params.set("returnObject", state.returnObjectId);
    if (state.returnPosition) params.set("position", state.returnPosition);
    return `${location.pathname}?${params.toString()}`;
  }

  function commitUrl(state, mode = "replace") {
    const url = stateToUrl(state);
    if (mode === "push") history.pushState({ m07: true }, "", url);
    else history.replaceState({ m07: true }, "", url);
  }

  function objectById(resource, id) {
    return resource.objects.find((object) => object.id === id) || null;
  }

  function isAllowed(object, roleId) {
    return Boolean(object && object.permissions?.includes(roleId));
  }

  function isLinkAllowed(link, roleId) {
    return Boolean(link && (!Array.isArray(link.permissions) || link.permissions.includes(roleId)));
  }

  function allowedObjects(resource, roleId) {
    return resource.objects.filter((object) => isAllowed(object, roleId));
  }

  function filteredObjects(resource, state) {
    const search = state.search.trim().toLocaleLowerCase("zh-CN");
    const rows = allowedObjects(resource, state.roleId).filter((object) => {
      const meta = typeMeta(object);
      const matchesSearch = !search || [object.title, object.subtitle, object.id, meta.label, object.objectTypeId]
        .some((value) => String(value || "").toLocaleLowerCase("zh-CN").includes(search));
      const matchesType = state.typeFilter === "all" || object.objectTypeId === state.typeFilter;
      const matchesQuality = state.qualityFilter === "all" || object.quality === state.qualityFilter;
      return matchesSearch && matchesType && matchesQuality;
    });
    rows.sort((a, b) => {
      if (state.sort === "quality") return a.quality.localeCompare(b.quality) || a.title.localeCompare(b.title, "zh-CN");
      if (state.sort === "type") return a.objectTypeId.localeCompare(b.objectTypeId) || a.title.localeCompare(b.title, "zh-CN");
      return a.title.localeCompare(b.title, "zh-CN");
    });
    return rows;
  }

  function linksForObject(resource, objectId) {
    return resource.links.filter((link) => link.from === objectId || link.to === objectId);
  }

  function visibleLinksForObject(resource, objectId, roleId) {
    if (!isAllowed(objectById(resource, objectId), roleId)) return [];
    return linksForObject(resource, objectId).filter((link) => {
      const from = objectById(resource, link.from);
      const to = objectById(resource, link.to);
      return isLinkAllowed(link, roleId) && isAllowed(from, roleId) && isAllowed(to, roleId);
    });
  }

  function linkedObject(resource, link, objectId) {
    return objectById(resource, link.from === objectId ? link.to : link.from);
  }

  function graphSlice(resource, state) {
    const rootId = state.currentObjectId;
    const rootObject = objectById(resource, rootId);
    if (!isAllowed(rootObject, state.roleId)) return { nodes: [], links: [], truncated: false, nodeCap: 0, edgeCap: 0 };
    const allowedQualities = new Set(state.graphQuality);
    const nodeCap = Number(state.graphNodeCap) > 0 ? Number(state.graphNodeCap) : 200;
    const edgeCap = Number(state.graphEdgeCap) > 0 ? Number(state.graphEdgeCap) : 400;
    const ids = new Set([rootId]);
    const hops = new Map([[rootId, 0]]);
    const links = [];
    const linkIds = new Set();
    let truncated = false;
    const includeTechnicalFixtures = state.includeTechnicalFixtures === true || rootObject?.technicalFixture === true;
    const visibleLinks = resource.links.filter((link) => {
      const from = objectById(resource, link.from);
      const to = objectById(resource, link.to);
      return isLinkAllowed(link, state.roleId) && isAllowed(from, state.roleId) && isAllowed(to, state.roleId)
        && (includeTechnicalFixtures || (!from?.technicalFixture && !to?.technicalFixture));
    });
    let frontier = [rootId];
    for (let depth = 1; depth <= state.graphHops; depth += 1) {
      const next = [];
      for (const id of frontier.sort()) {
        for (const link of visibleLinks
          .filter((candidate) => (candidate.from === id || candidate.to === id) && allowedQualities.has(candidate.quality))
          .sort((a, b) => a.id.localeCompare(b.id))) {
          if (links.length >= edgeCap) { truncated = true; break; }
          const otherId = link.from === id ? link.to : link.from;
          if (!linkIds.has(link.id)) { linkIds.add(link.id); links.push(link); }
          if (!ids.has(otherId)) {
            if (ids.size >= nodeCap) { truncated = true; continue; }
            ids.add(otherId);
            hops.set(otherId, depth);
            next.push(otherId);
          }
        }
      }
      frontier = next;
    }
    const nodes = [...ids].map((id) => objectById(resource, id)).filter(Boolean).map((object) => ({ ...object, hop: hops.get(object.id) || 0 }));
    return { nodes, links, truncated, nodeCap, edgeCap };
  }

  function relatedSeries(resource, objectId) {
    const direct = resource.series.filter((series) => series.ownerObjectId === objectId);
    if (direct.length) return direct;
    const relatedHoldingIds = new Set();
    for (const link of resource.links) {
      if (link.linkTypeId === "m01.link-type.holding-refers-product" && (link.from === objectId || link.to === objectId)) {
        const otherId = link.from === objectId ? link.to : link.from;
        const other = objectById(resource, otherId);
        if (other?.objectTypeId === "m01.object-type.investment-holding") relatedHoldingIds.add(other.id);
      }
      if (link.linkTypeId === "m01.link-type.portfolio-has-holding" && link.from === objectId) relatedHoldingIds.add(link.to);
    }
    return resource.series.filter((series) => relatedHoldingIds.has(series.ownerObjectId));
  }

  function geometryOf(object) {
    const property = object?.properties?.geometry;
    return property?.value && property.value.type ? property.value : null;
  }

  function formatNumber(value, unit) {
    if (value == null || !Number.isFinite(Number(value))) return "—";
    const number = Number(value);
    if (unit === "CNY") {
      const absolute = Math.abs(number);
      if (absolute >= 100000000) return `${(number / 100000000).toFixed(2)} 亿`;
      if (absolute >= 10000) return `${(number / 10000).toFixed(1)} 万`;
      return number.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
    }
    return number.toLocaleString("zh-CN", { maximumFractionDigits: 4 });
  }

  function propertyValueHtml(property) {
    if (!property) return '<span class="status-chip neutral"><i></i>未提供</span>';
    if (property.state === "not_applicable") return '<span class="status-chip neutral"><i></i>不适用</span>';
    if (property.state === "missing") return '<span class="status-chip warning"><i></i>缺数据</span>';
    if (property.state === "redacted") return '<span class="status-chip danger"><i></i>已拒绝</span>';
    if (property.state === "quality_blocked") return '<span class="status-chip danger"><i></i>质量阻断</span>';
    const value = typeof property.value === "object" ? JSON.stringify(property.value) : String(property.value ?? "—");
    return escapeHtml(value);
  }

  function dispatch(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  window.M07Core = {
    LENSES,
    TYPE_META,
    QUALITY_META,
    SERIES_COLORS,
    escapeHtml,
    typeMeta,
    qualityMeta,
    linkMeta,
    defaultState,
    stateFromUrl,
    stateToUrl,
    commitUrl,
    objectById,
    isAllowed,
    isLinkAllowed,
    allowedObjects,
    filteredObjects,
    linksForObject,
    visibleLinksForObject,
    linkedObject,
    graphSlice,
    relatedSeries,
    geometryOf,
    formatNumber,
    propertyValueHtml,
    dispatch,
  };
}());
