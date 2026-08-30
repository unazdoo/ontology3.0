(function () {
  "use strict";

  const C = window.M07Core;
  let graphSimulation = null;
  let activeMap = null;
  const graphPositions = new Map();

  function cleanup() {
    if (graphSimulation) {
      graphSimulation.stop();
      graphSimulation = null;
    }
    if (activeMap) {
      activeMap.remove();
      activeMap = null;
    }
  }

  function heading(title, description, actions = "") {
    return `
      <header class="workspace-heading">
        <div>
          <span class="eyebrow">M07 / READ-ONLY EXPLORATION</span>
          <h2>${C.escapeHtml(title)}</h2>
          <p>${C.escapeHtml(description)}</p>
        </div>
        <div class="toolbar-group">${actions}</div>
      </header>`;
  }

  function deniedView(object, ctx) {
    const visibleTitle = object ? "当前对象不在角色授权范围内" : "对象不存在或版本不可解析";
    return `
      ${heading("访问被拒绝", "深链解析后已重新执行对象与属性授权。")}
      <section class="panel blocked-state">
        <div>
          <span class="state-icon-large"><i data-lucide="lock-keyhole"></i></span>
          <h3>${visibleTitle}</h3>
          <p>系统不会将权限拒绝降级为“缺数据”，也不会回退到同名对象、上一版本或缓存值。</p>
          <button class="button secondary" type="button" data-action="open-catalog"><i data-lucide="search"></i>返回对象目录</button>
        </div>
      </section>`;
  }

  function renderCatalog(ctx) {
    cleanup();
    const rows = C.filteredObjects(ctx.resource, ctx.state);
    const objectRows = rows.map((object) => {
      const meta = C.typeMeta(object);
      const quality = C.qualityMeta(object.quality);
      const selected = object.id === ctx.state.currentObjectId ? " selected" : "";
      const linkCount = C.visibleLinksForObject(ctx.resource, object.id, ctx.state.roleId).length;
      return `
        <tr class="${selected}" data-object-id="${C.escapeHtml(object.id)}" tabindex="0">
          <td>
            <div class="object-cell">
              <span class="type-symbol"><i data-lucide="${meta.icon}"></i></span>
              <div><strong>${C.escapeHtml(object.title)}</strong><small>${C.escapeHtml(object.id)}</small></div>
            </div>
          </td>
          <td>${C.escapeHtml(meta.label)}</td>
          <td>${linkCount}</td>
          <td><span class="status-chip ${quality.className}"><i></i>${quality.label}</span></td>
          <td><span class="state-label"><i data-lucide="shield-check"></i>已重授权</span></td>
        </tr>`;
    }).join("");

    ctx.root.innerHTML = `
      ${heading("对象目录与统一搜索", "直接查询 Published 对象投影；筛选只使用稳定类型 ID，不复制 M01 定义。", `
        <label class="toolbar-group">排序
          <select class="compact-select" id="catalog-sort">
            <option value="title" ${ctx.state.sort === "title" ? "selected" : ""}>名称</option>
            <option value="type" ${ctx.state.sort === "type" ? "selected" : ""}>对象类型</option>
            <option value="quality" ${ctx.state.sort === "quality" ? "selected" : ""}>质量</option>
          </select>
        </label>
      `)}
      <section class="panel">
        <div class="panel-heading"><div><h3>Published 对象结果</h3><span>${rows.length} 个当前角色可见对象</span></div><span>游标分页合同草案</span></div>
        ${rows.length ? `
          <div style="overflow:auto">
            <table class="catalog-table">
              <thead><tr><th style="width:34%">对象</th><th style="width:18%">类型</th><th style="width:12%">关系</th><th style="width:18%">质量</th><th style="width:18%">授权</th></tr></thead>
              <tbody>${objectRows}</tbody>
            </table>
          </div>` : `
          <div class="empty-state"><div><span class="state-icon-large"><i data-lucide="search-x"></i></span><h3>没有匹配对象</h3><p>当前过滤条件没有返回可见对象。被拒绝对象不会作为普通“0 条结果”泄漏详情。</p><button class="button secondary" data-action="reset-filters"><i data-lucide="rotate-ccw"></i>重置筛选</button></div></div>`}
      </section>
      <section class="grid-3" style="margin-top:10px">
        <div class="panel"><div class="panel-body"><span class="eyebrow">IDENTITY</span><strong style="display:block;margin-top:5px">稳定对象引用</strong><p style="color:var(--muted);line-height:1.6">对象类型 ID、主键指纹与精确 Published 版本分列。</p></div></div>
        <div class="panel"><div class="panel-body"><span class="eyebrow">AUTHORIZATION</span><strong style="display:block;margin-top:5px">查询时重授权</strong><p style="color:var(--muted);line-height:1.6">分享 Lens 或深链不会授予底层对象访问权。</p></div></div>
        <div class="panel"><div class="panel-body"><span class="eyebrow">FAIL CLOSED</span><strong style="display:block;margin-top:5px">拒绝静默回退</strong><p style="color:var(--muted);line-height:1.6">版本冲突、权限拒绝与质量阻断保持独立状态。</p></div></div>
      </section>`;

    ctx.root.querySelectorAll("[data-object-id]").forEach((row) => {
      row.addEventListener("click", () => ctx.selectObject(row.dataset.objectId, "object360"));
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") ctx.selectObject(row.dataset.objectId, "object360");
      });
    });
    ctx.root.querySelector("#catalog-sort")?.addEventListener("change", (event) => ctx.setState({ sort: event.target.value }));
    ctx.root.querySelector("[data-action='reset-filters']")?.addEventListener("click", () => ctx.setState({ search: "", typeFilter: "all", qualityFilter: "all" }));
    ctx.root.querySelector("[data-action='open-catalog']")?.addEventListener("click", () => ctx.navigate("catalog"));
    ctx.refreshIcons();
  }

  function renderObjectProperties(object) {
    const rows = Object.entries(object.properties || {}).map(([key, property]) => `
      <div><dt>${C.escapeHtml(key)}</dt><dd>${C.propertyValueHtml(property)}</dd></div>`).join("");
    return `<dl class="definition-list">${rows || "<div><dt>属性</dt><dd>未提供</dd></div>"}</dl>`;
  }

  function renderObjectLinks(object, ctx) {
    const links = C.visibleLinksForObject(ctx.resource, object.id, ctx.state.roleId);
    if (!links.length) return `<div class="empty-state"><div><span class="state-icon-large"><i data-lucide="unlink"></i></span><h3>没有可见关系</h3><p>当前版本与角色范围内没有可展开 Link。</p></div></div>`;
    return `<div class="relation-list">${links.map((link) => {
      const target = C.linkedObject(ctx.resource, link, object.id);
      const allowed = C.isAllowed(target, ctx.state.roleId);
      const quality = C.qualityMeta(link.quality);
      return `
        <div class="relation-row">
          <span class="mini-icon"><i data-lucide="git-branch"></i></span>
          <div><button type="button" data-object-id="${allowed ? C.escapeHtml(target?.id) : ""}" ${allowed ? "" : "disabled"}>${allowed ? C.escapeHtml(target?.title || "未知对象") : "目标对象不可见"}</button><small>${C.escapeHtml(link.linkTypeId)}</small></div>
          <span class="status-chip ${quality.className}"><i></i>${quality.label}</span>
        </div>`;
    }).join("")}</div>`;
  }

  function renderObjectQuality(object) {
    const quality = C.qualityMeta(object.quality);
    const notes = object.qualityNotes?.length ? object.qualityNotes : ["没有额外质量说明"];
    return `
      <div class="quality-list">
        <div class="quality-row"><span class="mini-icon"><i data-lucide="${quality.icon}"></i></span><div><strong>${quality.label}</strong><small>对象级质量投影，不替代 M02 质量真值</small></div><span class="status-chip ${quality.className}"><i></i>${object.quality}</span></div>
        ${notes.map((note) => `<div class="quality-row"><span class="mini-icon"><i data-lucide="file-warning"></i></span><div><strong>${C.escapeHtml(note)}</strong><small>验证资源说明</small></div><span></span></div>`).join("")}
        <div class="quality-row"><span class="mini-icon"><i data-lucide="shield-alert"></i></span><div><strong>权限与缺失分列</strong><small>REDACTED / MISSING / NOT_APPLICABLE / QUALITY_BLOCKED</small></div><span class="status-chip info"><i></i>合同验证</span></div>
      </div>`;
  }

  function renderObjectVersion(object, ctx) {
    return `
      <dl class="definition-list">
        <div><dt>对象稳定引用</dt><dd><code>${C.escapeHtml(object.id)}</code></dd></div>
        <div><dt>对象类型</dt><dd><code>${C.escapeHtml(object.objectTypeId)}</code></dd></div>
        <div><dt>Published 语义版本</dt><dd><code>${C.escapeHtml(ctx.resource.ontologyContext.publishedSemanticVersionId)}</code></dd></div>
        <div><dt>权威消费绑定</dt><dd><code>${C.escapeHtml(ctx.resource.ontologyContext.authoritativeBindingId)}</code></dd></div>
        <div><dt>场景上下文</dt><dd><code>${C.escapeHtml(ctx.resource.scenarioContext.scenarioVersion)}</code></dd></div>
        <div><dt>基线状态</dt><dd><span class="status-chip warning"><i></i>${C.escapeHtml(ctx.resource.scenarioContext.baselineStatus)}</span></dd></div>
      </dl>
      <div class="validation-note"><strong>失败关闭：</strong>研究资源中的 Published/T019 仅是合同占位引用。正式冻结前禁止解释为已创建资源或已采用组合。</div>`;
  }

  function renderObjectEvidence(object, ctx) {
    const evidence = ctx.resource.source.snapshots.slice(-6).reverse();
    return `
      <div class="evidence-list">
        <div class="evidence-row"><span class="mini-icon"><i data-lucide="fingerprint"></i></span><div><strong>稳定键脱敏指纹</strong><small>${C.escapeHtml(object.stableKeyFingerprint || "不适用")}</small></div><span class="status-chip success"><i></i>未含原始标识</span></div>
        ${evidence.map((item) => `<div class="evidence-row"><span class="mini-icon"><i data-lucide="file-spreadsheet"></i></span><div><strong>${C.escapeHtml(item.date)} 周快照</strong><small>${C.escapeHtml(item.file)}</small></div><code>${C.escapeHtml(item.sha256.slice(0, 12))}…</code></div>`).join("")}
      </div>`;
  }

  function renderObject360(ctx) {
    cleanup();
    const object = C.objectById(ctx.resource, ctx.state.currentObjectId);
    if (!C.isAllowed(object, ctx.state.roleId)) {
      ctx.root.innerHTML = deniedView(object, ctx);
      ctx.root.querySelector("[data-action='open-catalog']")?.addEventListener("click", () => ctx.navigate("catalog"));
      ctx.refreshIcons();
      return;
    }
    const meta = C.typeMeta(object);
    const quality = C.qualityMeta(object.quality);
    const tabs = [
      ["properties", "属性"], ["links", "关系"], ["quality", "质量"], ["version", "版本"], ["evidence", "证据"],
    ];
    let body = renderObjectProperties(object);
    if (ctx.state.objectTab === "links") body = renderObjectLinks(object, ctx);
    if (ctx.state.objectTab === "quality") body = renderObjectQuality(object);
    if (ctx.state.objectTab === "version") body = renderObjectVersion(object, ctx);
    if (ctx.state.objectTab === "evidence") body = renderObjectEvidence(object, ctx);
    ctx.root.innerHTML = `
      ${heading("对象 360", "同一对象的属性、关系、质量、版本和证据共用一个稳定上下文。", `
        <button class="button secondary" data-lens-target="graph"><i data-lucide="share-2"></i>关系</button>
        <button class="button secondary" data-lens-target="temporal"><i data-lucide="chart-no-axes-combined"></i>时序</button>
        <button class="button secondary" data-lens-target="spatial"><i data-lucide="map"></i>空间</button>`)}
      <section class="workspace-stack">
        <div class="identity-banner">
          <span class="object-avatar"><i data-lucide="${meta.icon}"></i></span>
          <div><h3>${C.escapeHtml(object.title)}</h3><p>${C.escapeHtml(meta.label)} · ${C.escapeHtml(object.subtitle || "")}</p></div>
          <code>${C.escapeHtml(object.id)} · ${C.escapeHtml(object.stableKeyFingerprint || "stable-ref")}</code>
        </div>
        <section class="panel">
          <div class="panel-heading"><div><h3>对象详情</h3><span>当前角色：${C.escapeHtml(ctx.roleLabel())}</span></div><span class="status-chip ${quality.className}"><i></i>${quality.label}</span></div>
          <nav class="tabs" aria-label="对象详情页签">${tabs.map(([id, label]) => `<button class="${ctx.state.objectTab === id ? "active" : ""}" data-tab="${id}">${label}</button>`).join("")}</nav>
          <div class="panel-body">${body}</div>
        </section>
      </section>`;
    ctx.root.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => ctx.setState({ objectTab: button.dataset.tab })));
    ctx.root.querySelectorAll("[data-lens-target]").forEach((button) => button.addEventListener("click", () => ctx.navigate(button.dataset.lensTarget)));
    ctx.root.querySelectorAll("[data-object-id]").forEach((button) => button.addEventListener("click", () => ctx.selectObject(button.dataset.objectId, "object360")));
    ctx.refreshIcons();
  }

  function deterministicPosition(id, width, height) {
    let hash = 2166136261;
    for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    const angle = ((hash >>> 0) % 360) * Math.PI / 180;
    const radius = Math.min(width, height) * (.14 + ((hash >>> 8) % 100) / 550);
    return { x: width / 2 + Math.cos(angle) * radius, y: height / 2 + Math.sin(angle) * radius };
  }

  function drawGraph(ctx, slice) {
    const stage = ctx.root.querySelector("#graph-stage");
    if (!stage || !window.d3) return;
    const width = Math.max(560, stage.clientWidth || 760);
    const height = stage.clientHeight || 500;
    const svg = d3.select(stage).append("svg").attr("viewBox", `0 0 ${width} ${height}`);
    const nodes = slice.nodes.map((object) => {
      const saved = graphPositions.get(object.id) || deterministicPosition(object.id, width, height);
      return { ...object, x: saved.x, y: saved.y };
    });
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const links = slice.links
      .map((link) => ({ ...link, source: nodeById.get(link.from), target: nodeById.get(link.to) }))
      .filter((link) => link.source && link.target);
    const marker = svg.append("defs").append("marker").attr("id", "graph-arrow").attr("viewBox", "0 -5 10 10").attr("refX", 22).attr("refY", 0).attr("markerWidth", 5).attr("markerHeight", 5).attr("orient", "auto");
    marker.append("path").attr("d", "M0,-5L10,0L0,5").attr("fill", "#9caeba");
    const linkSelection = svg.append("g").selectAll("line").data(links).join("line").attr("class", (link) => `graph-link ${link.quality === "blocked" ? "blocked" : ""}`).attr("marker-end", "url(#graph-arrow)");
    const linkLabelSelection = svg.append("g").selectAll("text").data(links).join("text").attr("class", "graph-link-label").text((link) => C.linkMeta(link).label);
    const nodeSelection = svg.append("g").selectAll("g").data(nodes).join("g").attr("class", (node) => `graph-node ${node.quality === "blocked" ? "blocked" : ""}`).style("cursor", "pointer");
    const color = d3.scaleOrdinal().domain(Object.keys(C.TYPE_META)).range(["#2d6aa0", "#13715d", "#91611d", "#66538b", "#ad403c", "#16718a"]);
    nodeSelection.append("circle").attr("r", (node) => node.id === ctx.state.currentObjectId ? 17 : 13).attr("fill", (node) => color(node.objectTypeId));
    nodeSelection.append("text").attr("x", 18).attr("y", 3).text((node) => node.title.length > 13 ? `${node.title.slice(0, 13)}…` : node.title);
    nodeSelection.append("text").attr("class", "graph-node-type").attr("x", 18).attr("y", 14).text((node) => C.typeMeta(node).label);
    nodeSelection.append("title").text((node) => `${node.title}\n${C.typeMeta(node).label}\n${node.quality}`);
    nodeSelection.attr("tabindex", 0).attr("role", "button").attr("aria-label", (node) => `打开 ${node.title} ${C.typeMeta(node).label}`);
    nodeSelection.on("click", (_, node) => {
      ctx.setState({ graphSelectedId: node.id, returnLens: "graph", returnObjectId: ctx.state.currentObjectId, returnPosition: node.id }, { url: "replace" });
      ctx.selectObject(node.id, "graph");
    }).on("keydown", (event, node) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        ctx.selectObject(node.id, "graph");
      }
    });

    // Stable rings keep the research view deterministic across reloads and clients.
    const hopGroups = new Map();
    nodes.forEach((node) => {
      const group = hopGroups.get(node.hop) || [];
      group.push(node);
      hopGroups.set(node.hop, group);
    });
    hopGroups.forEach((group, hop) => {
      group.sort((left, right) => left.id.localeCompare(right.id));
      group.forEach((node, index) => {
        if (hop === 0) {
          node.x = width / 2;
          node.y = height / 2;
        } else {
          const angle = -Math.PI / 2 + (index / Math.max(group.length, 1)) * Math.PI * 2;
          const radius = Math.min(width, height) * (hop === 1 ? .25 : .41);
          node.x = width / 2 + Math.cos(angle) * radius;
          node.y = height / 2 + Math.sin(angle) * radius;
        }
        node.x = Math.max(24, Math.min(width - 100, node.x));
        node.y = Math.max(24, Math.min(height - 24, node.y));
        graphPositions.set(node.id, { x: node.x, y: node.y });
      });
    });
    linkSelection.attr("x1", (link) => link.source.x).attr("y1", (link) => link.source.y).attr("x2", (link) => link.target.x).attr("y2", (link) => link.target.y);
    linkLabelSelection.attr("x", (link) => (link.source.x + link.target.x) / 2).attr("y", (link) => (link.source.y + link.target.y) / 2 - 5);
    nodeSelection.attr("transform", (node) => `translate(${node.x},${node.y})`);
  }

  function renderGraph(ctx) {
    cleanup();
    const object = C.objectById(ctx.resource, ctx.state.currentObjectId);
    if (!C.isAllowed(object, ctx.state.roleId)) {
      ctx.root.innerHTML = deniedView(object, ctx);
      ctx.refreshIcons();
      return;
    }
    const slice = C.graphSlice(ctx.resource, ctx.state);
    const selectedCandidate = C.objectById(ctx.resource, ctx.state.graphSelectedId);
    const selected = slice.nodes.some((node) => node.id === selectedCandidate?.id) && C.isAllowed(selectedCandidate, ctx.state.roleId) ? selectedCandidate : object;
    ctx.root.innerHTML = `
      ${heading("关系图 · 对象网络", "采用知识图谱式呈现，仅展示已授权的 Published Link 实例；空间位置不在此 Lens 重复呈现。", `
        <div class="segmented" aria-label="展开跳数"><button data-hops="1" class="${ctx.state.graphHops === 1 ? "active" : ""}">1 跳</button><button data-hops="2" class="${ctx.state.graphHops === 2 ? "active" : ""}">2 跳</button></div>
        <button class="button secondary" id="relayout-graph"><i data-lucide="refresh-cw"></i>重新布局</button>`)}
      <div class="graph-layout">
        <section id="graph-stage" class="graph-stage" aria-label="对象关系图"></section>
        <aside class="graph-side">
          <div class="control-block"><h4>关系质量</h4><div class="check-list">
            ${["passed", "warning", "blocked"].map((quality) => `<label class="check-row"><input type="checkbox" data-graph-quality="${quality}" ${ctx.state.graphQuality.includes(quality) ? "checked" : ""}>${C.qualityMeta(quality).label}</label>`).join("")}
          </div></div>
          <div class="control-block"><h4>图谱预算</h4><dl class="definition-list" style="grid-template-columns:1fr"><div><dt>节点</dt><dd>${slice.nodes.length} / ${slice.nodeCap}</dd></div><div><dt>语义边</dt><dd>${slice.links.length} / ${slice.edgeCap}</dd></div></dl>${slice.truncated ? '<div class="graph-detail" style="margin-top:8px;color:var(--amber)">已达到图谱预算；请缩小跳数或质量筛选，未加载部分不等同于无关系。</div>' : ""}</div>
          <div class="control-block"><h4>对象类型</h4><div class="graph-legend">${[...new Set(slice.nodes.map((node) => node.objectTypeId))].map((typeId) => `<span><i style="--legend-color:${C.SERIES_COLORS[Math.abs(typeId.length) % C.SERIES_COLORS.length]}"></i>${C.escapeHtml(C.typeMeta(typeId).label)}</span>`).join("")}</div><div class="graph-detail" style="margin-top:8px">研究夹具默认不进入业务知识图谱；空间对象请从空间 Lens 发起回链。</div></div>
          <div class="graph-detail"><strong>${C.escapeHtml(selected?.title || "未选择")}</strong><br>${C.escapeHtml(C.typeMeta(selected).label)}<br><code>${C.escapeHtml(selected?.id || "")}</code><br><small>${selected ? C.escapeHtml(selected.quality) : ""}</small></div>
          <button class="button secondary" id="open-graph-object"><i data-lucide="scan-face"></i>打开对象 360</button>
        </aside>
      </div>`;
    ctx.root.querySelectorAll("[data-hops]").forEach((button) => button.addEventListener("click", () => ctx.setState({ graphHops: Number(button.dataset.hops) })));
    ctx.root.querySelectorAll("[data-graph-quality]").forEach((input) => input.addEventListener("change", () => {
      const values = [...ctx.root.querySelectorAll("[data-graph-quality]:checked")].map((item) => item.dataset.graphQuality);
      ctx.setState({ graphQuality: values.length ? values : ["passed"] });
    }));
    ctx.root.querySelector("#open-graph-object")?.addEventListener("click", () => ctx.navigate("object360"));
    ctx.root.querySelector("#relayout-graph")?.addEventListener("click", () => {
      graphPositions.clear();
      ctx.setState({ graphSelectedId: null });
    });
    drawGraph(ctx, slice);
    ctx.refreshIcons();
  }

  function transformedPoints(series, transform) {
    const points = series.points.map((point) => ({ ...point, date: new Date(`${point.t}T00:00:00+08:00`) }));
    if (transform === "rolling") {
      return points.map((point, index) => {
        if (point.v == null) return { ...point, y: null };
        const window = points.slice(Math.max(0, index - 3), index + 1).map((item) => item.v).filter((value) => value != null);
        return { ...point, y: window.length ? window.reduce((sum, value) => sum + value, 0) / window.length : null };
      });
    }
    if (transform === "diff") {
      return points.map((point, index) => {
        const previous = index > 0 ? points[index - 1] : null;
        return { ...point, y: point.v != null && previous?.v != null ? point.v - previous.v : null };
      });
    }
    return points.map((point) => ({ ...point, y: point.v }));
  }

  function temporalEvents(seriesList, from, to) {
    const events = [];
    for (const series of seriesList) {
      const points = transformedPoints(series, "raw").filter((point) => point.date >= from && point.date <= to);
      for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1];
        const current = points[index];
        if (previous.v == null && current.v != null) events.push({ date: current.date, label: `${series.label} 开始观测`, seriesId: series.id });
        else if (previous.v != null && current.v == null) events.push({ date: current.date, label: `${series.label} 中断观测`, seriesId: series.id });
        else if (previous.v && current.v != null && Math.abs((current.v - previous.v) / previous.v) >= .25) events.push({ date: current.date, label: `${series.label} 变化超过 25%`, seriesId: series.id });
      }
    }
    return events.sort((a, b) => a.date - b.date);
  }

  function drawTemporalChart(ctx, selectedSeries, events) {
    const stage = ctx.root.querySelector("#chart-stage");
    if (!stage || !window.d3 || !selectedSeries.length) return;
    const width = Math.max(600, stage.clientWidth || 820);
    const height = 420;
    const margin = { top: 22, right: 26, bottom: 39, left: 62 };
    const from = new Date(`${ctx.state.temporalFrom}T00:00:00+08:00`);
    const to = new Date(`${ctx.state.temporalTo}T23:59:59+08:00`);
    const transformed = selectedSeries.map((series) => ({
      series,
      points: transformedPoints(series, ctx.state.temporalTransform).filter((point) => point.date >= from && point.date <= to),
    }));
    const values = transformed.flatMap((item) => item.points.map((point) => point.y).filter((value) => value != null));
    const svg = d3.select(stage).append("svg").attr("viewBox", `0 0 ${width} ${height}`);
    if (!values.length) {
      svg.append("text").attr("x", width / 2).attr("y", height / 2).attr("text-anchor", "middle").attr("fill", "#68798a").text("当前范围没有可绘制点");
      return;
    }
    const x = d3.scaleTime().domain([from, to]).range([margin.left, width - margin.right]);
    let extent = d3.extent(values);
    if (extent[0] === extent[1]) extent = [extent[0] - 1, extent[1] + 1];
    const padding = (extent[1] - extent[0]) * .08;
    const y = d3.scaleLinear().domain([extent[0] - padding, extent[1] + padding]).nice().range([height - margin.bottom, margin.top]);
    svg.append("g").attr("class", "gridline").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(6).tickSize(-(width - margin.left - margin.right)).tickFormat(""));
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).ticks(Math.min(7, Math.floor(width / 110))).tickFormat(d3.timeFormat("%Y-%m")));
    svg.append("g").attr("class", "axis").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(6).tickFormat((value) => C.formatNumber(value, selectedSeries[0].unit)));
    const line = d3.line().defined((point) => point.y != null).x((point) => x(point.date)).y((point) => y(point.y));
    transformed.forEach((item, index) => {
      const color = C.SERIES_COLORS[index % C.SERIES_COLORS.length];
      svg.append("path").datum(item.points).attr("class", "series-line").attr("stroke", color).attr("d", line);
      if (ctx.state.temporalThreshold && item.series.researchThreshold != null && ctx.state.temporalTransform === "raw") {
        svg.append("line").attr("class", "threshold-line").attr("x1", margin.left).attr("x2", width - margin.right).attr("y1", y(item.series.researchThreshold)).attr("y2", y(item.series.researchThreshold)).attr("stroke", color);
      }
    });
    const currentEvent = events[ctx.state.eventIndex % Math.max(events.length, 1)];
    if (currentEvent) svg.append("line").attr("x1", x(currentEvent.date)).attr("x2", x(currentEvent.date)).attr("y1", margin.top).attr("y2", height - margin.bottom).attr("stroke", "#ad403c").attr("stroke-dasharray", "3 3");
    const overlay = svg.append("rect").attr("x", margin.left).attr("y", margin.top).attr("width", width - margin.left - margin.right).attr("height", height - margin.top - margin.bottom).attr("fill", "transparent").style("cursor", "crosshair");
    const cursor = svg.append("line").attr("y1", margin.top).attr("y2", height - margin.bottom).attr("stroke", "#718594").attr("stroke-dasharray", "2 2").style("display", "none");
    const tooltip = ctx.root.querySelector("#chart-tooltip");
    overlay.on("mousemove", function (event) {
      const [mouseX, mouseY] = d3.pointer(event, stage);
      const date = x.invert(mouseX);
      const bisect = d3.bisector((point) => point.date).center;
      const lines = transformed.map((item, index) => {
        const point = item.points[bisect(item.points, date)];
        return `<span style="color:${C.SERIES_COLORS[index % C.SERIES_COLORS.length]}">●</span> ${C.escapeHtml(C.objectById(ctx.resource, item.series.ownerObjectId)?.title || item.series.ownerObjectId)}：${C.formatNumber(point?.y, item.series.unit)}${point?.state !== "observed" ? ` (${C.escapeHtml(point?.state || "missing")})` : ""}`;
      });
      const nearest = transformed[0]?.points[bisect(transformed[0].points, date)];
      cursor.attr("x1", x(nearest?.date || date)).attr("x2", x(nearest?.date || date)).style("display", null);
      tooltip.innerHTML = `<strong>${d3.timeFormat("%Y-%m-%d")(nearest?.date || date)}</strong><br>${lines.join("<br>")}`;
      tooltip.style.display = "block";
      tooltip.style.left = `${Math.min(stage.clientWidth - 170, Math.max(8, mouseX + 12))}px`;
      tooltip.style.top = `${Math.max(8, mouseY - 20)}px`;
    }).on("mouseleave", () => { cursor.style("display", "none"); tooltip.style.display = "none"; });
  }

  function renderTemporal(ctx) {
    cleanup();
    const currentObject = C.objectById(ctx.resource, ctx.state.currentObjectId);
    if (!C.isAllowed(currentObject, ctx.state.roleId)) {
      ctx.root.innerHTML = deniedView(currentObject, ctx);
      ctx.refreshIcons();
      return;
    }
    const ownerAllowed = new Set(C.allowedObjects(ctx.resource, ctx.state.roleId).map((object) => object.id));
    const available = ctx.resource.series.filter((series) => series.propertyId.endsWith(`.${ctx.state.temporalMetric}`) && ownerAllowed.has(series.ownerObjectId));
    const defaults = available.slice(0, 4).map((series) => series.id);
    const activeIds = ctx.state.seriesIds.filter((id) => available.some((series) => series.id === id));
    const selectedIds = activeIds.length ? activeIds : defaults;
    const selectedSeries = available.filter((series) => selectedIds.includes(series.id));
    const from = new Date(`${ctx.state.temporalFrom}T00:00:00+08:00`);
    const to = new Date(`${ctx.state.temporalTo}T23:59:59+08:00`);
    const events = temporalEvents(selectedSeries, from, to);
    const event = events.length ? events[ctx.state.eventIndex % events.length] : null;
    const missingCount = selectedSeries.reduce((sum, series) => sum + series.points.filter((point) => point.state !== "observed").length, 0);
    const metricOptions = [
      ["marketValue", "当前市值"], ["investmentAmount", "投资金额"], ["unrealizedPnl", "浮动盈亏"], ["price", "现价"],
    ];
    ctx.root.innerHTML = `
      ${heading("时序探索", "系列叠加、四点滚动、差分、研究阈值与事件定位共用同一时间范围。", `
        <input class="date-input" id="time-from" type="date" value="${C.escapeHtml(ctx.state.temporalFrom)}" aria-label="开始日期">
        <span>至</span>
        <input class="date-input" id="time-to" type="date" value="${C.escapeHtml(ctx.state.temporalTo)}" aria-label="结束日期">`)}
      <div class="temporal-layout">
        <aside class="series-rail">
          <div class="control-block"><h4>系列属性</h4><select class="compact-select" id="metric-select" style="width:100%">${metricOptions.map(([id, label]) => `<option value="${id}" ${ctx.state.temporalMetric === id ? "selected" : ""}>${label}</option>`).join("")}</select></div>
          <div class="control-block"><h4>叠加系列</h4><div class="check-list">${available.map((series, index) => {
            const owner = C.objectById(ctx.resource, series.ownerObjectId);
            return `<label class="series-option ${selectedIds.includes(series.id) ? "active" : ""}" style="--series-color:${C.SERIES_COLORS[index % C.SERIES_COLORS.length]}"><input type="checkbox" data-series-id="${C.escapeHtml(series.id)}" ${selectedIds.includes(series.id) ? "checked" : ""}><i class="series-swatch"></i><span>${C.escapeHtml(owner?.title || series.ownerObjectId)}</span></label>`;
          }).join("")}</div></div>
          <div class="control-block"><h4>变换</h4><div class="segmented" style="width:100%">${[["raw", "原值"], ["rolling", "滚动"], ["diff", "差分"]].map(([id, label]) => `<button data-transform="${id}" class="${ctx.state.temporalTransform === id ? "active" : ""}" style="flex:1">${label}</button>`).join("")}</div><label class="check-row" style="margin-top:7px"><input id="threshold-toggle" type="checkbox" ${ctx.state.temporalThreshold ? "checked" : ""}>研究阈值</label></div>
        </aside>
        <section class="panel chart-panel">
          <div class="panel-heading"><div><h3>${C.escapeHtml(metricOptions.find(([id]) => id === ctx.state.temporalMetric)?.[1] || "系列")}</h3><span>${selectedSeries.length} 个系列 · P1W-irregular · Asia/Shanghai</span></div><span class="status-chip ${missingCount ? "warning" : "success"}"><i></i>${missingCount ? `${missingCount} 个非观测点` : "点级质量通过"}</span></div>
          <div id="chart-stage" class="chart-stage"><div id="chart-tooltip" class="chart-tooltip"></div></div>
          <footer class="chart-foot"><span>缺失点保持断线，零值按真实 0 绘制。</span><div class="event-nav"><button class="icon-button" id="event-prev" title="上一个事件" aria-label="上一个事件"><i data-lucide="chevron-left"></i></button><span class="event-label">${event ? `${event.date.toISOString().slice(0, 10)} · ${C.escapeHtml(event.label)}` : "范围内没有派生事件"}</span><button class="icon-button" id="event-next" title="下一个事件" aria-label="下一个事件"><i data-lucide="chevron-right"></i></button></div></footer>
        </section>
      </div>`;
    ctx.root.querySelector("#metric-select")?.addEventListener("change", (eventTarget) => ctx.setState({ temporalMetric: eventTarget.target.value, seriesIds: [], eventIndex: 0 }));
    ctx.root.querySelectorAll("[data-series-id]").forEach((input) => input.addEventListener("change", () => {
      const ids = [...ctx.root.querySelectorAll("[data-series-id]:checked")].map((item) => item.dataset.seriesId);
      ctx.setState({ seriesIds: ids, eventIndex: 0 });
    }));
    ctx.root.querySelectorAll("[data-transform]").forEach((button) => button.addEventListener("click", () => ctx.setState({ temporalTransform: button.dataset.transform, eventIndex: 0 })));
    ctx.root.querySelector("#threshold-toggle")?.addEventListener("change", (eventTarget) => ctx.setState({ temporalThreshold: eventTarget.target.checked }));
    ctx.root.querySelector("#time-from")?.addEventListener("change", (eventTarget) => ctx.setState({ temporalFrom: eventTarget.target.value, eventIndex: 0 }));
    ctx.root.querySelector("#time-to")?.addEventListener("change", (eventTarget) => ctx.setState({ temporalTo: eventTarget.target.value, eventIndex: 0 }));
    ctx.root.querySelector("#event-prev")?.addEventListener("click", () => ctx.setState({ eventIndex: events.length ? (ctx.state.eventIndex - 1 + events.length) % events.length : 0 }));
    ctx.root.querySelector("#event-next")?.addEventListener("click", () => ctx.setState({ eventIndex: events.length ? (ctx.state.eventIndex + 1) % events.length : 0 }));
    drawTemporalChart(ctx, selectedSeries, events);
    ctx.refreshIcons();
  }

  function renderSpatial(ctx) {
    cleanup();
    const currentObject = C.objectById(ctx.resource, ctx.state.currentObjectId);
    if (!C.isAllowed(currentObject, ctx.state.roleId)) {
      ctx.root.innerHTML = deniedView(currentObject, ctx);
      ctx.refreshIcons();
      return;
    }
    const currentGeometry = C.geometryOf(currentObject);
    const fixtureObjects = C.allowedObjects(ctx.resource, ctx.state.roleId).filter((object) => object.technicalFixture && C.geometryOf(object));
    const selectionText = ctx.state.mapSelection.length ? `${ctx.state.mapSelection.length} 个对象位于当前框选范围` : "尚未形成范围选择";
    ctx.root.innerHTML = `
      ${heading("空间探索", "只处理 geometry、图层、有效时间和范围选择；对象联系统一回到知识图谱。", `
        <button class="button secondary" id="map-box-select"><i data-lucide="scan"></i>框选</button>
        <button class="button secondary" id="map-fit-object"><i data-lucide="locate-fixed"></i>定位对象</button>
        <button class="button secondary" id="open-graph"><i data-lucide="share-2"></i>打开关系图</button>`)}
      <div class="spatial-layout">
        <section class="map-panel"><div id="map"></div>${currentGeometry ? "" : `<div class="map-overlay-state"><strong>当前对象空间不适用</strong><br>验证资源没有为 ${C.escapeHtml(currentObject.title)} 提供权威 geometry。地图仅显示明确标注的空间技术夹具。</div>`}</section>
        <aside class="map-side">
          <div class="control-block"><h4>图层</h4><label class="check-row"><input type="checkbox" data-map-layer="fixtures" ${ctx.state.mapLayers.includes("fixtures") ? "checked" : ""}>空间技术夹具</label><label class="check-row"><input type="checkbox" data-map-layer="valid-time" checked>有效时间</label></div>
          <div class="map-selection"><strong>${C.escapeHtml(selectionText)}</strong><span>bbox 会写入深链并在返回时恢复。</span></div>
          <div class="control-block"><h4>可定位对象</h4><div class="check-list">${fixtureObjects.map((object) => `<button class="object-row" data-geo-object="${object.id}" style="min-height:44px"><span class="type-symbol"><i data-lucide="map-pin"></i></span><span class="object-copy"><strong>${C.escapeHtml(object.title)}</strong><span>EPSG:4326</span></span><span class="quality-dot"></span></button>`).join("")}</div></div>
          <div class="validation-note"><strong>模式边界：</strong>夹具坐标只验证交互与查询合同，不代表 S005 管理人、发行人或持仓的真实位置或暴露。</div>
        </aside>
      </div>`;
    ctx.root.querySelectorAll("[data-map-layer]").forEach((input) => input.addEventListener("change", () => {
      const layers = [...ctx.root.querySelectorAll("[data-map-layer]:checked")].map((item) => item.dataset.mapLayer);
      ctx.setState({ mapLayers: layers });
    }));
    ctx.root.querySelectorAll("[data-geo-object]").forEach((button) => button.addEventListener("click", () => ctx.selectObject(button.dataset.geoObject, "spatial")));
    ctx.root.querySelector("#open-graph")?.addEventListener("click", () => ctx.navigate("graph"));
    ctx.refreshIcons();
    initializeMap(ctx, currentObject, fixtureObjects);
  }

  function initializeMap(ctx, currentObject, fixtureObjects) {
    const container = ctx.root.querySelector("#map");
    if (!container || !window.L) {
      container.innerHTML = '<div class="blocked-state"><div><span class="state-icon-large"><i data-lucide="map-off"></i></span><h3>地图运行库不可用</h3><p>空间 Lens 已失败关闭；未把空白区域当成功。</p></div></div>';
      ctx.refreshIcons();
      return;
    }
    activeMap = L.map(container, { zoomControl: true, boxZoom: false }).setView([34.5, 108.5], 4);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors", maxZoom: 18 }).addTo(activeMap);
    const markerById = new Map();
    if (ctx.state.mapLayers.includes("fixtures")) {
      fixtureObjects.forEach((object) => {
        const coordinates = C.geometryOf(object).coordinates;
        const marker = L.circleMarker([coordinates[1], coordinates[0]], { radius: object.id === currentObject.id ? 10 : 7, color: "#1b4f7b", weight: 2, fillColor: object.id === currentObject.id ? "#2d6aa0" : "#16718a", fillOpacity: .86 }).addTo(activeMap);
        marker.bindTooltip(object.title);
        marker.on("click", () => ctx.selectObject(object.id, "spatial"));
        markerById.set(object.id, marker);
      });
    }
    const currentGeometry = C.geometryOf(currentObject);
    if (ctx.state.bbox) {
      const [west, south, east, north] = ctx.state.bbox;
      activeMap.fitBounds([[south, west], [north, east]], { animate: false });
    } else if (currentGeometry) {
      activeMap.setView([currentGeometry.coordinates[1], currentGeometry.coordinates[0]], 7, { animate: false });
    } else if (fixtureObjects.length) {
      const bounds = L.latLngBounds(fixtureObjects.map((object) => {
        const coordinates = C.geometryOf(object).coordinates;
        return [coordinates[1], coordinates[0]];
      }));
      activeMap.fitBounds(bounds.pad(.35), { animate: false });
    }
    activeMap.on("moveend", () => {
      const bounds = activeMap.getBounds();
      ctx.setState({ bbox: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()] }, { render: false, url: "replace" });
    });
    let selectMode = false;
    let selectionStart = null;
    let rectangle = null;
    const selectButton = ctx.root.querySelector("#map-box-select");
    selectButton?.addEventListener("click", () => {
      selectMode = !selectMode;
      selectButton.classList.toggle("danger", selectMode);
      selectButton.innerHTML = selectMode ? '<i data-lucide="x"></i>取消框选' : '<i data-lucide="scan"></i>框选';
      if (selectMode) activeMap.dragging.disable(); else activeMap.dragging.enable();
      ctx.refreshIcons();
    });
    activeMap.on("mousedown", (event) => {
      if (!selectMode) return;
      selectionStart = event.latlng;
      if (rectangle) rectangle.remove();
    });
    activeMap.on("mousemove", (event) => {
      if (!selectMode || !selectionStart) return;
      const bounds = L.latLngBounds(selectionStart, event.latlng);
      if (!rectangle) rectangle = L.rectangle(bounds, { color: "#2d6aa0", weight: 1, fillOpacity: .1 }).addTo(activeMap);
      else rectangle.setBounds(bounds);
    });
    activeMap.on("mouseup", (event) => {
      if (!selectMode || !selectionStart) return;
      const bounds = L.latLngBounds(selectionStart, event.latlng);
      const ids = fixtureObjects.filter((object) => {
        const coordinates = C.geometryOf(object).coordinates;
        return bounds.contains([coordinates[1], coordinates[0]]);
      }).map((object) => object.id);
      selectionStart = null;
      selectMode = false;
      activeMap.dragging.enable();
      ctx.setState({ mapSelection: ids, bbox: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()] });
      ctx.toast(ids.length ? `框选命中 ${ids.length} 个对象` : "框选范围没有对象", ids.length ? "success" : "warning");
    });
    ctx.root.querySelector("#map-fit-object")?.addEventListener("click", () => {
      const geometry = C.geometryOf(currentObject);
      if (!geometry) {
        ctx.toast("当前对象没有权威 geometry，未改变地图范围", "warning");
        return;
      }
      activeMap.setView([geometry.coordinates[1], geometry.coordinates[0]], 8);
    });
    setTimeout(() => activeMap?.invalidateSize(), 50);
  }

  window.M07Views = { renderCatalog, renderObject360, renderGraph, renderTemporal, renderSpatial, cleanup };
}());
