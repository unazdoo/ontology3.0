(function () {
  "use strict";

  const C = window.M07Core;
  const V = window.M07Views;
  const elements = {
    app: document.querySelector("#app"),
    lensNav: document.querySelector("#lens-nav"),
    contextStrip: document.querySelector("#context-strip"),
    workspace: document.querySelector("#workspace"),
    root: document.querySelector("#workspace-content"),
    objectList: document.querySelector("#object-list"),
    resultCount: document.querySelector("#result-count"),
    search: document.querySelector("#object-search"),
    clearSearch: document.querySelector("#clear-search"),
    typeFilter: document.querySelector("#type-filter"),
    qualityFilter: document.querySelector("#quality-filter"),
    roleSelect: document.querySelector("#role-select"),
    copyLink: document.querySelector("#copy-link"),
    historyBack: document.querySelector("#history-back"),
    openValidation: document.querySelector("#open-validation"),
    validationDialog: document.querySelector("#validation-dialog"),
    validationContent: document.querySelector("#validation-content"),
    toastRegion: document.querySelector("#toast-region"),
  };

  const runtime = {
    resource: null,
    state: null,
    performance: null,
    validation: [],
    resizeTimer: null,
  };

  function refreshIcons() {
    if (window.lucide?.createIcons) window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
  }

  function toast(message, type = "info") {
    const icon = type === "success" ? "circle-check" : type === "warning" ? "triangle-alert" : type === "danger" ? "circle-x" : "info";
    const item = document.createElement("div");
    item.className = "toast";
    item.innerHTML = `<i data-lucide="${icon}"></i><span>${C.escapeHtml(message)}</span>`;
    elements.toastRegion.append(item);
    refreshIcons();
    setTimeout(() => item.remove(), 3200);
  }

  function roleLabel() {
    return runtime.resource.roles.find((role) => role.id === runtime.state.roleId)?.label || runtime.state.roleId;
  }

  function viewContext() {
    return {
      resource: runtime.resource,
      state: runtime.state,
      root: elements.root,
      setState,
      navigate,
      selectObject,
      toast,
      refreshIcons,
      roleLabel,
    };
  }

  function currentObject() {
    return C.objectById(runtime.resource, runtime.state.currentObjectId);
  }

  function validateResource(resource) {
    const checks = [
      ["schema", resource.schemaVersion === "ofw.m07.validation-resource.v1", resource.schemaVersion],
      ["namespace", resource.namespace === "ofw.m07.research.v1", resource.namespace],
      ["researchOnly", resource.researchOnly === true, String(resource.researchOnly)],
      ["snapshots", resource.source?.snapshots?.length === 79, `${resource.source?.snapshots?.length || 0} / 79`],
      ["objects", resource.objects?.length >= 15, String(resource.objects?.length || 0)],
      ["series", resource.series?.length >= 16, String(resource.series?.length || 0)],
      ["series-points", resource.series?.every((series) => series.points.length === resource.source.snapshots.length), "每系列与快照数一致"],
      ["deidentified", !JSON.stringify(resource).match(/OO\d{6}|P\d{6}|曾广云|钟咏红/), "原标识未进入资源"],
    ];
    runtime.validation = checks.map(([id, passed, detail]) => ({ id, passed, detail }));
    if (checks.some(([, passed]) => !passed)) throw new Error(`Validation resource failed: ${checks.filter(([, passed]) => !passed).map(([id]) => id).join(", ")}`);
  }

  async function loadPerformanceEvidence() {
    try {
      const response = await fetch("../../research/m07-ontology-exploration/performance/results.json", { cache: "no-store" });
      if (!response.ok) return null;
      return response.json();
    } catch (_) {
      return null;
    }
  }

  function renderLensNav() {
    elements.lensNav.innerHTML = C.LENSES.map((lens) => `
      <button class="lens-button ${runtime.state.lens === lens.id ? "active" : ""}" type="button" data-lens="${lens.id}" title="${lens.title}" aria-label="${lens.title}" aria-current="${runtime.state.lens === lens.id ? "page" : "false"}">
        <i data-lucide="${lens.icon}"></i><span>${lens.label}</span>
      </button>`).join("");
    elements.lensNav.querySelectorAll("[data-lens]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.lens)));
  }

  function renderRoleOptions() {
    elements.roleSelect.innerHTML = runtime.resource.roles.map((role) => `<option value="${C.escapeHtml(role.id)}" ${runtime.state.roleId === role.id ? "selected" : ""}>${C.escapeHtml(role.label)}</option>`).join("");
  }

  function renderFilterOptions() {
    const allowedTypes = [...new Set(C.allowedObjects(runtime.resource, runtime.state.roleId).map((object) => object.objectTypeId))].sort();
    elements.typeFilter.innerHTML = `<option value="all">全部类型</option>${allowedTypes.map((typeId) => `<option value="${C.escapeHtml(typeId)}" ${runtime.state.typeFilter === typeId ? "selected" : ""}>${C.escapeHtml(C.typeMeta(typeId).label)}</option>`).join("")}`;
    if (!allowedTypes.includes(runtime.state.typeFilter)) runtime.state.typeFilter = "all";
    elements.qualityFilter.value = runtime.state.qualityFilter;
    elements.search.value = runtime.state.search;
  }

  function renderObjectDirectory() {
    const rows = C.filteredObjects(runtime.resource, runtime.state);
    elements.resultCount.textContent = String(rows.length);
    elements.objectList.innerHTML = rows.map((object) => {
      const meta = C.typeMeta(object);
      return `
        <button type="button" role="option" aria-selected="${object.id === runtime.state.currentObjectId}" class="object-row ${object.id === runtime.state.currentObjectId ? "selected" : ""}" data-object-id="${C.escapeHtml(object.id)}">
          <span class="type-symbol"><i data-lucide="${meta.icon}"></i></span>
          <span class="object-copy"><strong>${C.escapeHtml(object.title)}</strong><span>${C.escapeHtml(meta.label)} · ${C.escapeHtml(object.id)}</span></span>
          <span class="quality-dot ${object.quality}"></span>
        </button>`;
    }).join("") || `<div class="empty-state" style="min-height:130px;padding:12px"><div><span class="state-icon-large" style="width:36px;height:36px"><i data-lucide="search-x"></i></span><h3 style="font-size:12px">无匹配对象</h3></div></div>`;
    elements.objectList.querySelectorAll("[data-object-id]").forEach((button) => button.addEventListener("click", () => selectObject(button.dataset.objectId, runtime.state.lens === "catalog" ? "object360" : runtime.state.lens)));
  }

  function renderContext() {
    const object = currentObject();
    const allowed = C.isAllowed(object, runtime.state.roleId);
    const meta = C.typeMeta(object);
    const quality = allowed ? C.qualityMeta(object.quality) : { label: "访问拒绝", className: "danger" };
    const returnButton = runtime.state.returnLens ? `<button class="button secondary" id="return-source" type="button"><i data-lucide="corner-up-left"></i>返回来源</button>` : "";
    elements.contextStrip.innerHTML = `
      <div class="context-main">
        <span class="object-avatar"><i data-lucide="${allowed ? meta.icon : "lock-keyhole"}"></i></span>
        <div class="context-title"><b>${allowed ? C.escapeHtml(object?.title || "未选择对象") : "受限对象"}</b><span>${allowed ? `${C.escapeHtml(meta.label)} · ${C.escapeHtml(object?.subtitle || "")}` : "已重新执行授权，未暴露对象属性"}</span></div>
        <span class="status-chip ${quality.className}"><i></i>${quality.label}</span>
        ${returnButton}
      </div>
      <div class="context-meta">
        <div class="context-kv"><span>ObjectRef</span><code>${allowed ? C.escapeHtml(object?.id || "none") : "REDACTED"}</code></div>
        <div class="context-kv"><span>Published</span><code>${C.escapeHtml(runtime.resource.ontologyContext.publishedSemanticVersionId)}</code></div>
        <div class="context-kv"><span>Binding</span><code>${C.escapeHtml(runtime.resource.ontologyContext.authoritativeBindingId)}</code></div>
      </div>`;
    elements.contextStrip.querySelector("#return-source")?.addEventListener("click", returnToSource);
  }

  function renderWorkspace() {
    const renderers = {
      catalog: V.renderCatalog,
      object360: V.renderObject360,
      graph: V.renderGraph,
      temporal: V.renderTemporal,
      spatial: V.renderSpatial,
    };
    (renderers[runtime.state.lens] || V.renderCatalog)(viewContext());
    if (runtime.state.returnPosition?.startsWith("scroll:")) {
      const y = Number(runtime.state.returnPosition.slice(7));
      if (Number.isFinite(y)) requestAnimationFrame(() => elements.workspace.scrollTo({ top: y, behavior: "instant" }));
    }
  }

  function renderAll() {
    renderLensNav();
    renderRoleOptions();
    renderFilterOptions();
    renderObjectDirectory();
    renderContext();
    renderWorkspace();
    refreshIcons();
    elements.app.setAttribute("aria-busy", "false");
  }

  function setState(patch, options = {}) {
    runtime.state = { ...runtime.state, ...patch };
    C.commitUrl(runtime.state, options.url || "replace");
    if (options.render !== false) renderAll();
  }

  function captureReturn() {
    return {
      returnLens: runtime.state.lens,
      returnObjectId: runtime.state.currentObjectId,
      returnPosition: `scroll:${Math.round(elements.workspace.scrollTop)}`,
    };
  }

  function navigate(lens) {
    if (!C.LENSES.some((item) => item.id === lens)) return;
    runtime.state = { ...runtime.state, ...captureReturn(), lens };
    C.commitUrl(runtime.state, "push");
    elements.workspace.scrollTop = 0;
    renderAll();
  }

  function selectObject(objectId, lens = runtime.state.lens) {
    const object = C.objectById(runtime.resource, objectId);
    if (!object) {
      toast("对象引用不存在，已失败关闭", "danger");
      return;
    }
    const returnState = objectId === runtime.state.currentObjectId ? {} : captureReturn();
    runtime.state = { ...runtime.state, ...returnState, currentObjectId: objectId, graphSelectedId: objectId, lens };
    C.commitUrl(runtime.state, "push");
    elements.workspace.scrollTop = 0;
    renderAll();
  }

  function returnToSource() {
    const lens = C.LENSES.some((item) => item.id === runtime.state.returnLens) ? runtime.state.returnLens : "catalog";
    const objectId = C.objectById(runtime.resource, runtime.state.returnObjectId)?.id || runtime.state.currentObjectId;
    const position = runtime.state.returnPosition;
    runtime.state = { ...runtime.state, lens, currentObjectId: objectId, returnLens: null, returnObjectId: null, returnPosition: position };
    C.commitUrl(runtime.state, "push");
    renderAll();
  }

  async function copyStableLink() {
    const link = location.href;
    try {
      await navigator.clipboard.writeText(link);
      toast("稳定深链已复制；打开时仍会重新授权", "success");
    } catch (_) {
      const textArea = document.createElement("textarea");
      textArea.value = link;
      document.body.append(textArea);
      textArea.select();
      document.execCommand("copy");
      textArea.remove();
      toast("稳定深链已复制", "success");
    }
  }

  function performanceSummary() {
    if (!runtime.performance) return { passed: false, label: "性能证据未加载", detail: "请从工作区根目录提供 research 路径" };
    const summary = runtime.performance.summary || runtime.performance;
    const passed = summary.allGatesPassed ?? runtime.performance.allGatesPassed ?? false;
    const production = runtime.performance.productionClaim ?? summary.productionClaim ?? false;
    return { passed, label: passed ? "合成性能门通过" : "合成性能门未通过", detail: `productionClaim=${production}` };
  }

  function openValidationDialog() {
    const passed = runtime.validation.filter((check) => check.passed).length;
    const performance = performanceSummary();
    elements.validationContent.innerHTML = `
      <div class="validation-grid">
        <div class="validation-stat"><span>资源检查</span><strong>${passed}/${runtime.validation.length}</strong></div>
        <div class="validation-stat"><span>对象 / 关系 / 系列</span><strong>${runtime.resource.objects.length} / ${runtime.resource.links.length} / ${runtime.resource.series.length}</strong></div>
        <div class="validation-stat"><span>来源快照</span><strong>${runtime.resource.source.snapshots.length}</strong></div>
        <div class="validation-stat"><span>来源日期</span><strong>${runtime.resource.source.dateRange.from}<br>${runtime.resource.source.dateRange.to}</strong></div>
        <div class="validation-stat"><span>性能技术验证</span><strong style="color:${performance.passed ? "var(--green)" : "var(--amber)"}">${performance.label}</strong></div>
        <div class="validation-stat"><span>立项/验收状态</span><strong style="color:var(--red)">不满足</strong></div>
      </div>
      <div class="validation-note"><strong>资源门：</strong>${runtime.validation.map((check) => `${check.passed ? "通过" : "失败"} ${C.escapeHtml(check.id)}`).join(" · ")}</div>
      <div class="validation-note"><strong>性能边界：</strong>${C.escapeHtml(performance.detail)}。本地单线程热内存合成测试不代表生产后端、网络、并发、权限、存储或 UI 容量。</div>
      <div class="validation-note"><strong>治理边界：</strong>${C.escapeHtml(runtime.resource.ontologyContext.warning)}。组合 rc.10 尚未冻结，M07 未进入总控模块注册和 C034 Owner 清单。</div>`;
    elements.validationDialog.showModal();
    refreshIcons();
  }

  function bindStaticEvents() {
    elements.search.addEventListener("input", (event) => setState({ search: event.target.value }, { url: "replace" }));
    elements.clearSearch.addEventListener("click", () => setState({ search: "" }));
    elements.typeFilter.addEventListener("change", (event) => setState({ typeFilter: event.target.value }));
    elements.qualityFilter.addEventListener("change", (event) => setState({ qualityFilter: event.target.value }));
    elements.roleSelect.addEventListener("change", (event) => {
      const roleId = event.target.value;
      const object = currentObject();
      const allowed = C.isAllowed(object, roleId);
      const replacement = allowed ? object : C.allowedObjects(runtime.resource, roleId)[0];
      runtime.state = { ...runtime.state, roleId, currentObjectId: replacement?.id || null, typeFilter: "all", seriesIds: [] };
      C.commitUrl(runtime.state, "push");
      renderAll();
      toast(allowed ? "角色视图已重授权，未创建数据副本" : "原对象不可见，已清理对象上下文并重新授权", allowed ? "success" : "warning");
    });
    elements.copyLink.addEventListener("click", copyStableLink);
    elements.historyBack.addEventListener("click", () => history.back());
    elements.openValidation.addEventListener("click", openValidationDialog);
    window.addEventListener("popstate", () => {
      runtime.state = C.stateFromUrl(runtime.resource);
      renderAll();
    });
    window.addEventListener("resize", () => {
      clearTimeout(runtime.resizeTimer);
      runtime.resizeTimer = setTimeout(() => {
        if (["graph", "temporal", "spatial"].includes(runtime.state.lens)) renderWorkspace();
      }, 180);
    });
  }

  function renderFatal(error) {
    V.cleanup();
    elements.app.innerHTML = `
      <main class="blocked-state" style="min-height:100vh;background:var(--bg)">
        <div><span class="state-icon-large"><i data-lucide="circle-x"></i></span><h3>验证资源加载失败</h3><p>${C.escapeHtml(error.message || String(error))}</p><button class="button secondary" onclick="location.reload()"><i data-lucide="refresh-cw"></i>重新加载</button></div>
      </main>`;
    refreshIcons();
  }

  async function start() {
    try {
      const [resourceResponse, performance] = await Promise.all([
        fetch("resources/s005-validation.json", { cache: "no-store" }),
        loadPerformanceEvidence(),
      ]);
      if (!resourceResponse.ok) throw new Error(`HTTP ${resourceResponse.status}: s005-validation.json`);
      const resource = await resourceResponse.json();
      validateResource(resource);
      runtime.resource = resource;
      runtime.performance = performance;
      runtime.state = C.stateFromUrl(resource);
      bindStaticEvents();
      C.commitUrl(runtime.state, "replace");
      renderAll();
    } catch (error) {
      renderFatal(error);
    }
  }

  start();
}());
