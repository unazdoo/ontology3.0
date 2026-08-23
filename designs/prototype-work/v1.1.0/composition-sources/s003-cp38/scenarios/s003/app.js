(function () {
  "use strict";

  const DATA = window.S003Data;
  const STORE = window.S003Store;
  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modal-root");
  const toastRegion = document.getElementById("toast-region");
  let renderedFrameModuleId = null;
  let frameSaveTimer = null;
  const framePositions = Object.create(null);
  const moduleFrameCache = new Map();
  let moduleFrameCacheRunId = null;
  let moduleWarmupStarted = false;

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function attr(value) { return esc(value); }

  function icon(name, className) { return DATA.icon(name, className); }

  function state() { return STORE.getState(); }

  function bundle() { return STORE.getBundle(); }

  function displayRun() { return state().historicalView ? state().historicalView.projection?.run || null : state().activeRun; }

  function displayModel() { return state().historicalView ? state().historicalView.projection?.model || null : state().publishedModel; }

  function displayInputSnapshot() { return state().historicalView ? state().historicalView.projection?.inputSnapshot || null : state().factorInputSnapshot; }

  function records() { return displayRun()?.enterpriseResults || []; }

  function displayDecisions() {
    return state().historicalView ? state().historicalView.projection?.decisions || [] : state().decisions;
  }

  function displayActionRequests() {
    const st = state();
    if (st.historicalView) return st.historicalView.projection?.actionRequests || [];
    return Array.isArray(st.actionRequests) ? st.actionRequests : [];
  }

  function actionRequestRecord(value) {
    return value?.actionRequest || value || null;
  }

  function actionRequestForCandidate(candidate) {
    const context = candidate?.scenarioIdentity || displayContext();
    return displayActionRequests().find(function (item) {
      const request = actionRequestRecord(item);
      const requestContext = request?.scenarioIdentity || request?.scenarioContext;
      return request
        && requestContext?.scenarioRunId === context?.scenarioRunId
        && (request.candidateId === candidate?.candidateId
          || request.sourceCandidateId === candidate?.candidateId
          || (request.enterpriseId === candidate?.enterpriseId && request.actionTypeId === candidate?.actionTypeId));
    }) || null;
  }

  function confirmedDecisionForCandidate(candidate) {
    const context = candidate?.scenarioIdentity || displayContext();
    return displayDecisions().find(function (item) {
      return item?.scenarioRunId === context?.scenarioRunId
        && item.enterpriseId === candidate?.enterpriseId
        && item.actionTypeId === candidate?.actionTypeId;
    }) || null;
  }

  function displayDataProjection() {
    return state().historicalView?.projection?.data || null;
  }

  function displayConfigDraft() {
    const st = state();
    if (!st.historicalView) return st.configDraft;
    const model = displayModel() || {};
    return {
      weights: model.weights || {},
      factors: model.factors || [],
      riskTiers: model.riskTiers || [],
      indicatorOrder: model.indicatorOrder || [],
      lifecycleStatus: model.lifecycleStatus || "published",
      proposedVersion: model.packageVersion || "—"
    };
  }

  function displayQualityResult() {
    return displayDataProjection()?.qualityResult || (state().historicalView ? null : bundle()?.qualityResult) || {};
  }

  function displaySourceAsset() {
    return displayDataProjection()?.sourceAsset || (state().historicalView ? null : bundle()?.sourceAsset) || {};
  }

  function displayPipelineRun() {
    return displayDataProjection()?.pipelineRun || (state().historicalView ? null : bundle()?.pipelineRun) || {};
  }

  function displayFormalDataAsset() {
    return displayDataProjection()?.formalDataAsset || (state().historicalView ? null : bundle()?.formalDataAsset) || {};
  }

  function displayDataContract() {
    return displayDataProjection()?.dataContract || bundle()?.dataContract || {};
  }

  function isPublishedEvidenceRun(run) {
    return Boolean(run && run.authorityMode === "published-evidence" && run.projectionOnly !== true);
  }

  function runAuthority(run) {
    const st = state();
    const current = run || displayRun();
    const historical = Boolean(st.historicalView);
    const regression = Boolean(
      current?.authorityMode === "isolated-regression"
      || current?.scenarioContext?.status === "regression"
      || (!historical && st.context?.status === "regression")
    );
    const formalEvidence = isPublishedEvidenceRun(current);
    const workProjection = Boolean(
      current
      && !regression
      && (current.authorityMode === "published-runtime" || current.projectionOnly === true)
    );
    if (historical) {
      return {
        mode: "historical",
        label: "历史证据只读",
        tone: "info",
        description: "保留原 scenarioRunId，只读查看 Checkpoint 锁定状态；不得编辑、重评或重放副作用。",
        historical,
        regression,
        workProjection,
        formalEvidence,
        canQuery: formalEvidence,
        canDecision: false,
        canFormalReport: formalEvidence
      };
    }
    if (regression) {
      return {
        mode: "regression",
        label: "隔离演练",
        tone: "warning",
        description: "隔离回归结果仅用于演练核对，不进入 M03、M04，不生成正式报告深链、制品或外部副作用。",
        historical,
        regression,
        workProjection: false,
        formalEvidence: false,
        canQuery: false,
        canDecision: false,
        canFormalReport: false
      };
    }
    if (workProjection) {
      return {
        mode: "work-projection",
        label: "工作投影 / 待 Owner 导出",
        tone: "warning",
        description: "快速重跑结果只供 M06 工作台和报告预览；待 Owner 导出正式 C035 / Published 事实后，M03、M04 与正式报告能力才可消费。",
        historical,
        regression,
        workProjection,
        formalEvidence: false,
        canQuery: false,
        canDecision: false,
        canFormalReport: false
      };
    }
    if (formalEvidence) {
      return {
        mode: "published-evidence",
        label: "正式 Published 证据",
        tone: "success",
        description: "当前运行已绑定不可变 C035 与 Published 事实，可供 M03、M04 和 M06 按合同消费。",
        historical,
        regression,
        workProjection: false,
        formalEvidence,
        canQuery: true,
        canDecision: true,
        canFormalReport: true
      };
    }
    return {
      mode: "pending",
      label: "正式结果待形成",
      tone: "neutral",
      description: "当前尚无可供下游消费的正式 Published 运行证据。",
      historical,
      regression,
      workProjection: false,
      formalEvidence: false,
      canQuery: false,
      canDecision: false,
      canFormalReport: false
    };
  }

  function fixtureEnterprises() { return bundle()?.fixture?.enterprises || []; }

  function selectedEnterprise() {
    const id = state().selectedEnterpriseId || fixtureEnterprises()[0]?.enterpriseId;
    return fixtureEnterprises().find(function (item) { return item.enterpriseId === id; }) || fixtureEnterprises()[0] || null;
  }

  function selectedRecord() {
    const id = state().selectedEnterpriseId;
    return records().find(function (item) { return item.enterpriseId === id; }) || null;
  }

  function riskBadge(value, compact) {
    const key = DATA.riskKey(value);
    const meta = DATA.RISK_META[key] || DATA.RISK_META.UNKNOWN;
    return `<span class="risk-badge ${meta.className} ${compact ? "compact" : ""}"><i></i>${esc(meta.name)}</span>`;
  }

  function statusChip(label, tone) {
    return `<span class="status-chip ${tone || "neutral"}"><i></i>${esc(label)}</span>`;
  }

  function button(label, action, options) {
    const config = options || {};
    const classes = ["btn", config.primary ? "btn-primary" : "", config.ghost ? "btn-ghost" : "", config.danger ? "btn-danger" : "", config.small ? "btn-small" : "", config.disabled ? "is-disabled" : ""].filter(Boolean).join(" ");
    return `<button class="${classes}" type="button" data-action="${attr(action)}" ${config.disabled ? "disabled" : ""}>${config.icon ? icon(config.icon, "sm") : ""}<span>${esc(label)}</span></button>`;
  }

  function displayContext() {
    const st = state();
    return st.historicalView?.context
      || st.historicalView?.checkpoint?.scenarioContext
      || displayRun()?.scenarioContext
      || st.context
      || {};
  }

  function runLabel() {
    const context = displayContext();
    const runId = context.scenarioRunId || displayRun()?.runId;
    return runId ? DATA.shortId(runId) : "待形成运行";
  }

  function activeModule() {
    const frameModule = DATA.MODULES.find(function (item) { return item.frameView === state().currentView; });
    return frameModule
      || DATA.MODULES.find(function (item) { return item.id === state().activeModuleId; })
      || DATA.MODULES.find(function (item) { return item.id === "M06"; });
  }

  function moduleFrameView(moduleId) {
    return DATA.MODULES.find(function (item) { return item.id === moduleId; })?.frameView || `module-${moduleId}`;
  }

  function isModuleFrameView(view) {
    return /^module-M0[1-6]$/.test(String(view || ""));
  }

  function moduleContext() {
    const context = displayContext() || {};
    const baseline = bundle()?.manifest?.baseline || {};
    const formedAt = context.formedAt || bundle()?.manifest?.formedAt || null;
    const status = context.status || "active";
    return {
      scenarioId: context.scenarioId || "S003",
      scenarioVersion: context.scenarioVersion || "S003-v1",
      scenarioRunId: context.scenarioRunId || null,
      // v1.0.3 公共壳的场景字段合同：基线模块页面按这些键识别当前场景轮次。
      formedAt,
      status,
      contextCreatedAt: formedAt,
      contextStatus: status,
      scenarioFormedAt: formedAt,
      scenarioStatus: status,
      baselineVersion: baseline.baselineVersion || "1.0.3",
      baselineSnapshotId: baseline.baselineSnapshotId || "BSL-S001-V103-DE0119608E26",
      prototypeVersion: "1.1.0",
      publishedModelVersion: displayModel()?.packageVersion || null,
      publishedInputSnapshotId: displayInputSnapshot()?.snapshotId || null,
      assessmentAt: displayRun()?.assessmentAt || bundle()?.fixture?.assessmentAt || "2025-12-31"
    };
  }

  function moduleSource(module) {
    const saved = framePositions[module.id];
    const entry = module.entryHash || "";
    const source = saved?.href || `${module.source}${entry}`;
    try {
      const url = new URL(source, window.location.href);
      const context = moduleContext();
      Object.entries(context).forEach(function ([key, value]) {
        if (value != null && value !== "") url.searchParams.set(key, value);
      });
      return `${url.pathname}${url.search}${url.hash}`;
    } catch (_) {
      return source;
    }
  }

  function ensureModuleFrameCacheContext() {
    const runId = moduleContext().scenarioRunId || "pending";
    if (moduleFrameCacheRunId && moduleFrameCacheRunId !== runId) {
      moduleFrameCache.clear();
      Object.keys(framePositions).forEach(function (key) { delete framePositions[key]; });
    }
    moduleFrameCacheRunId = runId;
  }

  function cacheCurrentModuleFrame() {
    const frame = document.getElementById("module-frame");
    if (!frame || !renderedFrameModuleId) return;
    const stage = frame.closest(".module-frame-stage");
    moduleFrameCache.set(renderedFrameModuleId, {
      frame,
      loaded: Boolean(stage?.classList.contains("is-loaded")),
      fallback: Boolean(stage?.classList.contains("is-fallback"))
    });
  }

  function warmModuleSources() {
    if (moduleWarmupStarted || !state().ready) return;
    moduleWarmupStarted = true;
    window.setTimeout(function () {
      DATA.MODULES.forEach(function (module) {
        // 只预取基线入口 HTML，实际页面仍由 iframe 原生加载；不改变模块路由和生命周期。
        fetch(moduleSource(module), { cache: "force-cache", credentials: "same-origin" }).catch(function () {});
      });
    }, 80);
  }

  // v1.0.3 壳为主体：不再向基线模块页面注入任何改写其外壳或布局的适配
  // CSS。模块保留自身完整导航、工作区与生命周期，S003 只投递场景身份。

  // 与 v1.0.3 公共壳的投递语义保持一致：使用基线模块真实监听的
  // `ontology3.0-s001-handoff-v1` 频道；本体管理接收 C033 场景上下文信封
  // （信封合同：sourceModule=平台公共层、deliveredAt、evidenceLocator、
  // 完整 scenarioContext 五要素），数据工程接收场景上下文本体。
  // 其余模块仅通过 URL 参数获得场景身份。
  function deliverScenarioContextToFrame(frame, module) {
    if (!frame?.contentWindow) return;
    if (module.id !== "M01" && module.id !== "M02") return;
    const context = moduleContext();
    const payload = module.id === "M01"
      ? {
        sourceModule: "平台公共层",
        contractCode: "C033",
        contextId: `C033-${context.scenarioId}-${context.scenarioRunId || "pending"}`,
        deliveredAt: context.formedAt || new Date().toISOString(),
        evidenceLocator: `统一平台 / 场景工作区 / ${context.scenarioId} / ${context.scenarioRunId || "pending"}`,
        scenarioContext: {
          scenarioId: context.scenarioId,
          scenarioVersion: context.scenarioVersion,
          scenarioRunId: context.scenarioRunId,
          formedAt: context.formedAt,
          status: context.status
        }
      }
      : {
        scenarioId: context.scenarioId,
        scenarioVersion: context.scenarioVersion,
        scenarioRunId: context.scenarioRunId,
        formedAt: context.formedAt,
        status: context.status
      };
    frame.contentWindow.postMessage({
      channel: DATA.HANDOFF_CHANNEL,
      targetModule: module.id === "M01" ? "本体管理" : "数据工程",
      sourceModule: "统一平台",
      operation: "deliverScenarioContext",
      requestId: `C033-${context.scenarioRunId || "pending"}-${module.id}`,
      payload
    }, window.location.origin);
  }

  function captureFramePosition() {
    if (!renderedFrameModuleId) return;
    const frame = document.getElementById("module-frame");
    if (!frame) return;
    try {
      const href = frame.contentWindow.location.href;
      const doc = frame.contentDocument;
      const scroller = doc?.querySelector(".main,.screen-stage,.page-shell,.workspace-main,[data-scroll-container]");
      framePositions[renderedFrameModuleId] = {
        href,
        windowY: frame.contentWindow.scrollY || 0,
        containerY: scroller?.scrollTop || 0,
        savedAt: Date.now()
      };
    } catch (_) {}
  }

  function adaptModuleFrame(frame, module) {
    if (!frame?.contentDocument) return;
    try {
      const doc = frame.contentDocument;
      deliverScenarioContextToFrame(frame, module);
      const saved = framePositions[module.id];
      if (saved) {
        frame.contentWindow.scrollTo(0, saved.windowY || 0);
        const scroller = doc.querySelector(".main,.screen-stage,.page-shell,.workspace-main,[data-scroll-container]");
        if (scroller) scroller.scrollTop = saved.containerY || 0;
      }
      doc.addEventListener("click", function () {
        window.clearTimeout(frameSaveTimer);
        frameSaveTimer = window.setTimeout(captureFramePosition, 180);
      }, true);
      doc.addEventListener("scroll", function () {
        window.clearTimeout(frameSaveTimer);
        frameSaveTimer = window.setTimeout(captureFramePosition, 180);
      }, true);
      frame.dataset.frameState = "loaded";
      frame.closest(".module-frame-stage")?.classList.remove("is-fallback");
      frame.closest(".module-frame-stage")?.classList.add("is-loaded");
    } catch (_) {}
  }

  // 与 v1.0.3 公共壳 renderModule 保持同构：模块路由就是纯净的模块页面
  // 舞台（module-view > frame-stage > iframe），不叠加 S003 信息层、不改写
  // 模块内部结构。S003 的场景适配合同在仪表盘对应视图中呈现。
  function renderModuleFrame(moduleId) {
    const module = DATA.MODULES.find(function (item) { return item.id === moduleId; });
    if (!module) return `<div class="empty-state">模块入口不存在。</div>`;
    return `<div class="module-view"><section class="module-frame-stage frame-stage" data-frame-state="loading"><iframe id="module-frame" class="module-frame" data-module-id="${attr(module.id)}" data-baseline-path="${attr(module.baselinePath || module.source)}" title="${attr(module.name)}" src="${attr(moduleSource(module))}" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"></iframe><div class="module-frame-fallback" role="status"><strong>基线模块页面暂未装载</strong><span>保留路径与场景合同已登记；请确认 v1.1.0 服务根目录下存在该模块原型后重试。</span><code>${esc(module.baselinePath || module.source)}</code></div></section></div>`;
  }

  // 基线页面只提供通用模块能力；S003 的资源身份、Owner 和边界必须在
  // 场景适配层显式呈现，避免把 v1.0.3 中的 S001 业务事实误当作 S003 真源。
  function renderBaselineCompatibility(moduleId) {
    const module = DATA.MODULES.find(function (item) { return item.id === moduleId; });
    const compatibility = module?.baselineCompatibility;
    if (!module || !compatibility) return "";
    const context = moduleContext();
    const baseline = bundle()?.manifest?.baseline || {};
    const facts = moduleId === "M02"
      ? [
        ["工作簿逻辑成员", (displaySourceAsset()?.logicalMembers || []).map(function (item) { return item.name; }).join("、") || "财务数据"],
        ["数据合同", `${displayDataContract()?.contractId || "C031-S003"} · ${displayDataContract()?.contractVersion || "1.1.0"}`],
        ["字段口径", `当前期 ${displayDataContract()?.currentPeriodColumn || "I"} / 上期 ${displayDataContract()?.priorPeriodColumn || "AA"}`],
        ["输入快照", displayInputSnapshot()?.snapshotId || "尚未形成"],
        ["质量边界", "只校验数据与人工输入，不计算评分、权重、系数或阈值"]
      ]
      : [
        ["模型包", `${displayModel()?.packageId || "S003-M01-DEBT-RISK-PKG"} · ${displayModel()?.packageVersion || "未形成"}`],
        ["Published 指针", bundle()?.publishedPointer?.pointerId || "未形成"],
        ["资源类型", "RiskModel · Metric · Rule · Action Type"],
        ["业务 / 生命周期 Owner", "财务公司定义 · M01 维护 Published"],
        ["下游边界", "仅 Published 风险事实可供 M03/M04/M06 消费"]
      ];
    return `<section class="baseline-compatibility" aria-label="${attr(module.name)} v1.0.3 基线与 S003 适配合同"><div class="baseline-compatibility-head"><div><span class="eyebrow">S003 场景适配合同</span><h2>v1.0.3 通用模块保持不变</h2><p>冻结基线只读；下方为 S003 独立身份与资源映射，不替换基线页面内部能力，也不把 S001 事实带入本场景。</p></div><span class="status-chip info"><i></i>${esc(compatibility.version || baseline.baselineVersion || "v1.0.3")} 只读</span></div><div class="baseline-compatibility-grid"><div><span>场景身份</span><strong>${esc(context.scenarioId)} / ${esc(context.scenarioVersion)}</strong><code>${esc(context.scenarioRunId || "待形成")}</code></div><div><span>父基线</span><strong>${esc(baseline.baselineVersion || "v1.0.3")}</strong><code>${esc(baseline.baselineSnapshotId || "BSL-S001-V103-DE0119608E26")}</code></div>${facts.map(function (item) { return `<div><span>${esc(item[0])}</span><strong>${esc(item[1])}</strong></div>`; }).join("")}</div><div class="baseline-compatibility-nav"><span>基线内部导航</span>${(compatibility.nav || []).map(function (item) { return `<code>${esc(item.label)} · ${esc(item.hash)}</code>`; }).join("")}</div></section>`;
  }

  function platformWorkflowStatus() {
    const st = state();
    const b = bundle() || {};
    const run = displayRun();
    const hasPublishedInput = Boolean(displayInputSnapshot()?.snapshotId);
    const hasPublishedModel = Boolean(displayModel()?.packageVersion);
    const hasFormalRun = Boolean(run && isPublishedEvidenceRun(run));
    const hasQuery = Boolean(st.queryAnswer);
    const hasDecision = displayDecisions().length > 0;
    const checkpointCount = (b.checkpoints || []).filter(function (entry) { return entry.manifest; }).length;
    const facts = {
      source: Boolean(displaySourceAsset()?.sourceId),
      quality: displayQualityResult()?.status === "passed",
      input: hasPublishedInput,
      model: hasPublishedModel,
      evaluate: hasFormalRun,
      query: hasFormalRun && hasQuery,
      decision: hasFormalRun && hasDecision,
      report: hasFormalRun && records().length > 0,
      checkpoint: checkpointCount > 0
    };
    const items = DATA.PLATFORM_WORKFLOW.map(function (item) {
      return { ...item, state: facts[item.id] ? "complete" : "pending" };
    });
    const done = items.filter(function (item) { return item.state === "complete"; }).length;
    return { items, done, total: items.length, next: items.find(function (item) { return item.state !== "complete"; }) || null };
  }

  function platformNavState(item) {
    const st = state();
    const map = {
      home: "platform-home",
      M02: "module-M02",
      M01: "module-M01",
      M03: "module-M03",
      M04: "module-M04",
      M05: "module-M05",
      M06: "module-M06",
      dashboard: "overview"
    };
    if (item.id === "M03" && st.currentAnchor === "m03-query") return true;
    if (item.id === "M04" && st.currentAnchor?.startsWith("m04-")) return true;
    return (map[item.id] || "") === st.currentView && (item.id !== "M03" && item.id !== "M04" || Boolean(st.currentAnchor));
  }

  function moduleNav() {
    const st = state();
    const workflow = platformWorkflowStatus();
    const items = DATA.PLATFORM_NAV;
    return `<aside class="global-nav ${st.navCollapsed ? "is-collapsed" : ""} ${st.mobileNavOpen ? "is-mobile-open" : ""}">
      <div class="brand-lockup">
        <span class="brand-mark" aria-hidden="true"><span>OFW</span></span>
        <div class="brand-copy"><strong>${esc(DATA.BRAND.zh)}</strong><small>${esc(DATA.BRAND.en)}</small></div>
        <button class="nav-collapse" type="button" data-action="toggle-nav" aria-label="${st.navCollapsed ? "展开主菜单" : "收起主菜单"}">${icon(st.navCollapsed ? "chevronRight" : "chevronDown", "sm")}</button>
      </div>
      <div class="nav-context"><span>当前场景</span><strong>${esc(DATA.BRAND.scene)}</strong><small>独立运行空间 · v1.1.0</small></div>
      <nav class="primary-nav" aria-label="平台一级导航">
        ${items.map(function (item) {
          const isActive = platformNavState(item);
          const status = item.id === "home" || item.id === "dashboard" ? "" : workflow.items.find(function (step) { return step.module === item.id && step.state === "complete"; }) ? "done" : workflow.items.some(function (step) { return step.module === item.id && step.state === "pending"; }) ? "observed" : "";
          return `<button class="nav-item ${isActive ? "active" : ""} ${item.id === "home" ? "home-item" : ""}" type="button" data-platform-action="${attr(item.action)}"${item.baselineModuleId ? ` data-baseline-module-id="${attr(item.baselineModuleId)}"` : ""} title="${attr(`${item.name} · ${item.note}`)}">
            ${icon(item.icon)}<span>${esc(item.name)}</span>${status ? `<i class="nav-state ${status}" aria-label="${status === "done" ? "已完成" : "待处理"}"></i>` : ""}
          </button>`;
        }).join("")}
      </nav>
      <div class="nav-foot">
        <div class="nav-foot-line"><span class="connection-dot"></span><strong>${workflow.done}/${workflow.total} 项场景来源已确认</strong></div>
        <p>${workflow.next ? `下一步：${workflow.next.title}` : "当前场景链路已完成"}</p>
        <small>${esc(runLabel())}</small>
      </div>
    </aside>`;
  }

  function topbar() {
    const st = state();
    const context = displayContext();
    const module = activeModule();
    const workflow = platformWorkflowStatus();
    const historical = st.historicalView;
    const model = displayModel();
    const authority = runAuthority();
    const regression = st.context?.status === "regression" || Boolean(st.regressionRun);
    const restored = st.context?.status === "restored" && !displayRun();
    const dashboardViews = new Set(["overview", "enterprises", "factor-entry", "configuration", "runs", "query-decision", "checkpoints", "agent-boundary", "report", "data-quality"]);
    const isModuleView = isModuleFrameView(st.currentView);
    const currentName = st.currentView === "platform-home"
      ? "首页"
      : isModuleView
        ? (module?.name || "模块")
        : dashboardViews.has(st.currentView) ? "仪表盘" : (module?.name || "仪表盘");
    const currentIcon = isModuleView ? (module?.icon || "network") : st.currentView === "platform-home" ? "home" : "chart";
    const runStatus = historical ? statusChip("历史证据只读", "info") : regression ? statusChip("隔离演练", "warning") : authority.workProjection ? statusChip("工作投影 · 待导出", "warning") : restored ? statusChip("恢复副本待评估", "warning") : st.runStatus === "succeeded" ? statusChip("正式 Published 证据", "success") : st.runStatus === "running" ? statusChip("重评中", "info") : st.runStatus === "failed" ? statusChip("运行失败", "danger") : statusChip("待运行", "neutral");
    const configStatus = historical ? statusChip(`模型 ${model?.packageVersion || "未形成"}`, model ? "success" : "neutral") : st.configStatus === "published" ? statusChip(`模型 ${st.publishedModel?.packageVersion || "—"} 已发布`, "success") : st.configStatus === "validated" ? statusChip("配置已校验", "warning") : statusChip("配置 Draft", "warning");
    const canQuickRerun = !historical && !regression && st.runStatus !== "running" && st.configStatus === "published" && st.factorEntryStatus === "published";
    return `<header class="global-topbar">
      <div class="top-title">
        ${st.currentView === "platform-home" ? "" : `<button class="top-icon-button" type="button" data-action="go-back" title="返回上一位置" aria-label="返回上一位置">${icon("back", "sm")}</button>`}${icon(currentIcon)}
        <div class="top-title-copy"><span>统一工作台</span><strong>${esc(currentName)}</strong></div>
      </div>
      <div class="scenario-workspace" title="${attr(context.scenarioRunId || "")}">
        <span>当前场景 · S003 债务风险监测</span>
        <strong>${esc(runLabel())} · ${esc(context.scenarioVersion || "S003-v1")}</strong>
      </div>
      <div class="top-actions">
        <button class="flow-trigger" type="button" data-action="view-platform-home" aria-label="打开 S003 链路进度">${icon("layers", "sm")}<span><b>链路进度 · ${workflow.done}/${workflow.total}</b><small>${workflow.next ? `下一步：${esc(workflow.next.title)}` : "当前场景链路已完成"}</small></span><i><i style="width:${workflow.total ? Math.round((workflow.done / workflow.total) * 100) : 0}%"></i></i></button>
        <button class="top-action" type="button" data-action="refresh-source" title="重新读取当前场景和模块状态">${icon("refresh", "sm")}<span>重新读取</span></button>
        <button class="top-action" type="button" data-action="reset-current-scenario" title="重置当前 S003 场景">${icon("refresh", "sm")}<span>重置场景</span></button>
        ${(regression || restored) && st.lastSuccessfulRun ? `<button class="top-action" type="button" data-action="return-successful-run">${icon("back", "sm")}<span>返回正式运行</span></button>` : ""}
        <button class="top-action" type="button" data-action="quick-rerun" ${canQuickRerun ? "" : "disabled"}>${icon("play", "sm")}<span>快速重跑</span></button>
        <button class="top-action" type="button" data-action="print-report" ${authority.canFormalReport ? "" : `disabled title="${attr(authority.workProjection ? "工作投影仅可预览；待 Owner 导出后才能正式打印或导出" : "当前运行不具备正式报告导出权限")}"`}>${icon("print", "sm")}<span>打印报告</span></button>
        ${configStatus}${runStatus}
        <div class="user-account" title="平台账号：平台管理员 · 业务 Owner：财务公司"><span class="user-avatar">管</span><strong>平台管理员</strong></div>
      </div>
    </header>`;
  }

  function scenarioTabs() {
    const st = state();
    return `<div class="scene-tabs" role="tablist" aria-label="S003 场景工作台视图">
      ${DATA.VIEWS.filter(function (view) { return view.inTabs !== false; }).map(function (view) {
        return `<button type="button" role="tab" aria-selected="${st.currentView === view.id}" class="scene-tab ${st.currentView === view.id ? "active" : ""}" data-view="${view.id}">${icon(view.icon, "sm")}<span>${esc(view.label)}</span></button>`;
      }).join("")}
    </div>`;
  }

  function identityRail() {
    const st = state();
    const b = bundle();
    const context = displayContext();
    const baseline = b?.manifest?.baseline || {};
    const dataAsset = displayFormalDataAsset();
    const input = displayInputSnapshot() || {};
    const pointer = b?.publishedPointer || {};
    const run = displayRun();
    const model = displayModel();
    const authority = runAuthority(run);
    const assessmentAt = run?.assessmentAt || b?.fixture?.assessmentAt || b?.dataContract?.assessmentAt;
    return `<section class="identity-rail" aria-label="S003 持续场景身份">
      <div><span>scenarioId</span><strong>${esc(context.scenarioId || "S003")}</strong></div>
      <div><span>scenarioVersion</span><strong>${esc(context.scenarioVersion || "S003-v1")}</strong></div>
      <div class="identity-run"><span>scenarioRunId</span><strong title="${attr(context.scenarioRunId || "")}">${esc(context.scenarioRunId || "待形成")}</strong></div>
      <div><span>baselineVersion</span><strong>${esc(baseline.baselineVersion || "1.0.3")}</strong></div>
      <div class="identity-baseline"><span>baselineSnapshotId</span><strong title="${attr(baseline.baselineSnapshotId || "")}">${esc(DATA.shortId(baseline.baselineSnapshotId || "—", 18, 6))}</strong></div>
      <div><span>Published 模型</span><strong title="${attr(pointer.pointerId || "")}">${esc(model?.packageVersion || "未形成")}</strong></div>
      <div class="identity-input"><span>Published 输入</span><strong title="${attr(input.snapshotId || "")}">${esc(DATA.shortId(input.snapshotId || "—", 17, 6))}</strong></div>
      <div class="identity-asset"><span>数据资产</span><strong title="${attr(dataAsset.dataAssetId || "")}">${esc(DATA.shortId(dataAsset.dataAssetId || "—", 20, 6))}</strong></div>
      <div><span>assessmentAt</span><strong>${esc(assessmentAt || "—")}</strong></div>
      <div class="identity-authority"><span>结果权威性</span><strong>${esc(authority.label)}</strong></div>
    </section>`;
  }

  function authorityBanner() {
    const authority = runAuthority();
    const iconName = authority.formalEvidence ? "check" : authority.historical ? "lock" : authority.regression || authority.workProjection ? "alert" : "info";
    return `<section class="authority-banner ${attr(authority.mode)}" aria-label="当前运行权威性"><span class="authority-banner-icon">${icon(iconName, "sm")}</span><div><strong>${esc(authority.label)}</strong><p>${esc(authority.description)}</p></div><code>${esc(displayRun()?.authorityMode || "pending")}</code></section>`;
  }

  function pageHeader(title, eyebrow, description, actions) {
    return `<div class="page-header">
      <div><span class="eyebrow">${esc(eyebrow || "S003 场景工作台")}</span><h1>${esc(title)}</h1>${description ? `<p>${esc(description)}</p>` : ""}</div>
      <div class="page-actions">${actions || ""}</div>
    </div>`;
  }

  function infoStrip() {
    const st = state();
    const b = bundle();
    const quality = displayQualityResult();
    return `<div class="info-strip">
      <div class="info-strip-main">${icon("shield", "sm")}<span><strong>场景边界：</strong>评分、因子系数、权重和风险阈值均由 M01 Published 结果提供；M02 只负责数据与人工输入质量。</span></div>
      <div class="info-strip-meta"><span>${esc(b?.fixture?.currency || "CNY")}</span><b>·</b><span>${esc(b?.fixture?.amountUnit || "元")}</span><b>·</b><span>质量 ${quality?.status === "passed" ? "通过" : "待核"}</span></div>
    </div>`;
  }

  function renderShell(content) {
    const st = state();
    const platformHome = st.currentView === "platform-home";
    const inheritedModule = isModuleFrameView(st.currentView);
    // 模块路由与 v1.0.3 壳同构：module-view 直接占满 route-stage，不套
    // 场景容器；S003 的身份条、权限横幅与场景页签只出现在仪表盘扩展中。
    const inner = inheritedModule
      ? content
      : `<div class="scene-frame">${platformHome ? "" : scenarioTabs()}${platformHome ? "" : identityRail()}${platformHome ? "" : authorityBanner()}${platformHome ? "" : infoStrip()}${content}</div>`;
    return `<div class="platform-shell ${st.navCollapsed ? "nav-collapsed" : ""}">${moduleNav()}<section class="shell-main">${topbar()}<main class="route-stage${inheritedModule ? " is-module-stage" : ""}">${inner}</main></section></div>`;
  }

  function renderBoot() {
    const st = state();
    if (st.fatalError) {
      return `<div class="fatal-screen"><div class="fatal-card">${icon("alert", "lg")}<h1>S003 场景资料未能完整装载</h1><p>${esc(st.fatalError)}</p><small>请确认工作台从 v1.1.0 场景目录通过 HTTP 服务打开。</small></div></div>`;
    }
    return `<div class="boot-screen"><span class="boot-mark">OFW</span><div><strong>正在装载 S003 场景工作台</strong><small>读取场景身份、数据夹具与 Published 模型包…</small></div></div>`;
  }

  function kpiCard(label, value, note, tone, iconName) {
    return `<article class="kpi-card ${tone || ""}"><div class="kpi-top"><span class="kpi-icon">${icon(iconName || "chart", "sm")}</span><span class="kpi-label">${esc(label)}</span></div><strong class="kpi-value">${esc(value)}</strong><small>${esc(note)}</small></article>`;
  }

  function riskCounts() {
    const counts = { GREEN: 0, YELLOW: 0, RED: 0, BLACK: 0 };
    records().forEach(function (record) { if (counts[record.riskTier] !== undefined) counts[record.riskTier] += 1; });
    return counts;
  }

  function renderRiskDistribution(counts, total) {
    return `<div class="risk-distribution">
      ${["GREEN", "YELLOW", "RED", "BLACK"].map(function (key) {
        const meta = DATA.RISK_META[key];
        const count = counts[key] || 0;
        const width = total ? Math.max(2, (count / total) * 100) : 0;
        return `<div class="risk-row"><div class="risk-row-label">${riskBadge(key, true)}<strong>${count}</strong><span>家</span></div><div class="risk-track"><i class="${meta.className}" style="width:${width}%"></i></div><small>${esc(meta.description)}</small></div>`;
      }).join("")}
    </div>`;
  }

  function publishedRiskRangeLabel(tier) {
    if (!tier) return "—";
    if (tier.maxExclusive == null) return `≥ ${DATA.formatScore(tier.minInclusive)}`;
    return `${DATA.formatScore(tier.minInclusive)} ≤ 分值 < ${DATA.formatScore(tier.maxExclusive)}`;
  }

  function renderPublishedThresholds() {
    const tiers = displayModel()?.riskTiers || [];
    return `<div class="published-thresholds" aria-label="当前 Published 风险分档">
      ${tiers.map(function (tier) { return `<div class="threshold-item ${DATA.RISK_META[tier.tierId]?.className || "risk-unknown"}">${riskBadge(tier.tierId, true)}<strong>${esc(publishedRiskRangeLabel(tier))}</strong></div>`; }).join("")}
    </div>`;
  }

  function renderOverviewEnterpriseTable() {
    const list = topRiskRows(21);
    if (!list.length) return `<div class="empty-state compact">${icon("info", "sm")}<span>当前没有可展示的企业评分结果。</span></div>`;
    return `<div class="data-table-wrap"><table class="data-table overview-enterprise-table"><thead><tr><th>企业</th><th>产业 / 类别</th><th class="num">原始分</th><th class="num">调节合计</th><th class="num">综合分</th><th>风险等级</th><th>报告</th></tr></thead><tbody>${list.map(function (record) { return `<tr><td><button class="company-link" type="button" data-action="open-report" data-enterprise-id="${attr(record.enterpriseId)}"><strong>${esc(record.enterpriseName)}</strong><small>${esc(record.enterpriseId)}</small></button></td><td><strong class="cell-primary">${esc(record.sector || "—")}</strong><small class="cell-secondary">${esc(record.category || "—")}</small></td><td class="num mono">${record.rawScore == null ? "—" : DATA.formatScore(record.rawScore)}</td><td class="num mono ${Number(record.factorSum) < 0 ? "negative" : ""}">${record.factorSum == null ? "—" : `${Number(record.factorSum) > 0 ? "+" : ""}${Number(record.factorSum).toFixed(2)}`}</td><td class="num"><strong class="score-cell">${DATA.formatScore(record.finalScore)}</strong></td><td>${riskBadge(record.riskTier, true)}</td><td><button class="table-action" type="button" data-action="open-report" data-enterprise-id="${attr(record.enterpriseId)}">${icon("file", "sm")}查看</button></td></tr>`; }).join("")}</tbody></table></div>`;
  }

  function sectorSummary() {
    const map = {};
    records().forEach(function (record) {
      const key = record.sector || record.category || "未分类";
      map[key] ||= { total: 0, scores: [], counts: { GREEN: 0, YELLOW: 0, RED: 0, BLACK: 0 } };
      map[key].total += 1;
      if (Number.isFinite(Number(record.finalScore))) map[key].scores.push(Number(record.finalScore));
      if (map[key].counts[record.riskTier] !== undefined) map[key].counts[record.riskTier] += 1;
    });
    if (!Object.keys(map).length) {
      fixtureEnterprises().forEach(function (enterprise) { const key = enterprise.sector || enterprise.category || "未分类"; map[key] ||= { total: 0, scores: [], counts: { GREEN: 0, YELLOW: 0, RED: 0, BLACK: 0 } }; map[key].total += 1; });
    }
    return Object.entries(map).map(function ([name, item]) {
      const avg = item.scores.length ? item.scores.reduce((a, b) => a + b, 0) / item.scores.length : null;
      return `<button class="sector-card" type="button" data-action="view-sector-enterprises" data-sector="${attr(name)}"><div class="sector-head"><div><strong>${esc(name)}</strong><small>${item.total} 家企业</small></div><span>${avg == null ? "待评估" : `${DATA.formatScore(avg)} 分均值`}</span></div><div class="sector-bars">${["GREEN", "YELLOW", "RED", "BLACK"].map(function (key) { return `<i class="${DATA.RISK_META[key].className}" style="width:${item.total ? Math.max(2, item.counts[key] / item.total * 100) : 0}%" title="${DATA.RISK_META[key].name} ${item.counts[key]} 家"></i>`; }).join("")}</div><div class="sector-foot"><span>绿 ${item.counts.GREEN}</span><span>黄 ${item.counts.YELLOW}</span><span>红 ${item.counts.RED}</span><span>黑 ${item.counts.BLACK}</span></div><small class="sector-drill-hint">查看本产业企业 ${icon("chevronRight", "sm")}</small></button>`;
    }).join("");
  }

  function processRail() {
    const st = state();
    const run = displayRun();
    const model = displayModel();
    const historical = Boolean(st.historicalView);
    const authority = runAuthority(run);
    const steps = [
      ["数据接入", "M02", "database", true],
      ["模型发布", "M01", "network", Boolean(model && (historical ? model.lifecycleStatus !== "DRAFT" : st.configStatus === "published"))],
      ["权威评估", "C035", "shield", authority.formalEvidence],
      [authority.workProjection || authority.regression ? "报告预览" : "报告生成", "M06", "file", displayReportCount() > 0],
      ["人工确认", "M04", "target", displayDecisions().length > 0]
    ];
    return `<div class="process-rail">${steps.map(function (step, index) { return `<div class="process-step ${step[3] ? "done" : "pending"}"><span class="process-index">${step[3] ? icon("check", "sm") : String(index + 1).padStart(2, "0")}</span><div><strong>${esc(step[0])}</strong><small>${esc(step[1])}</small></div>${index < steps.length - 1 ? '<b class="process-line"></b>' : ""}</div>`; }).join("")}</div>`;
  }

  function topRiskRows(limit) {
    const list = records().slice().sort(function (a, b) {
      const rank = DATA.riskRank(a.riskTier) - DATA.riskRank(b.riskTier);
      return rank || (Number(a.finalScore ?? Infinity) - Number(b.finalScore ?? Infinity));
    });
    return list.slice(0, limit || 5);
  }

  function renderRiskRows(list, options) {
    const config = options || {};
    if (!list.length) return `<div class="empty-state compact">${icon("info", "sm")}<span>${esc(config.empty || "暂无可展示的评估结果")}</span></div>`;
    return `<div class="risk-list">${list.map(function (record) {
      const factorHits = record.factors?.filter(function (factor) { return ["重大诉讼", "当月资金余缺预警"].includes(factor.value); }) || [];
      return `<button class="risk-list-row" type="button" data-action="open-report" data-enterprise-id="${attr(record.enterpriseId)}"><span class="risk-list-rank">${riskBadge(record.riskTier, true)}</span><span class="risk-list-main"><strong>${esc(record.enterpriseName)}</strong><small>${esc(record.category)} · ${factorHits.length ? `重大因子 ${factorHits.length} 项` : "无重大因子命中"}</small></span><span class="risk-list-score">${record.finalScore == null ? "—" : DATA.formatScore(record.finalScore)}<small>综合分</small></span>${icon("chevronRight", "sm")}</button>`;
    }).join("")}</div>`;
  }

  function resourceRow(label, resourceId, version, status, owner, detail) {
    return `<div class="resource-row"><div><strong>${esc(label)}</strong><small>${esc(owner || "平台场景包")}</small></div><code title="${attr(resourceId || "")}">${esc(resourceId || "—")}</code><span>${esc(version || "—")}</span>${statusChip(status || "已形成", status === "不可消费" ? "warning" : "success")}<small class="resource-detail">${esc(detail || "")}</small></div>`;
  }

  function renderDataQuality() {
    const b = bundle();
    const contract = displayDataContract();
    const source = displaySourceAsset();
    const pipeline = displayPipelineRun();
    const formal = displayFormalDataAsset();
    const input = displayInputSnapshot() || (state().historicalView ? {} : b?.humanInputSnapshot) || {};
    const quality = displayQualityResult();
    const members = source.logicalMembers || [];
    const historical = Boolean(state().historicalView);
    return `${pageHeader("数据与人工输入质量", "M02 · 场景适配视图", "在 S003 场景壳内查看财务工作簿、独立企业因子输入、候选资产成员和质量结果；本视图不执行评分、不维护模型参数。", `${button("填写企业因子", "view-factor-entry", { primary: true, icon: "edit" })}${button("查看运行", "view-runs", { ghost: true, icon: "refresh" })}`)}
      ${renderBaselineCompatibility("M02")}
      <div class="module-owner-strip"><span class="module-owner-icon">${icon("database", "sm")}</span><div><strong>Owner：${esc(contract.moduleOwner || "数据工程")}</strong><small>业务输入 Owner：${esc(contract.businessInputOwner || "财务公司")} · C031 数据契约 · ${esc(contract.contractVersion || "1.1.0")}</small></div>${statusChip(historical ? (quality.status ? `历史：${quality.status}` : "历史未形成") : quality.status === "passed" ? "质量通过" : "待核", historical ? "info" : quality.status === "passed" ? "success" : "warning")}</div>
      <section class="module-stage-grid"><article class="panel"><div class="panel-heading"><div><span class="eyebrow">输入上下文</span><h3>权威数据夹具与评估口径</h3></div>${statusChip("仅正式候选可消费", "info")}</div><div class="member-cards">${members.map(function (member) { return `<article class="member-card"><span class="member-icon">${icon(member.name === "调节因子" ? "sliders" : "table", "sm")}</span><strong>${esc(member.name)}</strong><small>${esc(member.range)} · ${member.rowCount} 家 · ${member.fieldCount} 字段</small></article>`; }).join("")}</div><dl class="contract-facts"><div><dt>评估时点</dt><dd>${esc(contract.assessmentAt || "2025-12-31")}</dd></div><div><dt>币种 / 金额单位</dt><dd>${esc(contract.currency || "CNY")} / ${esc(contract.amountUnit || "元")}</dd></div><div><dt>当前期列</dt><dd><code>${esc(contract.currentPeriodColumn || "I")}</code></dd></div><div><dt>上期列</dt><dd><code>${esc(contract.priorPeriodColumn || "AA")}</code></dd></div><div><dt>来源文件</dt><dd title="${attr(source.fileName || "")}">${esc(source.fileName || "企业债务风险评估模版_S003兼容版.xlsx")}</dd></div><div><dt>正式候选</dt><dd title="${attr(formal.dataAssetId || "")}">${esc(formal.dataAssetId || "—")}</dd></div></dl></article><article class="panel"><div class="panel-heading"><div><span class="eyebrow">M02 资源链</span><h3>从来源到正式候选</h3></div><span class="panel-note">不得在此计算评分</span></div><div class="resource-list">${resourceRow("来源工作簿", source.sourceId, "1.0.0", "已验证", "M02 数据工程", `sha256 ${String(source.sourceSha256 || "").slice(0, 12)}…`)}${resourceRow("人工输入快照", input.snapshotId, input.snapshotVersion, input.status === "published-input" ? "已发布" : input.status, "M02 数据工程", `${input.enterpriseCount || 21} 家 · ${input.factorCount || 6} 项 · 无复核人`)}${resourceRow("管道运行", pipeline.pipelineRunId, "1.0.0", pipeline.status === "succeeded" ? "运行成功" : pipeline.status, "M02 数据工程", `输入 ${pipeline.inputSourceId || "—"}`)}${resourceRow("正式候选数据资产", formal.dataAssetId, formal.dataAssetVersion, formal.status === "quality-passed-candidate" ? "候选已形成" : formal.status, "M02 数据工程", `${formal.enterpriseCount || 21} 家 · 仅作为后续 Published 输入`)}${resourceRow("兼容性夹具", contract.forbiddenCompatibilityAsset?.sha256, "—", "不可消费", "M02 数据工程", "仅权威夹具，不得原地提升")}</div></article></section>
      <section class="module-stage-grid lower"><article class="panel"><div class="panel-heading"><div><span class="eyebrow">质量职责</span><h3>通过项与排除项</h3></div>${statusChip("M02 边界", "success")}</div><div class="quality-columns"><div><strong>${historical && !quality.status ? "该节点尚未形成质量结果" : "本次已校验"}</strong><ul>${(quality.checks || []).slice(0, 8).map(function (check) { return `<li><span class="quality-dot"></span><span>${esc(check.evidence || check.checkId || "质量检查")}</span></li>`; }).join("")}</ul></div><div><strong>明确不归 M02</strong><ul>${(contract.qualityDoesNotOwn || quality.explicitlyExcludedChecks || []).map(function (item) { return `<li><span class="quality-dot muted"></span><span>${esc(item)}</span></li>`; }).join("")}</ul></div></div></article><article class="panel"><div class="panel-heading"><div><span class="eyebrow">下一步</span><h3>进入场景内消费链</h3></div></div><div class="handoff-mini"><div><span class="handoff-index">01</span><div><strong>企业因子填报</strong><small>在线编辑并形成新的人工输入快照</small></div></div><div><span class="handoff-index">02</span><div><strong>Published 模型</strong><small>由 M01 校验并切换权威指针</small></div></div><div><span class="handoff-index">03</span><div><strong>快速重评 / 报告</strong><small>沿用当前场景运行身份链路</small></div></div></div></article></section>`;
  }

  function renderAgentBoundary() {
    const position = bundle()?.agentPosition || {};
    const model = displayModel();
    const run = displayRun();
    return `${pageHeader("Agent 能力边界", "M05 · 场景适配视图", "一期不建设 S003 专属 Agent；本视图把允许复用与明确禁止的动作放在同一场景上下文中，避免用户误以为 Agent 参与评分或业务写入。", button("返回场景总览", "view-overview", { primary: true, icon: "back" }))}
      <div class="module-owner-strip"><span class="module-owner-icon">${icon("bot", "sm")}</span><div><strong>Owner：${esc(position.moduleOwner || "Agent 应用")}</strong><small>状态：${esc(position.status || "verified-not-required-for-phase-1")} · 当前场景保留平台公共能力边界</small></div>${statusChip(position.dedicatedAgent ? "已配置专属 Agent" : "一期无专属 Agent", position.dedicatedAgent ? "warning" : "success")}</div>
      <section class="agent-boundary-grid"><article class="panel"><div class="panel-heading"><div><span class="eyebrow">M05 运行定位</span><h3>Agent 不进入评分闭环</h3></div>${statusChip("边界已锁定", "success")}</div><div class="agent-status-card"><span class="agent-status-icon">${icon("shield", "lg")}</span><div><strong>${position.dedicatedAgent ? "当前存在专属 Agent" : "当前不存在 S003 专属 Agent"}</strong><p>${esc(position.reason || "S003 一期为确定性评估、报告和通用决策闭环，不需要 Agent 参与评分或业务写入。")}</p></div></div><dl class="contract-facts"><div><dt>评分输入</dt><dd>Published 本体 / C035 结果</dd></div><div><dt>报告输入</dt><dd>正式运行证据与 Published 事实</dd></div><div><dt>决策入口</dt><dd>人工确认后 Action Request</dd></div><div><dt>Agent 写入</dt><dd>禁止</dd></div></dl></article><article class="panel"><div class="panel-heading"><div><span class="eyebrow">允许复用</span><h3>仅作为伴读边界</h3></div></div><ul class="boundary-list allowed">${(position.allowedReuse || []).map(function (item) { return `<li><span>${icon("check", "sm")}</span><div><strong>${esc(item)}</strong><small>后续如显式进入，仍必须消费当前 Published 结果</small></div></li>`; }).join("") || `<li><span>${icon("check", "sm")}</span><div><strong>平台现有报告伴读入口</strong><small>一期不在本场景启动</small></div></li>`}</ul></article><article class="panel"><div class="panel-heading"><div><span class="eyebrow">禁止越界</span><h3>四项强制阻断</h3></div>${statusChip("不可绕过", "danger")}</div><ul class="boundary-list forbidden">${(position.forbidden || ["重算 C035 结果", "修改模型配置", "自动创建 Action Request", "替代人工确认"]).map(function (item) { return `<li><span>${icon("close", "sm")}</span><div><strong>${esc(item)}</strong><small>由 M01/M04 或人工确认流程负责</small></div></li>`; }).join("")}</ul></article></section>
      <section class="panel handoff-chain-panel"><div class="panel-heading"><div><span class="eyebrow">统一场景链路</span><h3>Agent 位于链路之外</h3></div><small>所有节点仍在 S003 壳内可追溯</small></div><div class="handoff-chain"><div class="handoff-node"><span>M02</span><strong>数据与输入</strong><small>质量通过</small></div><b>→</b><div class="handoff-node"><span>M01</span><strong>Published 模型</strong><small>${esc(model?.packageVersion || "待发布")}</small></div><b>→</b><div class="handoff-node"><span>C035</span><strong>权威评估</strong><small>${esc(DATA.shortId(run?.runId || "待运行"))}</small></div><b>→</b><div class="handoff-node"><span>M06</span><strong>报告 / 工作台</strong><small>当前消费</small></div></div></section>`;
  }

  function renderPlatformHome() {
    const workflow = platformWorkflowStatus();
    const b = bundle() || {};
    const context = displayContext();
    const next = workflow.next;
    const modules = [
      { id: "M02", title: "数据工程", short: "数据", icon: "database", view: "data-quality", description: "来源、管道、质量、正式候选资产与企业因子输入。" },
      { id: "M01", title: "本体管理", short: "本体", icon: "network", view: "configuration", description: "风险模型、Metric、Rule、Action Type 与 Published 生命周期。" },
      { id: "M03", title: "智能问数", short: "问数", icon: "sparkles", view: "query-decision", description: "基于同轮 Published 风险事实的只读查询与证据回链。" },
      { id: "M04", title: "决策中心", short: "决策", icon: "target", view: "query-decision", description: "人工确认候选，沿用通用 Action Request 和负责人待办。" },
      { id: "M05", title: "Agent 应用", short: "Agent", icon: "bot", view: "agent-boundary", description: "展示一期无专属 Agent 的能力边界和后续公共复用位置。" },
      { id: "M06", title: "报告中心", short: "报告", icon: "file", view: "runs", description: "报告生命周期、运行证据、企业报告和仪表盘工作台。" }
    ];
    const latestTasks = workflow.items.slice().reverse().slice(0, 5);
    return `${pageHeader("平台首页", "Ontology Financial World · 平台能力架构", "公共首页只汇总 S003 场景进度与模块状态；风险评分、配置、报告和处置仍在对应模块或 M06 仪表盘内完成。", `${button("进入风险仪表盘", "view-overview", { primary: true, icon: "chart" })}${button("查看链路进度", "view-checkpoints", { ghost: true, icon: "layers" })}`)}
      <section class="baseline-context-strip"><div><span>当前场景</span><strong>S003 · 债务风险监测</strong></div><div><span>业务 Owner</span><strong>财务公司</strong></div><div><span>主要用户</span><strong>集团债务风险管理人员</strong></div><div><span>评估时点</span><strong>${esc(b.fixture?.assessmentAt || "2025-12-31")}</strong></div><div><span>当前运行</span><strong title="${attr(context.scenarioRunId || "")}">${esc(DATA.shortId(context.scenarioRunId || "待形成", 24, 7))}</strong></div></section>
      <section class="baseline-home-status"><div><span class="eyebrow">S003 场景链路进度</span><strong>${workflow.done}/${workflow.total}</strong><small>${workflow.total ? Math.round((workflow.done / workflow.total) * 100) : 0}% 来源状态已确认</small></div><div><span class="eyebrow">当前状态</span><strong>${next ? "存在待处理步骤" : "场景链路已完成"}</strong><small>${next ? esc(next.summary) : "所有已形成的运行、报告和快照仍按版本身份追溯。"}</small></div><div class="baseline-home-next">${next ? `<span class="status-chip warning"><i></i>下一步</span><strong>${esc(next.title)}</strong><button class="btn btn-small btn-primary" type="button" data-platform-action="${attr(next.module === "M02" ? "view-scene-data" : next.module === "M01" ? "view-scene-config" : next.module === "M03" ? "view-scene-query" : next.module === "M04" ? "view-scene-decision" : next.module === "M05" ? "view-scene-agent" : "view-scene-reports")}">前往处理 ${icon("chevronRight", "sm")}</button>` : `<span class="status-chip success"><i></i>当前无阻断</span><strong>全部已确认步骤均可追溯</strong>`}</div></section>
      <section class="baseline-architecture"><div class="baseline-architecture-copy"><span class="eyebrow">Ontology Financial World · 平台能力架构</span><h2>从可信数据到可追溯行动</h2><p>公共壳沿用 v1.0.3 的三大能力域和六模块链路；S003 只扩展债务风险领域资源与 M06 仪表盘，不替换通用模块职责。</p><div class="architecture-domain-row"><button class="architecture-domain active" type="button" data-platform-action="view-scene-data"><b>01</b><span>可信数据</span><small>数据治理 · 来源、处理、质量</small></button><button class="architecture-domain" type="button" data-platform-action="view-scene-query"><b>02</b><span>可信理解</span><small>问数、语义与 Published 事实</small></button><button class="architecture-domain" type="button" data-platform-action="view-scene-decision"><b>03</b><span>受控协作</span><small>决策、Agent 边界与报告</small></button></div></div><div class="architecture-core"><div class="architecture-core-mark">OFW</div><strong>智财问策</strong><small>数据治理 · 语义问数 · 行动智能</small></div></section>
      <section class="baseline-module-section"><div class="panel-heading"><div><span class="eyebrow">六模块链路入口</span><h2>保持 v1.0.3 模块边界，扩展 S003 场景能力</h2></div><span class="panel-note">公共壳只读汇总状态</span></div><div class="baseline-module-grid">${modules.map(function (module) { const done = workflow.items.filter(function (item) { return item.module === module.id && item.state === "complete"; }).length; const total = workflow.items.filter(function (item) { return item.module === module.id; }).length; const tone = done === total && total > 0 ? "success" : done ? "warning" : "neutral"; return `<article class="baseline-module-card"><div class="baseline-module-head"><span class="module-card-icon">${icon(module.icon, "sm")}</span><div><small>${esc(module.short)}</small><strong>${esc(module.title)}</strong></div>${statusChip(total && done === total ? "已确认" : done ? `${done}/${total}` : "待处理", tone)}</div><p>${esc(module.description)}</p><footer><span>${done}/${total || 0} 项场景状态已确认</span><div class="baseline-module-actions"><button class="btn btn-small btn-primary" type="button" data-platform-action="open-module-adapter" data-baseline-module-id="${attr(module.id)}">进入模块 ${icon("chevronRight", "sm")}</button><button class="btn btn-small btn-ghost" type="button" data-platform-action="${attr(module.id === "M02" ? "view-scene-data" : module.id === "M01" ? "view-scene-config" : module.id === "M03" ? "view-scene-query" : module.id === "M04" ? "view-scene-decision" : module.id === "M05" ? "view-scene-agent" : "view-scene-reports")}" title="S003 场景适配视图">场景视图 ${icon("chart", "sm")}</button></div></footer></article>`; }).join("")}</div></section>
      <section class="baseline-home-lower"><article class="panel"><div class="panel-heading"><div><span class="eyebrow">当前阻断</span><h3>${next ? esc(next.title) : "当前无待处理事项"}</h3></div>${statusChip(next ? "待处理" : "已确认", next ? "warning" : "success")}</div><p class="baseline-blocker-copy">${esc(next ? next.summary : "所有已形成的 S003 资源、评估、报告和 Checkpoint 均按独立运行身份记录；如需变更，请从 M06 仪表盘或快照页进入。")}</p><div class="baseline-home-actions"><button class="btn btn-small" type="button" data-action="refresh-source">重新读取</button>${next ? `<button class="btn btn-small btn-primary" type="button" data-platform-action="${attr(next.module === "M02" ? "view-scene-data" : next.module === "M01" ? "view-scene-config" : next.module === "M03" ? "view-scene-query" : next.module === "M04" ? "view-scene-decision" : next.module === "M05" ? "view-scene-agent" : "view-scene-reports")}">前往处理</button>` : ""}</div></article><article class="panel"><div class="panel-heading"><div><span class="eyebrow">最近任务与结果</span><h3>当前场景状态摘要</h3></div><span class="panel-note">来源：S003 当前状态</span></div><div class="baseline-task-list">${latestTasks.map(function (item) { return `<div class="baseline-task-row"><span class="task-check ${item.state === "complete" ? "done" : ""}">${item.state === "complete" ? icon("check", "sm") : icon("clock", "sm")}</span><div><strong>${esc(item.title)} · ${item.state === "complete" ? "已确认" : "待处理"}</strong><small>${esc(item.summary)}</small></div></div>`; }).join("")}</div></article></section>`;
  }

  function renderOverview() {
    const st = state();
    const b = bundle();
    const run = displayRun();
    const total = b?.fixture?.enterpriseCount || fixtureEnterprises().length;
    const counts = riskCounts();
    const scored = records().filter(function (record) { return Number.isFinite(Number(record.finalScore)); });
    const avg = scored.length ? scored.reduce(function (sum, record) { return sum + Number(record.finalScore); }, 0) / scored.length : null;
    // M06 只读取 M04 已形成的正式分档候选；仪表盘不重新计算评分，也不另建一套行动口径。
    const actionCandidates = decisionCandidates();
    const quality = displayQualityResult();
    return `${pageHeader("债务风险监测总览", "S003 · M06 场景工作台", "面向集团债务风险管理人员，串起因子填报、模型发布、快速重评、企业报告与通用决策确认。", `${button("进入企业明细", "view-enterprises", { primary: true, icon: "building" })}${button("填写企业因子", "view-factor-entry", { ghost: true, icon: "edit" })}`)}
      <section class="hero-band"><div><span class="hero-kicker">${esc(DATA.BRAND.scene)}</span><h2>集团债务风险<br><em>可解释、可追溯</em>地监测</h2><p>当前评估时点 <strong>${esc(b?.fixture?.assessmentAt || "2025-12-31")}</strong>，覆盖 <strong>${total}</strong> 家企业；所有结论携带场景身份、模型版本与数据资产引用。</p><div class="hero-meta"><span>${icon("shield", "sm")}父基线 v1.0.3</span><span>${icon("database", "sm")}财务工作簿 + 企业因子输入</span><span>${icon("lock", "sm")}运行隔离</span></div></div><div class="hero-score"><span>${st.regressionRun ? "隔离演练运行" : "本轮成功运行"}</span><strong>${run ? esc(DATA.shortId(run.runId)) : "—"}</strong><small>${run ? `${DATA.formatDateTime(run.evaluatedAt)} · ${run.modelVersion}` : "等待 M01 评估结果"}</small></div></section>
      ${!run ? `<div class="callout warning">${icon("alert", "sm")}<div><strong>当前尚无可消费的 Published 风险事实</strong><p>工作台已完成场景数据与配置装载；待 M01 评分引擎返回权威评估结果后，企业评分、报告和问数将自动可用。</p></div></div>` : ""}
      <section class="kpi-grid">${kpiCard("企业总数", total, "财务数据成员已接入", "blue", "building")}${kpiCard("黄 / 红 / 黑", `${counts.YELLOW} / ${counts.RED} / ${counts.BLACK}`, run ? "需关注企业" : "待 M01 评估", "risk", "alert")}${kpiCard("集团平均评分", avg == null ? "—" : DATA.formatScore(avg), run ? "基于当前成功运行" : "不在前端自行计算", "violet", "chart")}${kpiCard("数据质量", quality?.status === "passed" ? "通过" : "待核", quality?.qualityResultId || "M02 质量结果", "green", "shield")}</section>
      <section class="overview-grid"><article class="panel risk-panel"><div class="panel-heading"><div><span class="eyebrow">风险分布</span><h3>四档风险分布</h3></div><span class="panel-note">${run ? `共 ${scored.length} 家已评分` : "等待权威结果"}</span></div>${renderPublishedThresholds()}${renderRiskDistribution(counts, total)}</article><article class="panel sector-panel"><div class="panel-heading"><div><span class="eyebrow">产业板块</span><h3>板块监测</h3></div><button class="link-button" type="button" data-action="view-enterprises">查看全部 ${icon("chevronRight", "sm")}</button></div><div class="sector-grid">${sectorSummary()}</div></article></section>
      <section class="overview-grid lower"><article class="panel"><div class="panel-heading"><div><span class="eyebrow">重点企业</span><h3>需要优先关注</h3></div><button class="link-button" type="button" data-action="view-enterprises">进入明细 ${icon("chevronRight", "sm")}</button></div>${renderRiskRows(topRiskRows(5), { empty: "当前没有风险评分明细。" })}</article><article class="panel"><div class="panel-heading"><div><span class="eyebrow">运行链路</span><h3>场景工作台进度</h3></div><button class="link-button" type="button" data-action="view-checkpoints">查看快照 ${icon("chevronRight", "sm")}</button></div>${processRail()}<div class="mini-contracts"><span>数据资产 <b>${esc(b?.formalDataAsset?.dataAssetId || "S003-T007-FORMAL-CANDIDATE")}</b></span><span>人工输入 <b>${esc(displayInputSnapshot()?.snapshotId || "S003-T053-INPUT-20251231-v1")}</b></span></div></article></section>
      <section class="panel overview-action-panel"><div class="panel-heading"><div><span class="eyebrow">风险触发与行动</span><h3>按亮灯逐户形成预警入口</h3><p class="panel-subtitle">黄灯、红灯、黑灯均纳入候选；集团债务风险管理人员核对报告后提交，申请直接送达对应成员单位债务风险接口人。</p></div><div class="overview-action-heading-tools"><span class="panel-note">${run && runAuthority().formalEvidence ? `${actionCandidates.length} 家亮灯企业` : "待正式结果"}</span><button class="link-button" type="button" data-action="view-decision-todos">查看决策中心 ${icon("chevronRight", "sm")}</button></div></div>${renderDecisionCandidates()}</section>
      <section class="panel table-panel overview-enterprise-panel"><div class="panel-heading"><div><span class="eyebrow">企业评分明细</span><h3>全部企业风险评分明细（${scored.length || total} 家）</h3></div><button class="link-button" type="button" data-action="view-enterprises">筛选、排序与查看全部 ${icon("chevronRight", "sm")}</button></div>${renderOverviewEnterpriseTable()}<footer class="table-footer"><span>${icon("shield", "sm")}所有评分、分档和报告均来自当前 Published 模型与正式运行证据；点击企业可穿透当前运行报告。</span><strong>${esc(run?.runId || "待形成运行")}</strong></footer></section>`;
  }

  function enterpriseRows() {
    const st = state();
    const resultMap = Object.fromEntries(records().map(function (record) { return [record.enterpriseId, record]; }));
    const search = st.enterpriseSearch.trim().toLowerCase();
    const list = fixtureEnterprises().map(function (enterprise) {
      return { enterprise, record: resultMap[enterprise.enterpriseId] || null };
    }).filter(function (row) {
      if (search && !`${row.enterprise.name} ${row.enterprise.enterpriseId} ${row.enterprise.sector} ${row.enterprise.category}`.toLowerCase().includes(search)) return false;
      if (st.enterpriseRiskFilter !== "ALL" && DATA.riskKey(row.record?.riskTier) !== st.enterpriseRiskFilter) return false;
      if (st.enterpriseSectorFilter !== "ALL" && row.enterprise.sector !== st.enterpriseSectorFilter) return false;
      return true;
    });
    list.sort(function (a, b) {
      if (st.enterpriseSort === "name-asc") return a.enterprise.name.localeCompare(b.enterprise.name, "zh-CN");
      if (st.enterpriseSort === "name-desc") return b.enterprise.name.localeCompare(a.enterprise.name, "zh-CN");
      if (st.enterpriseSort === "score-desc") return Number(b.record?.finalScore ?? -Infinity) - Number(a.record?.finalScore ?? -Infinity);
      if (st.enterpriseSort === "risk") {
        const rank = DATA.riskRank(a.record?.riskTier) - DATA.riskRank(b.record?.riskTier);
        return rank || Number(a.record?.finalScore ?? Infinity) - Number(b.record?.finalScore ?? Infinity);
      }
      return Number(a.record?.finalScore ?? Infinity) - Number(b.record?.finalScore ?? Infinity);
    });
    return list;
  }

  function metricNames(record) {
    const items = record?.lowestMetrics || [];
    if (!items.length) return '<span class="muted">等待权威评估</span>';
    return `<div class="metric-tags">${items.slice(0, 3).map(function (item) { return `<span title="${attr(item.note || "")}">${esc(item.name || item.metricName || "指标")}</span>`; }).join("")}</div>`;
  }

  function renderEnterpriseTable() {
    const rows = enterpriseRows();
    if (!rows.length) return `<div class="empty-state">${icon("search", "lg")}<strong>没有匹配的企业</strong><span>请调整搜索词或筛选条件。</span></div>`;
    return `<div class="data-table-wrap"><table class="data-table enterprise-table"><thead><tr><th>企业</th><th>产业 / 类别</th><th class="num">原始分</th><th class="num">调节合计</th><th class="num">综合分</th><th>风险等级</th><th>得分最低 3 项</th><th>报告</th></tr></thead><tbody>${rows.map(function ({ enterprise, record }) {
      const actionCandidate = STORE.candidateFor(enterprise.enterpriseId);
      return `<tr><td><button class="company-link" type="button" data-action="open-report" data-enterprise-id="${attr(enterprise.enterpriseId)}"><strong>${esc(enterprise.name)}</strong><small>${esc(enterprise.enterpriseId)}</small></button></td><td><strong class="cell-primary">${esc(enterprise.sector)}</strong><small class="cell-secondary">${esc(enterprise.category)}</small></td><td class="num mono">${record?.rawScore == null ? "—" : DATA.formatScore(record.rawScore)}</td><td class="num mono ${Number(record?.factorSum) < 0 ? "negative" : ""}">${record?.factorSum == null ? "—" : `${Number(record.factorSum) > 0 ? "+" : ""}${Number(record.factorSum).toFixed(2)}`}</td><td class="num"><strong class="score-cell">${record?.finalScore == null ? "—" : DATA.formatScore(record.finalScore)}</strong></td><td>${riskBadge(record?.riskTier || "UNKNOWN", true)}${actionCandidate ? '<small class="candidate-mark">处置候选</small>' : ""}</td><td>${metricNames(record)}</td><td><button class="table-action" type="button" data-action="open-report" data-enterprise-id="${attr(enterprise.enterpriseId)}">${icon("file", "sm")}查看</button></td></tr>`;
    }).join("")}</tbody></table></div>`;
  }

  function filterSelect(label, name, value, options) {
    return `<label class="filter-field"><span>${esc(label)}</span><select data-filter="${attr(name)}">${options.map(function (option) { const item = typeof option === "string" ? { value: option, label: option } : option; return `<option value="${attr(item.value)}" ${item.value === value ? "selected" : ""}>${esc(item.label)}</option>`; }).join("")}</select>${icon("chevronDown", "sm")}</label>`;
  }

  function renderEnterprises() {
    const st = state();
    const sectors = [...new Set(fixtureEnterprises().map(function (item) { return item.sector; }))];
    return `${pageHeader("企业风险评分明细", "风险总览 · 明细穿透", "按企业、风险等级和产业板块筛选；点击任一企业进入同一运行身份下的诊断报告。", `${button("导出打印", "print-report", { ghost: true, icon: "print" })}${button("快速重跑", "quick-rerun", { primary: true, icon: "refresh", disabled: st.runStatus === "running" || Boolean(st.historicalView) })}`)}
      <section class="panel table-panel"><div class="table-toolbar"><label class="search-field">${icon("search", "sm")}<input type="search" data-filter="enterpriseSearch" value="${attr(st.enterpriseSearch)}" placeholder="搜索企业名称、ID、板块或类别" /><kbd>/</kbd></label><div class="filter-group">${filterSelect("风险", "enterpriseRiskFilter", st.enterpriseRiskFilter, [{ value: "ALL", label: "全部风险" }, ...["GREEN", "YELLOW", "RED", "BLACK"].map(function (key) { return { value: key, label: DATA.RISK_META[key].name }; })])}${filterSelect("板块", "enterpriseSectorFilter", st.enterpriseSectorFilter, [{ value: "ALL", label: "全部板块" }, ...sectors])}${filterSelect("排序", "enterpriseSort", st.enterpriseSort, [{ value: "score-asc", label: "评分从低到高" }, { value: "score-desc", label: "评分从高到低" }, { value: "risk", label: "风险优先" }, { value: "name-asc", label: "名称 A–Z" }, { value: "name-desc", label: "名称 Z–A" }])}</div><span class="result-count">${enterpriseRows().length} / ${fixtureEnterprises().length} 家</span></div>${renderEnterpriseTable()}<footer class="table-footer"><span>${icon("info", "sm")}评分只展示 M01 C035 权威结果；排序与筛选不会触发重算。</span><strong>评估时点 ${esc(bundle().fixture.assessmentAt)}</strong></footer></section>`;
  }

  function factorStateMeta(enterprise, factorName, value) {
    if (DATA.isNotApplicable(enterprise, factorName)) return { label: "不适用", code: "NOT_APPLICABLE", tone: "neutral" };
    if (value == null || value === "") return { label: "缺失套 0 档", code: "DEFAULTED_ZERO", tone: "warning" };
    return { label: "已显式填报", code: "EXPLICIT_VALUE", tone: "success" };
  }

  function renderFactorForm(enterprise) {
    if (!enterprise) return "";
    const values = state().factorInputs[enterprise.enterpriseId] || {};
    return `<div class="factor-form-grid">${Object.entries(DATA.FACTOR_INPUT_CHOICES).map(function ([factorName, choices]) {
      const value = values[factorName] ?? null;
      const meta = factorStateMeta(enterprise, factorName, value);
      const notApplicable = meta.code === "NOT_APPLICABLE";
      const disabled = notApplicable || Boolean(state().historicalView);
      return `<label class="factor-field ${disabled ? "is-disabled" : ""} ${notApplicable ? "is-not-applicable" : ""}"><span class="factor-label"><strong>${esc(factorName)}</strong>${statusChip(meta.label, meta.tone)}</span><span class="factor-control"><select data-factor-name="${attr(factorName)}" data-enterprise-id="${attr(enterprise.enterpriseId)}" ${disabled ? "disabled" : ""}><option value="__MISSING__" ${notApplicable || value == null || value === "" ? "selected" : ""}>${notApplicable ? "不适用（环保 / 在建企业）" : "未填报（按 0 档）"}</option>${choices.map(function (choice) { return `<option value="${attr(choice)}" ${!notApplicable && choice === value ? "selected" : ""}>${esc(choice)}</option>`; }).join("")}</select>${icon(notApplicable ? "lock" : "chevronDown", "sm")}</span><small><code>${esc(meta.code)}</code>${notApplicable ? " 与缺失不同，不参与因子计算" : meta.code === "DEFAULTED_ZERO" ? " 适用但未填，按用户确认口径使用 0 档" : " 由财务公司人工填报"}</small></label>`;
    }).join("")}</div>`;
  }

  function factorCompletion() {
    let explicit = 0;
    let defaults = 0;
    let notApplicable = 0;
    fixtureEnterprises().forEach(function (enterprise) {
      Object.keys(DATA.FACTOR_INPUT_CHOICES).forEach(function (name) {
        const meta = factorStateMeta(enterprise, name, state().factorInputs[enterprise.enterpriseId]?.[name]);
        if (meta.code === "EXPLICIT_VALUE") explicit += 1;
        if (meta.code === "DEFAULTED_ZERO") defaults += 1;
        if (meta.code === "NOT_APPLICABLE") notApplicable += 1;
      });
    });
    return { explicit, defaults, notApplicable, total: explicit + defaults + notApplicable };
  }

  function renderFactorEntry() {
    const st = state();
    const enterprise = selectedEnterprise();
    const completion = factorCompletion();
    const validation = st.factorEntryValidation;
    const status = st.factorEntryStatus === "published" ? statusChip("Published 输入快照", "success") : st.factorEntryStatus === "validated" ? statusChip("校验通过", "warning") : statusChip("Draft", "warning");
    return `${pageHeader("企业因子在线填报", "M02 · 人工业务输入", "一期由财务公司在线填报六项企业因子，不设置复核人；保存和发布均不会自动触发风险重评。", `${button("校验全部", "validate-factor-inputs", { ghost: true, icon: "check", disabled: Boolean(st.historicalView) })}${button("发布输入快照", "publish-factor-inputs", { primary: true, icon: "lock", disabled: Boolean(st.historicalView) })}`)}
      <div class="callout info">${icon("info", "sm")}<div><strong>人工取值与模型定义分离</strong><p>本页只维护企业当期取值；因子系数和规则由 M01 Published 模型包维护。环保和在建企业的电价因子记为 NOT_APPLICABLE，适用但缺失才套 0 档。</p></div></div>
      <section class="split-layout factor-layout"><aside class="entity-picker panel"><div class="panel-heading"><div><span class="eyebrow">填报对象</span><h3>21 家企业</h3></div>${status}</div><label class="search-field compact">${icon("search", "sm")}<input type="search" data-filter="factorEntrySearch" value="${attr(st.factorEntrySearch)}" placeholder="筛选企业" /></label><div class="entity-list">${fixtureEnterprises().filter(function (item) { return !st.factorEntrySearch || item.name.includes(st.factorEntrySearch) || item.enterpriseId.toLowerCase().includes(st.factorEntrySearch.toLowerCase()); }).map(function (item) { const selected = item.enterpriseId === enterprise?.enterpriseId; const values = st.factorInputs[item.enterpriseId] || {}; const incomplete = Object.keys(DATA.FACTOR_INPUT_CHOICES).filter(function (name) { return !DATA.isNotApplicable(item, name) && (values[name] == null || values[name] === ""); }).length; return `<button class="entity-option ${selected ? "active" : ""}" type="button" data-action="select-factor-enterprise" data-enterprise-id="${attr(item.enterpriseId)}"><span><strong>${esc(item.name)}</strong><small>${esc(item.category)}</small></span>${incomplete ? `<em>${incomplete} 缺失</em>` : icon("check", "sm")}</button>`; }).join("")}</div></aside><article class="panel factor-editor"><div class="factor-editor-head"><div><span class="eyebrow">当前企业</span><h2>${esc(enterprise?.name || "—")}</h2><p>${esc(enterprise?.category || "—")} · ${esc(enterprise?.enterpriseId || "—")} · 评估时点 ${esc(bundle().fixture.assessmentAt)}</p></div><button class="link-button" type="button" data-action="open-report" data-enterprise-id="${attr(enterprise?.enterpriseId || "")}">查看报告 ${icon("chevronRight", "sm")}</button></div>${renderFactorForm(enterprise)}<div class="editor-footer"><div><span>${status}</span><small>${st.factorInputSnapshot?.snapshotId ? `当前：${esc(st.factorInputSnapshot.snapshotId)}` : "尚未发布输入快照"}</small></div><div>${button("保存 Draft", "save-factor-draft", { ghost: true, icon: "save", disabled: Boolean(st.historicalView) })}${button("校验并发布", "validate-publish-factors", { primary: true, icon: "lock", disabled: Boolean(st.historicalView) })}</div></div></article></section>
      <section class="panel input-summary"><div class="panel-heading"><div><span class="eyebrow">输入完整性</span><h3>业务输入状态</h3></div><small>共 ${completion.total} 个企业因子单元</small></div><div class="summary-metrics"><div><strong>${completion.explicit}</strong><span>显式填报</span></div><div><strong>${completion.defaults}</strong><span>缺失套 0 档</span></div><div><strong>${completion.notApplicable}</strong><span>不适用</span></div><div><strong>0</strong><span>待复核（一期不设）</span></div></div>${validation ? `<div class="validation-result ${validation.ok ? "success" : "danger"}">${icon(validation.ok ? "check" : "alert", "sm")}<div><strong>${validation.ok ? "输入枚举与适用性校验通过" : `发现 ${validation.errors.length} 项错误`}</strong><p>${validation.ok ? `DEFAULTED_ZERO ${validation.defaultedZeroCount} 项，NOT_APPLICABLE ${validation.notApplicableCount} 项。` : esc(validation.errors.slice(0, 3).join("；"))}</p></div></div>` : ""}</section>`;
  }

  function configStatusCard() {
    const st = state();
    const model = displayModel();
    const historical = Boolean(st.historicalView);
    const lifecycle = historical
      ? { label: "历史只读", tone: "info", note: "仅展示该 Checkpoint 当时的 Published 模型" }
      : st.configStatus === "published" ? { label: "Published", tone: "success", note: "当前配置可用于重评" }
        : st.configStatus === "validated" ? { label: "已校验", tone: "warning", note: "尚未切换 Published 指针" }
          : { label: "Draft", tone: "warning", note: "草稿不可运行" };
    return `<div class="config-status-card"><span class="config-status-icon">${icon(historical || st.configStatus === "published" ? "lock" : "edit", "lg")}</span><div><span>模型包 ${esc(model?.packageId || "S003-M01-DEBT-RISK-PKG")}</span><strong>${esc(model?.packageVersion || "—")} · ${esc(lifecycle.label)}</strong><small>${esc(lifecycle.note)} · 业务 Owner：财务公司 · 生命周期 Owner：本体管理</small></div>${statusChip(lifecycle.label, lifecycle.tone)}</div>`;
  }

  function configLifecycleGuide() {
    const st = state();
    const model = displayModel() || {};
    const current = model.packageVersion || "—";
    const proposed = st.configDraft?.proposedVersion || "系统自动生成下一版本";
    const runVersion = displayRun()?.modelVersion || "—";
    const pending = runVersion !== "—" && runVersion !== current;
    return `<section class="panel config-lifecycle-guide"><div class="panel-heading"><div><span class="eyebrow">版本与生效机制</span><h3>先发布，再重跑；旧版本只读保留</h3></div>${statusChip(pending ? "新配置待重跑" : "当前版本生效", pending ? "warning" : "success")}</div><div class="config-version-summary"><div><span>当前 Published</span><strong>V${esc(current)}</strong><small>后续新运行默认采用</small></div><div><span>下一建议版本</span><strong>V${esc(proposed)}</strong><small>系统按单调版本号生成</small></div><div><span>当前评分批次</span><strong>V${esc(runVersion)}</strong><small>${pending ? "仍使用旧版本" : "与 Published 一致"}</small></div></div><div class="config-effect-rules"><p><b>生效</b>修改 Draft → 校验 → 发布；发布只切换 Published 指针，不自动改变已有评分和报告。</p><p><b>应用</b>在仪表盘点击“快速重跑”，创建新的 scenarioRunId 后，新批次才使用当前 Published 版本。</p><p><b>停用 / 回退</b>不删除或原地启用旧版本；需要回退时克隆旧版本形成更高版本的新 Draft，再校验、发布和重跑。</p></div></section>`;
  }

  function renderWeightConfig() {
    const draft = displayConfigDraft();
    const categories = Object.keys(draft.weights || {});
    return `<div class="config-description"><div>${icon("table", "sm")}<span><strong>评分权重</strong>固定 15 项指标，可调整三类企业权重；每类合计必须为 100。</span></div><span>评分锚点一期不开放编辑</span></div><div class="data-table-wrap"><table class="data-table config-table"><thead><tr><th>#</th><th>指标</th>${categories.map(function (category) { return `<th class="num">${esc(category)}</th>`; }).join("")}</tr></thead><tbody>${draft.indicatorOrder.map(function (metric, index) { return `<tr><td class="row-number">${String(index + 1).padStart(2, "0")}</td><td><strong>${esc(metric)}</strong>${metric === "盈利稳定性" ? '<small class="cell-secondary">历史不足默认 A（100 分）</small>' : ""}</td>${categories.map(function (category) { return `<td class="num"><label class="number-input"><input type="number" min="0" max="100" step="1" data-weight-category="${attr(category)}" data-weight-index="${index}" value="${attr(draft.weights[category][index])}" ${state().historicalView ? "disabled" : ""}/><span>%</span></label></td>`; }).join("")}</tr>`; }).join("")}<tr class="total-row"><td></td><td><strong>权重合计</strong></td>${categories.map(function (category) { const total = draft.weights[category].reduce(function (sum, value) { return sum + Number(value || 0); }, 0); return `<td class="num"><strong class="${Math.abs(total - 100) < .001 ? "valid-total" : "invalid-total"}">${total}</strong></td>`; }).join("")}</tr></tbody></table></div>`;
  }

  function renderFactorConfig() {
    const factors = displayConfigDraft().factors || [];
    const descriptions = {
      "credit-utilization": "反映授信额度消耗和新增融资空间。",
      guarantee: "区分对外担保负担与接受集团担保支持。",
      "headquarters-support": "以总部持股与支持强度刻画股东支持能力。",
      "electricity-price": "仅适用于新能源风电和核电；环保与在建企业记为不适用。",
      litigation: "以重大诉讼相对净资产规模刻画或有损失风险。",
      "fund-gap": "以资金缺口出现时间刻画近期流动性压力。"
    };
    return `<div class="config-description"><div>${icon("sliders", "sm")}<span><strong>调节因子系数</strong>一期固定六项因子及分档，只允许调整已确认分档系数。</span></div><span>禁止新增 / 删除因子和分档</span></div><div class="factor-config-grid">${factors.map(function (factor, factorIndex) { return `<article class="factor-config-card"><header><span class="factor-number">F${String(factorIndex + 1).padStart(2, "0")}</span><div><strong>${esc(factor.name)}</strong><small>适用：${esc((factor.applicableCategories || []).join("、"))}</small></div>${icon("lock", "sm")}</header><p class="factor-config-note">${esc(descriptions[factor.factorId] || "系数由财务公司定义，并由 M01 Published 生命周期维护。")}</p><div class="factor-tier-list">${factor.tiers.map(function (tier) { return `<label><span><strong>${esc(tier.label)}</strong><small>${esc(tier.tierId)}${tier.tierId === "ZERO" ? " · 默认 / 缺失零档" : ""}</small></span><span class="number-input coefficient"><input type="number" min="-1" max="1" step="0.01" data-factor-id="${attr(factor.factorId)}" data-tier-id="${attr(tier.tierId)}" value="${attr(tier.coefficient)}" ${state().historicalView ? "disabled" : ""}/><em>${Number(tier.coefficient) > 0 ? "加分" : Number(tier.coefficient) < 0 ? "减分" : "中性"}</em></span></label>`; }).join("")}</div><footer class="factor-config-policy"><span>适用但缺失：<b>DEFAULTED_ZERO</b></span><span>业务不适用：<b>NOT_APPLICABLE</b></span></footer></article>`; }).join("")}</div>`;
  }

  function configRiskRangeLabel(tier, tiers, index) {
    const min = Number(tier.minInclusive);
    const max = index === 0 ? null : Number(tiers[index - 1].minInclusive);
    return max == null ? `≥ ${min}` : `≥ ${min} 且 < ${max}`;
  }

  function renderRiskTierConfig() {
    const tiers = displayConfigDraft().riskTiers || [];
    return `<div class="config-description"><div>${icon("alert", "sm")}<span><strong>风险分档阈值</strong>固定绿、黄、红、黑四档，只允许调整连续阈值。</span></div><span>黑灯下限固定为 0</span></div><div class="risk-tier-config">${tiers.map(function (tier, index) { const meta = DATA.RISK_META[tier.tierId] || DATA.RISK_META.UNKNOWN; return `<article class="risk-tier-card ${meta.className}"><div class="risk-tier-title"><span class="risk-dot"></span><div><strong>${esc(tier.name)}</strong><small>${esc(tier.tierId)} · ${esc(tier.color || meta.color)}</small></div>${icon("lock", "sm")}</div><p class="risk-tier-description">${esc(meta.description)}</p><label><span>分数下限（含）</span><div class="number-input threshold"><input type="number" min="0" max="100" step="1" data-risk-tier-id="${attr(tier.tierId)}" value="${attr(tier.minInclusive)}" ${tier.tierId === "BLACK" || state().historicalView ? "disabled" : ""}/><em>分</em></div></label><p>当前范围：<strong>${esc(configRiskRangeLabel(tier, tiers, index))}</strong></p><small class="risk-tier-rule">综合分 = clamp（原始分 ×（1 + 调节系数合计），0，100）</small></article>`; }).join("")}</div>`;
  }

  function renderConfigBody() {
    if (state().activeConfigTab === "factors") return renderFactorConfig();
    if (state().activeConfigTab === "tiers") return renderRiskTierConfig();
    return renderWeightConfig();
  }

  function renderConfiguration() {
    const st = state();
    const validation = st.historicalView ? null : st.configValidation;
    return `${pageHeader("风险模型与分档配置", "M01 · Published 原子模型包", "配置由财务公司定义业务口径、本体管理维护版本与 Published 指针；页面不把模型参数下沉到 M02 管道或质量规则。", `${button("校验配置", "validate-configuration", { ghost: true, icon: "check", disabled: Boolean(st.historicalView) })}${button("发布新版本", "publish-configuration", { primary: true, icon: "lock", disabled: Boolean(st.historicalView) })}`)}
      ${renderBaselineCompatibility("M01")}
      ${configStatusCard()}${configLifecycleGuide()}<section class="panel config-workspace"><div class="config-tabs" role="tablist"><button class="${st.activeConfigTab === "weights" ? "active" : ""}" type="button" data-config-tab="weights">评分权重</button><button class="${st.activeConfigTab === "factors" ? "active" : ""}" type="button" data-config-tab="factors">调节因子</button><button class="${st.activeConfigTab === "tiers" ? "active" : ""}" type="button" data-config-tab="tiers">风险分档</button></div><div class="config-body">${renderConfigBody()}</div><footer class="config-footer"><div>${validation ? `<div class="validation-result inline ${validation.ok ? "success" : "danger"}">${icon(validation.ok ? "check" : "alert", "sm")}<span>${validation.ok ? "配置校验通过，可发布新版本" : `${validation.errors.length} 项配置错误：${esc(validation.errors.slice(0, 2).join("；"))}`}</span></div>` : st.historicalView ? `<span class="muted">历史配置只读；如需调整，请克隆恢复为新 scenarioRunId 后再编辑。</span>` : `<span class="muted">修改任一值即进入 Draft；Draft 不可重评。</span>`}</div><div>${button("放弃 Draft", "reset-configuration", { ghost: true, icon: "refresh", disabled: st.configStatus === "published" || Boolean(st.historicalView) })}${button("校验", "validate-configuration", { ghost: true, icon: "check", disabled: Boolean(st.historicalView) })}${button("发布", "publish-configuration", { primary: true, icon: "lock", disabled: Boolean(st.historicalView) })}</div></footer></section>
      <div class="boundary-grid"><article class="boundary-card allowed"><strong>${icon("check", "sm")}本页负责</strong><p>权重、六项因子系数、四档阈值的 Draft → 校验 → Published；发布后才可快速重评。</p></article><article class="boundary-card forbidden"><strong>${icon("alert", "sm")}本页不负责</strong><p>不修改评分锚点，不新增因子或风险档，不自动创建 Action Request，不把参数写入 Python 管道。</p></article></div>`;
  }

  function runRiskSummary(run) {
    if (!run) return "";
    const counts = { GREEN: 0, YELLOW: 0, RED: 0, BLACK: 0, ...(run.riskCounts || {}) };
    if (Array.isArray(run.enterpriseResults)) {
      Object.assign(counts, { GREEN: 0, YELLOW: 0, RED: 0, BLACK: 0 });
      run.enterpriseResults.forEach(function (item) { if (counts[item.riskTier] !== undefined) counts[item.riskTier] += 1; });
    }
    return `<div class="run-risk-summary">${["GREEN", "YELLOW", "RED", "BLACK"].map(function (key) { return `<span>${riskBadge(key, true)}<b>${counts[key]}</b></span>`; }).join("")}</div>`;
  }

  function renderRunHistory() {
    const st = state();
    const history = st.historicalView
      ? (displayRun() ? [displayRun()] : [])
      : (st.runHistory || []);
    if (!history.length) return `<div class="empty-state compact">${icon("clock", "sm")}<span>尚无成功运行；失败不会覆盖上一成功运行。</span></div>`;
    const activeRunId = displayRun()?.runId;
    return `<div class="run-history-list">${history.map(function (run) { const authority = runAuthority(run); const active = run.runId === activeRunId; const label = authority.regression ? "演练" : authority.workProjection ? "工作投影" : authority.historical ? "历史只读" : active ? "正式当前" : "正式历史"; return `<article class="run-history-row ${active ? "active" : ""} ${authority.workProjection ? "work-projection" : ""}"><span class="run-status-dot"></span><div class="run-identity"><strong>${esc(DATA.shortId(run.runId, 22, 8))}</strong><small>${DATA.formatDateTime(run.evaluatedAt)} · ${esc(run.modelVersion)} · ${esc(run.authorityMode || "pending")}</small></div>${runRiskSummary(run)}<span class="run-report-count">${run.reportCount} 份${authority.canFormalReport ? "正式报告" : "报告预览"}</span>${statusChip(label, authority.formalEvidence && !authority.historical ? "success" : authority.historical ? "info" : "warning")}</article>`; }).join("")}</div>`;
  }

  function displayReportCount() {
    const st = state();
    const run = displayRun();
    if (!st.historicalView) return Number(run?.reportCount || run?.reports?.length || 0);
    const projection = st.historicalView.projection;
    return Number(projection?.reportManifest?.reportCount || projection?.reportManifest?.reports?.length || projection?.run?.reports?.length || 0);
  }

  function reportCards() {
    const authority = runAuthority();
    if (state().historicalView && displayReportCount() === 0) return `<div class="empty-state">${icon("lock", "lg")}<strong>${esc(state().historicalView.code)} 未锁定 M06 报告</strong><span>历史视图不会回退读取当前 bundle 或后续 Checkpoint 的报告资源。</span></div>`;
    if (!records().length) return `<div class="empty-state">${icon("file", "lg")}<strong>尚无企业报告</strong><span>报告只在成功评估后自动生成，并与本轮运行身份保持一致。</span></div>`;
    return `<div class="report-card-grid">${records().slice().sort(function (a, b) { return DATA.riskRank(a.riskTier) - DATA.riskRank(b.riskTier) || Number(a.finalScore) - Number(b.finalScore); }).map(function (record) { return `<button class="report-card ${authority.canFormalReport ? "formal-report" : "preview-report"}" type="button" data-action="open-report" data-enterprise-id="${attr(record.enterpriseId)}"><div class="report-card-top">${riskBadge(record.riskTier, true)}<span>${DATA.formatScore(record.finalScore)} 分</span></div><strong>${esc(record.enterpriseName)}</strong><small>${esc(record.category)} · ${esc(record.assessmentAt)}</small><footer><span>${icon("file", "sm")}${authority.canFormalReport ? "正式报告" : "工作投影预览"}</span><span>${authority.canFormalReport ? "查看" : "预览"} ${icon("chevronRight", "sm")}</span></footer></button>`; }).join("")}</div>`;
  }

  function renderRuns() {
    const st = state();
    const run = displayRun();
    const quality = displayQualityResult();
    const historical = Boolean(st.historicalView);
    const authority = runAuthority(run);
    const canRun = st.configStatus === "published" && st.factorEntryStatus === "published" && !historical && st.runStatus !== "running" && st.context?.status !== "regression";
    const regression = Boolean(st.regressionRun || run?.scenarioContext?.status === "regression");
    const restored = st.context?.status === "restored" && !run;
    const returnAction = (regression || restored) && st.lastSuccessfulRun ? button("返回正式成功运行", "return-successful-run", { ghost: true, icon: "back" }) : "";
    const currentRunLabel = historical ? "历史运行" : regression ? "隔离演练运行" : authority.workProjection ? "当前工作投影" : restored ? "恢复副本" : "当前正式运行";
    const currentRunChip = run
      ? statusChip(authority.label, authority.formalEvidence && !historical ? "success" : historical ? "info" : "warning")
      : statusChip(restored ? "Restored · Pending" : "Pending", restored ? "warning" : "neutral");
    const rerunTitle = historical ? "历史运行只读" : regression ? "隔离演练运行" : restored ? "恢复副本等待显式评估" : st.runStatus === "running" ? "正在执行确定性评估" : "创建新的隔离运行";
    const rerunDescription = historical
      ? "当前查看保留原 scenarioRunId，不允许重评或产生副作用。"
      : regression
        ? "演练运行不提升正式成功指针；如需继续请先返回正式成功运行。"
        : restored
          ? `已从 ${esc(st.restoredFromCheckpoint || "Checkpoint")} 恢复配置与数据；历史结果未被改写为新运行结果。`
          : "重评不会覆盖旧轮次；成功后先形成工作投影，待 Owner 导出正式 C035 / Published 事实；失败仍保留上一正式成功运行。";
    return `${pageHeader("运行、重评与企业报告", "M06 · 统一场景工作台", "配置发布后可显式快速重评；每次重评形成新 scenarioRunId 和可刷新工作投影，待 Owner 导出后才成为下游可消费的正式证据。", `${returnAction}${button(st.runStatus === "running" ? "重评进行中" : "使用当前 Published 版本重跑", "quick-rerun", { primary: true, icon: "refresh", disabled: !canRun })}`)}
      <section class="run-control-grid"><article class="panel run-control"><div class="panel-heading"><div><span class="eyebrow">快速重评</span><h3>显式运行门</h3></div>${historical ? statusChip("历史只读", "info") : regression ? statusChip("隔离演练", "warning") : restored ? statusChip("恢复副本", "warning") : st.runStatus === "running" ? statusChip("运行中", "info") : statusChip(canRun ? "可运行" : "暂不可运行", canRun ? "success" : "warning")}</div><div class="run-gates"><div class="${displayModel() && (historical || st.configStatus === "published") ? "passed" : "blocked"}">${icon(displayModel() && (historical || st.configStatus === "published") ? "check" : "alert", "sm")}<span><strong>Published 模型</strong><small>${esc(displayModel()?.packageVersion || "—")}</small></span></div><div class="${displayInputSnapshot() && (historical || st.factorEntryStatus === "published") ? "passed" : "blocked"}">${icon(displayInputSnapshot() && (historical || st.factorEntryStatus === "published") ? "check" : "alert", "sm")}<span><strong>人工输入快照</strong><small>${esc(displayInputSnapshot()?.snapshotId || "未形成")}</small></span></div><div class="${quality.status === "passed" ? "passed" : "blocked"}">${icon(quality.status === "passed" ? "check" : "alert", "sm")}<span><strong>数据质量</strong><small>${esc(quality.qualityResultId || "历史未形成")}</small></span></div></div><div class="run-action-box"><span class="run-action-icon">${icon("refresh", "lg")}</span><div><strong>${rerunTitle}</strong><p>${rerunDescription}</p></div>${button("快速重跑", "quick-rerun", { primary: true, icon: "play", disabled: !canRun })}</div>${st.runError ? `<div class="validation-result danger">${icon("alert", "sm")}<div><strong>本次运行未成功切换</strong><p>${esc(st.runError)}</p></div></div>` : ""}</article><article class="panel current-run ${authority.workProjection ? "work-projection" : ""}"><div class="panel-heading"><div><span class="eyebrow">${currentRunLabel}</span><h3>${run ? esc(DATA.shortId(run.runId, 23, 8)) : restored ? esc(DATA.shortId(st.context.scenarioRunId, 23, 8)) : "尚未形成"}</h3></div>${currentRunChip}</div>${run ? `<dl class="run-facts"><div><dt>评估时间</dt><dd>${DATA.formatDateTime(run.evaluatedAt)}</dd></div><div><dt>评估时点</dt><dd>${esc(run.assessmentAt)}</dd></div><div><dt>模型版本</dt><dd>${esc(run.modelVersion)}</dd></div><div><dt>authorityMode</dt><dd>${esc(run.authorityMode || "pending")}</dd></div><div><dt>数据资产</dt><dd title="${attr(run.dataAssetId)}">${esc(DATA.shortId(run.dataAssetId, 19, 7))}</dd></div><div><dt>输入快照</dt><dd title="${attr(run.inputSnapshotId)}">${esc(DATA.shortId(run.inputSnapshotId, 19, 7))}</dd></div><div><dt>报告数量</dt><dd>${run.reportCount} 份${authority.canFormalReport ? "正式报告" : "预览"}</dd></div><div><dt>下游消费</dt><dd>${authority.canQuery ? "M03 / M04 可消费" : "阻断 · 待 Owner 导出"}</dd></div></dl>${runRiskSummary(run)}` : `<div class="empty-state compact">${icon("info", "sm")}<span>${restored ? "恢复操作只克隆版本化状态；请显式重评以形成新的 C035 结果和 21 份运行报告投影。" : "等待 M01 评分引擎返回完整 21 家结果。"}</span></div>`}</article></section>
      <section class="panel run-history-panel"><div class="panel-heading"><div><span class="eyebrow">运行历史</span><h3>场景轮次与上一成功保护</h3></div><small>最多展示当前浏览器投影内最近 20 次</small></div>${renderRunHistory()}</section>
      <section class="panel reports-panel"><div class="panel-heading"><div><span class="eyebrow">${authority.canFormalReport ? "企业正式报告" : "企业报告预览"}</span><h3>风险评分企业明细与报告穿透</h3></div><span class="panel-note">${displayReportCount()} / ${bundle().fixture.enterpriseCount} 份 · ${esc(authority.label)}</span></div>${reportCards()}</section>`;
  }

  function renderQueryAnswer(answer) {
    if (!answer) return `<div class="query-placeholder">${icon("message", "lg")}<strong>选择一个标准问题</strong><p>M03 只读取当前运行的 Published 风险事实，不自行重算评分。</p></div>`;
    const result = answer.result || {};
    const footer = `<footer>来源：C008 / T019 / C035 · ${esc(runLabel())}</footer>`;
    if (["risk-counts", "risk-tier-distribution"].includes(answer.type)) {
      const counts = answer.counts || result.counts || {};
      return `<div class="query-answer"><span class="answer-label">只读问数结果</span><h3>${esc(answer.title)}</h3><div class="answer-risk-grid">${["GREEN", "YELLOW", "RED", "BLACK"].map(function (key) { return `<div>${riskBadge(key, true)}<strong>${counts[key] || 0}</strong><span>家企业</span></div>`; }).join("")}</div>${result.averageFinalScore != null ? `<p class="answer-text">集团平均评分 ${DATA.formatScore(result.averageFinalScore)}，共 ${result.total || 0} 家企业。</p>` : ""}${footer}</div>`;
    }
    if (answer.type === "enterprise-list") {
      return `<div class="query-answer"><span class="answer-label">只读问数结果</span><h3>${esc(answer.title)}</h3>${renderRiskRows(answer.records || result.enterprises || [], { empty: "没有企业符合当前问题条件。" })}${footer}</div>`;
    }
    if (answer.type === "enterprise-detail") {
      return `<div class="query-answer"><span class="answer-label">企业详情 · 只读</span><h3>${esc(result.enterpriseName || "—")}</h3><div class="answer-risk-grid"><div>${riskBadge(result.riskTier, true)}<strong>${DATA.formatScore(result.finalScore)}</strong><span>综合评分</span></div><div><span>原始分</span><strong>${DATA.formatScore(result.rawScore)}</strong><span>调节 ${result.factorSum == null ? "—" : Number(result.factorSum).toFixed(2)}</span></div></div><button class="btn btn-primary btn-small" type="button" data-action="open-report" data-enterprise-id="${attr(result.enterpriseId)}">${icon("file", "sm")}查看企业报告</button>${footer}</div>`;
    }
    if (answer.type === "lowest-three-indicators") {
      return `<div class="query-answer"><span class="answer-label">最低三项 · 只读</span><h3>${esc(result.enterprise?.enterpriseName || answer.title)}</h3><div class="report-risk-cards">${(result.indicators || []).map(function (metric, index) { return `<article><span>0${index + 1}</span><div><strong>${esc(metric.name)}</strong><p>指标得分 ${DATA.formatScore(metric.score)}</p></div></article>`; }).join("")}</div>${footer}</div>`;
    }
    if (answer.type === "factor-default-and-not-applicable") {
      const rows = result.records || [];
      return `<div class="query-answer"><span class="answer-label">默认语义 · 只读</span><h3>${esc(answer.title)}</h3><p class="answer-text">涉及 ${result.enterpriseCount || rows.length} 家企业；DEFAULTED_ZERO ${result.counts?.DEFAULTED_ZERO || 0} 项，NOT_APPLICABLE ${result.counts?.NOT_APPLICABLE || 0} 项。</p><div class="decision-candidate-list">${rows.slice(0, 8).map(function (item) { return `<article class="decision-candidate"><div>${statusChip(item.factors?.[0]?.state || "—", item.factors?.[0]?.state === "NOT_APPLICABLE" ? "info" : "warning")}</div><div class="candidate-main"><strong>${esc(item.enterprise?.enterpriseName || "—")}</strong><small>${esc((item.factors || []).map(function (factor) { return factor.name; }).join("、"))}</small></div></article>`; }).join("")}</div>${footer}</div>`;
    }
    if (answer.type === "disposition-candidate-list") {
      const candidates = result.candidates || [];
      const canDecision = runAuthority().canDecision;
      return `<div class="query-answer"><span class="answer-label">分档预警 · 只读</span><h3>${esc(answer.title)}</h3><p class="answer-text">共 ${result.count || candidates.length} 家黄灯、红灯或黑灯企业；问数只展示 Published 预警，不会代替驾驶舱提交行动申请。</p><div class="decision-candidate-list">${candidates.slice(0, 8).map(function (candidate) { return `<article class="decision-candidate"><div>${riskBadge(candidate.enterprise?.riskTier, true)}</div><div class="candidate-main"><strong>${esc(candidate.enterprise?.enterpriseName || "—")}</strong><small>${esc(candidate.actionTypeId)} · ${canDecision ? "待从驾驶舱提交" : "当前只读"}</small></div><button class="btn btn-small btn-primary" type="button" data-action="open-decision" data-enterprise-id="${attr(candidate.enterprise?.enterpriseId || "")}" ${canDecision ? "" : `disabled title="${attr("历史只读或非正式运行不得提交行动申请")}"`}>${icon("target", "sm")}提交行动申请</button></article>`; }).join("")}</div>${footer}</div>`;
    }
    return `<div class="query-answer"><span class="answer-label">${answer.type === "empty" ? "运行门提示" : "Published 规则解释"}</span><h3>${esc(answer.title)}</h3><p class="answer-text">${esc(answer.body)}</p><footer>${answer.type === "empty" ? "未触发前端重算" : `模型版本：${esc(displayModel()?.packageVersion || "—")}`}</footer></div>`;
  }

  function actionTypeLabel(value) {
    return {
      S003_RISK_FOLLOW_UP: "风险跟踪",
      S003_SPECIAL_DISPOSAL: "专项处置",
      S003_EMERGENCY_RESPONSE: "紧急响应"
    }[value] || value;
  }

  function tierActionLabel(tierId) {
    return ({ YELLOW: "黄灯预警", RED: "红灯预警", BLACK: "黑灯预警" })[String(tierId || "").toUpperCase()] || "风险预警";
  }

  function candidateActionLabel(candidate) {
    return tierActionLabel(candidate?.riskTier || candidate?.trigger?.tierId);
  }

  function decisionCandidates() {
    if (!runAuthority().formalEvidence) return [];
    return STORE.listDecisionCandidates().sort(function (a, b) { return DATA.riskRank(a.riskTier) - DATA.riskRank(b.riskTier) || Number(a.finalScore) - Number(b.finalScore) || a.actionTypeId.localeCompare(b.actionTypeId); });
  }

  function renderDecisionCandidates() {
    const authority = runAuthority();
    if (!authority.formalEvidence) {
      return `<div class="authority-blocked-card">${icon("lock", "sm")}<div><strong>M04 处置候选已阻断</strong><p>${esc(authority.workProjection ? "当前为工作投影 / 待 Owner 导出；不得生成处置候选、Action Request 或负责人待办。" : authority.regression ? "隔离回归仅用于演练，不得形成处置候选或触发任何历史副作用。" : "尚无可供 M04 消费的正式 Published 事实。")}</p></div></div>`;
    }
    const candidates = decisionCandidates();
    if (!candidates.length) return `<div class="empty-state compact">${icon("shield", "sm")}<span>当前运行没有黄 / 红 / 黑亮灯预警候选。</span></div>`;
    const sideEffectsBlocked = !authority.canDecision;
    return `<div class="callout compact info decision-policy-callout">${icon("lightbulb", "sm")}<div><strong>风险行动候选按亮灯逐户纳入</strong><p>黄灯、红灯、黑灯各形成一条预警候选；绿灯不形成行动候选。重大因子只作为报告诊断证据，不单独生成行动。</p></div></div><div class="decision-candidate-list">${candidates.map(function (candidate) {
      const confirmed = confirmedDecisionForCandidate(candidate);
      const submitted = actionRequestForCandidate(candidate);
      const request = actionRequestRecord(submitted);
      const recipient = request?.decisionRecipient?.recipientName || request?.recipientName || null;
      const action = confirmed
        ? statusChip("已形成负责人待办", "success")
        : submitted
          ? `<div class="candidate-request-state">${statusChip("待接口人确认", "warning")}<small>${esc(recipient ? `已定向送达 ${recipient} 的决策中心` : "已定向送达对应成员单位接口人的决策中心")}</small><button class="btn btn-small btn-primary" type="button" data-action="open-submitted-action" data-candidate-id="${attr(candidate.candidateId)}" data-request-id="${attr(request?.actionRequestId || request?.requestId || request?.id || candidate.candidateId)}" ${sideEffectsBlocked ? "disabled" : ""}>${icon("check", "sm")}接口人确认并分办</button></div>`
          : `<button class="btn btn-small btn-primary" type="button" data-action="open-decision" data-candidate-id="${attr(candidate.candidateId)}" ${sideEffectsBlocked ? "disabled" : ""}>${icon("target", "sm")}提交行动申请</button>`;
      return `<article class="decision-candidate"><div>${riskBadge(candidate.riskTier, true)}<span class="candidate-type">${esc(candidateActionLabel(candidate))}</span></div><div class="candidate-main"><strong>${esc(candidate.enterpriseName)}</strong><small>${DATA.formatScore(candidate.finalScore)} 分 · 底层合同 ${esc(candidate.actionTypeId)}</small></div>${action}</article>`;
    }).join("")}</div>`;
  }

  function renderDecisionHistory() {
    const requests = displayActionRequests().filter(function (item) {
      const request = actionRequestRecord(item);
      const context = request?.scenarioIdentity || request?.scenarioContext;
      return context?.scenarioRunId === displayContext().scenarioRunId;
    });
    const decisions = displayDecisions().filter(function (item) { return item.scenarioRunId === displayContext().scenarioRunId; });
    if (!requests.length && !decisions.length) return `<div class="empty-state compact">${icon("clock", "sm")}<span>尚无当前运行的行动申请或负责人待办。</span></div>`;
    const confirmedKeys = new Set(decisions.map(function (item) { return item.idempotencyKey; }).filter(Boolean));
    const pendingRows = requests.filter(function (item) {
      const request = actionRequestRecord(item);
      return !confirmedKeys.has(request?.idempotencyKey) && !request?.todoId && !item?.todo;
    }).map(function (item) {
      const request = actionRequestRecord(item);
      const recipient = request?.decisionRecipient?.recipientName || request?.recipientName || "对应成员单位债务风险接口人";
      return `<article><span class="decision-icon pending">${icon("clock", "sm")}</span><div><strong>${esc(request.enterpriseName || request.subjectName)} · ${esc(actionTypeLabel(request.actionTypeId || request.actionType?.id))}</strong><small>${esc(request.actionRequestId || request.requestId || request.id)} · 收件人 ${esc(recipient)}</small></div>${statusChip("待接口人确认", "warning")}<button class="link-button" type="button" data-action="open-submitted-action" data-candidate-id="${attr(request.candidateId || request.sourceCandidateId || "")}" data-request-id="${attr(request.actionRequestId || request.requestId || request.id)}">接口人确认并分办 ${icon("chevronRight", "sm")}</button></article>`;
    });
    const confirmedRows = decisions.map(function (item) {
      return `<article><span class="decision-icon">${icon("check", "sm")}</span><div><strong>${esc(item.enterpriseName)} · ${esc(actionTypeLabel(item.actionTypeId))}</strong><small>${esc(item.actionRequestId)} · ${esc(item.todo?.todoId || item.todoId || "待办待接收")} · 负责人 ${esc(item.owner || item.todo?.owner || "待选择")}</small></div>${statusChip(item.todo?.status === "pending" ? "负责人待办待处理" : "接口人已确认", "success")}<button class="link-button" type="button" data-action="open-report" data-enterprise-id="${attr(item.enterpriseId)}">查看来源报告 ${icon("chevronRight", "sm")}</button></article>`;
    });
    return `<div class="decision-history">${pendingRows.concat(confirmedRows).join("")}</div>`;
  }

  function renderQueryDecision() {
    const st = state();
    const authority = runAuthority();
    const queryBlocked = !authority.canQuery;
    const gate = authority.formalEvidence
      ? `<div class="consumption-gate allowed">${icon(authority.historical ? "lock" : "check", "sm")}<div><strong>${esc(authority.label)}</strong><p>${esc(authority.historical ? "M03 可按 Checkpoint 锁定事实只读查询；历史行动申请、接口人确认和待办均保持禁用。" : "M03 可读取正式 Published 事实；驾驶舱提交行动申请后直达对应成员单位接口人，接口人确认并选择负责人后才形成待办。")}</p></div></div>`
      : `<div class="consumption-gate blocked">${icon("lock", "sm")}<div><strong>${esc(authority.label)}：M03 / M04 正式消费已阻断</strong><p>${esc(authority.description)}</p></div></div>`;
    return `${pageHeader("只读问数与通用决策入口", "M03 + M04 · 场景内兼容视图", "问数只消费 Published 风险事实；黄灯、红灯、黑灯均形成分档预警，由集团债务风险管理人员从驾驶舱提交给对应成员单位接口人。", `${button("查看行动申请与待办", "view-decision-todos", { primary: true, icon: "target" })}${button("查看快照", "view-checkpoints", { ghost: true, icon: "layers" })}`)}
      ${gate}<section class="query-decision-grid"><article class="panel query-panel ${queryBlocked ? "is-consumption-blocked" : ""}" id="m03-query"><div class="panel-heading"><div><span class="eyebrow">M03 · 智能问数</span><h3>标准快问</h3></div>${statusChip(queryBlocked ? "待正式 Published 事实" : "只读", queryBlocked ? "warning" : "info")}</div><div class="query-layout"><div class="query-list">${bundle().queryCatalog.queries.map(function (query) { return `<button class="query-option ${st.queryId === query.queryId && !queryBlocked ? "active" : ""}" type="button" data-action="run-query" data-query-id="${attr(query.queryId)}" ${queryBlocked ? `disabled title="${attr("工作投影或隔离演练不得作为 M03 Published 输入")}"` : ""}><span>${icon("message", "sm")}</span><div><strong>${esc(query.question)}</strong><small>${esc(query.queryId)} · ${esc(query.resultShape)}</small></div>${icon(queryBlocked ? "lock" : "chevronRight", "sm")}</button>`; }).join("")}</div><div class="query-result">${queryBlocked ? `<div class="query-placeholder authority-query-blocked">${icon("lock", "lg")}<strong>M03 查询已阻断</strong><p>${esc(authority.workProjection ? "工作投影仅供 M06 预览；待 Owner 导出正式 C035 / Published 事实后再查询。" : authority.regression ? "隔离回归不进入问数消费链。" : "当前尚无正式 Published 风险事实。")}</p></div>` : renderQueryAnswer(st.queryAnswer)}</div></div></article><article class="panel decision-panel ${authority.canDecision ? "" : "is-consumption-blocked"}" id="m04-decision"><div class="panel-heading"><div><span class="eyebrow">M04 · 通用决策</span><h3>成员单位接口人收件与分办</h3></div>${statusChip(authority.canDecision ? "逐户直达" : "正式入口已阻断", "warning")}</div><div class="callout compact warning">${icon("alert", "sm")}<div><strong>行动申请不经过集团管理员统一收件</strong><p>驾驶舱提交后直接进入对应成员单位债务风险接口人的决策中心；接口人核实并选择实际负责人后，才形成负责人待办。</p></div></div>${renderDecisionCandidates()}<div class="decision-boundary"><span>${icon("shield", "sm")}一期不建设多用户权限、多级审批或专属处置页；工作投影、历史查看、克隆恢复与隔离回归均禁止重放行动副作用。</span></div></article></section>
      <section class="panel" id="m04-todos"><div class="panel-heading"><div><span class="eyebrow">M04 · 行动申请与待办</span><h3>成员单位接口人处理队列</h3></div><small>正式状态以通用决策中心 M04 回执为准</small></div>${renderDecisionHistory()}</section>`;
  }

  function checkpointLabel(code) {
    return {
      CP01: ["初始配置完成", "锁定基线、场景身份与 M01—M06 初始合同"],
      CP02: ["数据接入完成", "锁定数据资产、人工输入、评估时点与质量结果"],
      CP03: ["Published 切换完成", "锁定模型包、权威指针与首轮评估结果"],
      CP04: ["问数联调完成", "锁定 M03 查询目录与 Published 事实消费证据"],
      CP05: ["决策链完成", "锁定处置候选、人工确认与通用待办交接"],
      CP06: ["报告 / 驾驶舱完成", "锁定 21 份报告、工作台与打印证据"],
      CP07: ["端到端联调完成", "锁定全链路版本、测试与证据包"],
      CP08: ["统一场景壳完成", "锁定 M01—M06 内部适配视图、身份带和连续操作证据"],
      CP09: ["运行编排完成", "锁定 C034 历史查看、克隆恢复、隔离回归与快速重评桥接"],
      CP10: ["基线模块装入完成", "锁定 v1.0.3 派生公共壳、六模块条件式适配与全量回归证据"],
      CP11: ["适配器隔离加固完成", "锁定 M03/M04 跨运行隔离测试与最终工作树回归证据"]
    }[code] || [code, "场景快照"];
  }

  function checkpointStatus(entry) {
    if (!entry.manifest) return { label: "待形成", tone: "neutral" };
    if (entry.integrity && !entry.integrity.exact) return { label: "证据只读", tone: "warning" };
    if (!entry.integrity) return { label: "校验待定", tone: "warning" };
    const readiness = entry.manifest.restoreReadiness?.status;
    return readiness === "verified" ? { label: "可恢复", tone: "success" } : { label: "已形成", tone: "warning" };
  }

  function renderCheckpointTimeline() {
    return `<div class="checkpoint-timeline">${bundle().checkpoints.map(function (entry) {
      const label = checkpointLabel(entry.code);
      const status = checkpointStatus(entry);
      const manifest = entry.manifest;
      if (!manifest) {
        return `<article class="checkpoint-row pending"><span class="checkpoint-index">${entry.code}</span><span class="checkpoint-line"></span><div class="checkpoint-main"><div class="checkpoint-title"><div><strong>${esc(label[0])}</strong><small>${esc(label[1])}</small></div>${statusChip(status.label, status.tone)}</div><div class="checkpoint-pending">${icon("clock", "sm")}待对应节点完成后，由平台公共层与 M01—M06 Owner 导出正式不可变清单。</div></div></article>`;
      }
      const integrity = entry.integrity;
      const restoreDisabled = !integrity?.restorable;
      const regressionDisabled = !integrity?.runnable;
      const issue = integrity?.issues?.[0]?.message || "锁定工件尚未通过精确校验";
      return `<article class="checkpoint-row available"><span class="checkpoint-index">${entry.code}</span><span class="checkpoint-line"></span><div class="checkpoint-main"><div class="checkpoint-title"><div><strong>${esc(label[0])}</strong><small>${esc(label[1])}</small></div>${statusChip(status.label, status.tone)}</div><dl><div><dt>Checkpoint ID</dt><dd title="${attr(manifest.checkpointId)}">${esc(DATA.shortId(manifest.checkpointId, 25, 8))}</dd></div><div><dt>来源运行</dt><dd title="${attr(manifest.sourceScenarioRunId)}">${esc(DATA.shortId(manifest.sourceScenarioRunId, 22, 7))}</dd></div><div><dt>形成时间</dt><dd>${DATA.formatDateTime(manifest.createdAt)}</dd></div><div><dt>恢复模式</dt><dd>${esc(integrity?.restoreMode || "evidence-only")}</dd></div></dl>${integrity?.exact ? "" : `<div class="checkpoint-pending">${icon("alert", "sm")} ${esc(issue)}；保留历史清单，只允许证据查看。</div>`}<div class="checkpoint-actions"><button type="button" class="btn btn-small btn-ghost" data-action="view-checkpoint" data-checkpoint-code="${entry.code}">${icon("file", "sm")}只读查看</button><button type="button" class="btn btn-small btn-ghost" data-action="restore-checkpoint" data-checkpoint-code="${entry.code}" ${restoreDisabled ? `disabled title="${attr(issue)}"` : ""}>${icon("copy", "sm")}克隆恢复</button><button type="button" class="btn btn-small btn-ghost" data-action="regress-checkpoint" data-checkpoint-code="${entry.code}" ${regressionDisabled ? `disabled title="${attr(integrity?.exact ? "该节点尚未形成 Published 模型、完整输入与 C035 结果" : issue)}"` : ""}>${icon("refresh", "sm")}隔离回归</button></div></div></article>`;
    }).join("")}</div>`;
  }

  function renderCheckpoints() {
    const st = state();
    const historical = st.historicalView;
    const context = displayContext();
    return `${pageHeader("场景快照与恢复", "C034 · 公共 Checkpoint 能力", "正式快照锁定基线、场景身份、模块版本、数据、Published 指针、结果、报告、决策、测试与证据；浏览器状态不是真源。", historical ? button("退出历史只读", "exit-historical", { primary: true, icon: "back" }) : "")}
      ${historical ? `<div class="historical-banner">${icon("lock", "sm")}<div><strong>${esc(historical.code)} 历史快照只读模式</strong><p>保留原 scenarioRunId ${esc(DATA.shortId(historical.context?.scenarioRunId || historical.checkpoint?.scenarioContext?.scenarioRunId))}；禁止编辑、重评和副作用重放。</p></div>${button("返回当前运行", "exit-historical", { ghost: true, icon: "back" })}</div>` : ""}
      <section class="checkpoint-layout"><article class="panel checkpoint-panel"><div class="panel-heading"><div><span class="eyebrow">CP01—CP23</span><h3>不可变节点</h3></div><span class="panel-note">${bundle().checkpoints.filter(function (item) { return item.manifest; }).length} / ${bundle().checkpoints.length} 已形成</span></div>${renderCheckpointTimeline()}</article><aside class="checkpoint-aside"><article class="panel context-card"><span class="context-card-icon">${icon("layers", "lg")}</span><span class="eyebrow">${historical ? "历史快照身份" : "当前场景身份"}</span><h3>${esc(context.scenarioId)} · ${esc(context.scenarioVersion)}</h3><code>${esc(context.scenarioRunId)}</code><dl><div><dt>父基线</dt><dd>${esc(bundle().manifest.baseline.baselineVersion)}</dd></div><div><dt>基线快照</dt><dd title="${attr(bundle().manifest.baseline.baselineSnapshotId)}">${esc(DATA.shortId(bundle().manifest.baseline.baselineSnapshotId, 19, 6))}</dd></div><div><dt>状态</dt><dd>${esc(context.status)}</dd></div><div><dt>命名空间</dt><dd>独立隔离</dd></div></dl></article><article class="panel snapshot-rules"><div class="panel-heading"><div><span class="eyebrow">恢复语义</span><h3>三种操作严格分离</h3></div></div><ul><li><strong>历史查看</strong><span>原 scenarioRunId，只读展示当时状态与证据。</span></li><li><strong>克隆恢复</strong><span>创建新 scenarioRunId，不覆盖历史。</span></li><li><strong>隔离回归</strong><span>演练模式，禁用外发与历史副作用重放。</span></li></ul></article><div class="callout compact info">${icon("info", "sm")}<div><strong>可丢弃投影提示</strong><p>${esc(st.projectionNotice)}</p></div></div></aside></section>`;
  }

  function metricValue(value) {
    if (value == null || value === "") return "—";
    const number = Number(value);
    if (!Number.isFinite(number)) return esc(value);
    if (Math.abs(number) >= 1000000) return esc(DATA.formatAmount(number, bundle().fixture.amountUnit));
    if (Math.abs(number) < 1 && number !== 0) return `${(number * 100).toFixed(2)}%`;
    return number.toLocaleString("zh-CN", { maximumFractionDigits: 4 });
  }

  function reportConclusion(record) {
    const meta = DATA.RISK_META[record.riskTier] || DATA.RISK_META.UNKNOWN;
    const authority = runAuthority();
    const critical = record.factors.filter(function (factor) { return ["重大诉讼", "当月资金余缺预警"].includes(factor.value); });
    const lead = authority.workProjection
      ? "当前快速重跑工作投影按 Published 模型包演算"
      : authority.regression
        ? "当前隔离回归按锁定模型包演算"
        : "经当前 Published 模型包评估";
    const previewNotice = authority.formalEvidence ? "" : " 本结论仅供 M06 预览，未形成 M03 / M04 可消费事实或处置指令。";
    if (record.riskTier === "GREEN") return `${lead}，${record.enterpriseName}综合得分为 ${DATA.formatScore(record.finalScore)} 分，风险等级为绿灯。企业债务风险总体可控，建议保持常态监测${critical.length ? "，并单独跟踪重大因子" : ""}。${previewNotice}`;
    if (record.riskTier === "YELLOW") return `${lead}，${record.enterpriseName}综合得分为 ${DATA.formatScore(record.finalScore)} 分，风险等级为黄灯。部分指标出现弱化信号，${authority.formalEvidence ? "应由集团债务风险管理人员从驾驶舱提交风险跟踪行动申请，直达本企业债务风险接口人核实分办" : "待 Owner 导出为正式证据后再进入行动申请"}。${previewNotice}`;
    if (record.riskTier === "RED") return `${lead}，${record.enterpriseName}综合得分为 ${DATA.formatScore(record.finalScore)} 分，风险等级为红灯。债务压力较为显著，${authority.formalEvidence ? "应从驾驶舱提交专项处置行动申请，由本企业债务风险接口人核实并选择实际负责人" : "待 Owner 导出为正式证据后再进入行动申请"}。${previewNotice}`;
    if (record.riskTier === "BLACK") return `${lead}，${record.enterpriseName}综合得分为 ${DATA.formatScore(record.finalScore)} 分，风险等级为黑灯。${authority.formalEvidence ? "应立即从驾驶舱提交紧急响应行动申请，直达本企业债务风险接口人核实分办" : "待 Owner 导出为正式证据后再进入行动申请"}。${previewNotice}`;
    return `${record.enterpriseName}当前尚未取得 M01 权威风险等级，报告仅展示已接入的数据身份，不形成业务结论。${meta.description}`;
  }

  function reportFactorRows(record) {
    return record.factors.map(function (factor) {
      const stateMeta = factor.state === "NOT_APPLICABLE" ? { label: "不适用", tone: "neutral" } : factor.state === "DEFAULTED_ZERO" ? { label: "缺失套 0 档", tone: "warning" } : { label: "显式取值", tone: "success" };
      return `<tr><td><strong>${esc(factor.name)}</strong></td><td>${factor.value == null ? "—" : esc(factor.value)}</td><td>${esc(factor.tierLabel || factor.tierId || "—")}</td><td class="num mono ${Number(factor.coefficient) < 0 ? "negative" : Number(factor.coefficient) > 0 ? "positive" : ""}">${factor.coefficient == null ? "由 M01 返回" : `${Number(factor.coefficient) > 0 ? "+" : ""}${Number(factor.coefficient).toFixed(2)}`}</td><td>${statusChip(stateMeta.label, stateMeta.tone)}</td></tr>`;
    }).join("");
  }

  function reportMetricRows(record) {
    if (!record.metrics.length) return `<tr><td colspan="8" class="empty-cell">M01 评估结果未返回指标评分明细。</td></tr>`;
    const sorted = record.metrics.slice().sort(function (a, b) { return Number(a.score) - Number(b.score); });
    const lowest = new Set(sorted.slice(0, 3).map(function (item) { return item.name; }));
    return record.metrics.map(function (metric, index) {
      return `<tr class="${lowest.has(metric.name) ? "low-metric-row" : ""}"><td class="row-number">${String(index + 1).padStart(2, "0")}</td><td><strong>${esc(metric.name)}</strong>${lowest.has(metric.name) ? '<small class="low-label">关键风险</small>' : ""}</td><td>${metricValue(metric.actualValue ?? metric.value)}</td><td class="num">${metric.grade == null ? "—" : esc(metric.grade)}</td><td class="num">${Number.isFinite(Number(metric.weightPercent ?? metric.weight)) ? `${Number(metric.weightPercent ?? metric.weight)}%` : "—"}</td><td class="num"><strong>${DATA.formatScore(metric.indicatorScore ?? metric.score)}</strong></td><td class="num">${DATA.formatScore(metric.weightedScore)}</td><td><small>${esc(metric.formula || metric.note || "—")}</small></td></tr>`;
    }).join("");
  }

  function reportIdentity(record) {
    const run = displayRun();
    const context = displayContext();
    const formal = formalReportFor(record.enterpriseId);
    const authority = runAuthority(run);
    const reportId = formal?.manifest?.reportId || `S003-RPT-${run?.runId || context.scenarioRunId}-${record.enterpriseId}`;
    const lifecycle = authority.workProjection ? "工作投影 / 待 Owner 导出（非正式报告）" : authority.regression ? "隔离回归报告预览（非正式）" : authority.historical ? "Checkpoint 历史证据只读" : authority.formalEvidence ? "正式不可变制品" : "即时报告预览";
    const artifactVersion = authority.canFormalReport ? formal?.manifest?.artifactVersion || "待装载" : "未导出";
    return `<dl class="report-identity"><div><dt>scenarioId</dt><dd>${esc(context.scenarioId)}</dd></div><div><dt>scenarioVersion</dt><dd>${esc(context.scenarioVersion)}</dd></div><div><dt>scenarioRunId</dt><dd>${esc(context.scenarioRunId)}</dd></div><div><dt>prototypeVersion</dt><dd>1.1.0</dd></div><div><dt>enterpriseId</dt><dd>${esc(record.enterpriseId)}</dd></div><div><dt>assessmentAt</dt><dd>${esc(record.assessmentAt)}</dd></div><div><dt>modelVersion</dt><dd>${esc(run?.modelVersion || displayModel()?.packageVersion || "—")}</dd></div><div><dt>authorityMode</dt><dd>${esc(run?.authorityMode || "pending")}</dd></div><div><dt>reportId</dt><dd>${esc(reportId)}</dd></div><div><dt>projectionOnly</dt><dd>${run?.projectionOnly === true ? "true" : "false"}</dd></div><div><dt>content / artifact</dt><dd>${esc(formal?.content?.contentVersion || formal?.manifest?.contentVersion || "预览")} / ${esc(artifactVersion)}</dd></div><div><dt>生命周期</dt><dd>${esc(lifecycle)}</dd></div></dl>`;
  }

  function formalReportFor(enterpriseId) {
    const st = state();
    const run = displayRun();
    const runId = run?.runId;
    const runtimeReport = run?.reports?.find(function (item) {
      return item.enterprise?.enterpriseId === enterpriseId
        || item.enterpriseId === enterpriseId
        || item.reportId === `S003-RPT-${runId}-${enterpriseId}`;
    });
    if (runtimeReport) {
      return {
        manifest: runtimeReport,
        content: runtimeReport,
        artifact: runtimeReport.artifactHtml ? { html: runtimeReport.artifactHtml, artifactSha256: runtimeReport.artifactSha256 } : null,
        projectionOnly: Boolean(runtimeReport.projectionOnly)
      };
    }
    if (st.historicalView) {
      const projection = st.historicalView.projection;
      const manifest = projection?.reportManifest?.reports?.find(function (item) {
        return item.enterpriseId === enterpriseId && item.scenarioIdentity?.scenarioRunId === runId;
      });
      if (!manifest) return null;
      const content = projection?.reportContents?.reports?.find(function (item) { return item.reportId === manifest.reportId; });
      const artifact = projection?.reportArtifacts?.artifacts?.find(function (item) { return item.reportId === manifest.reportId; });
      return { manifest, content, artifact, projectionOnly: false };
    }
    const manifest = bundle()?.reportManifest?.reports?.find(function (item) {
      return item.enterpriseId === enterpriseId && item.scenarioIdentity?.scenarioRunId === runId;
    });
    if (!manifest) return null;
    const content = bundle()?.reportContents?.reports?.find(function (item) { return item.reportId === manifest.reportId; });
    const artifact = bundle()?.reportArtifacts?.artifacts?.find(function (item) { return item.reportId === manifest.reportId; });
    return { manifest, content, artifact, projectionOnly: false };
  }

  function renderReport() {
    const record = selectedRecord();
    const enterprise = selectedEnterprise();
    const context = displayContext();
    const authority = runAuthority();
    if (!record) {
      return `${pageHeader("企业债务风险诊断报告", "M06 · 报告穿透", "报告只能由成功运行结果生成，不在页面端补算风险分。", button("返回企业明细", "view-enterprises", { ghost: true, icon: "back" }))}<div class="empty-state report-empty">${icon("file", "lg")}<strong>${esc(enterprise?.name || "企业")} 尚无可用报告</strong><span>请先完成 Published 模型与输入快照，并取得 M01 全量成功评估结果。</span>${button("前往运行与报告", "view-runs", { primary: true, icon: "refresh" })}</div>`;
    }
    const meta = DATA.RISK_META[record.riskTier] || DATA.RISK_META.UNKNOWN;
    const candidate = authority.formalEvidence ? STORE.candidateFor(record.enterpriseId) : null;
    const decision = candidate ? confirmedDecisionForCandidate(candidate) : null;
    const submitted = candidate ? actionRequestForCandidate(candidate) : null;
    const submittedRequest = actionRequestRecord(submitted);
    const formal = formalReportFor(record.enterpriseId);
    if (state().historicalView && !formal) {
      return `${pageHeader("企业债务风险诊断报告", "M06 · 历史报告穿透", "历史视图只能读取该 Checkpoint 自身锁定的报告，不得跨越到后续 CP06 报告资源。", button("返回企业明细", "view-enterprises", { ghost: true, icon: "back" }))}<div class="empty-state report-empty">${icon("lock", "lg")}<strong>${esc(state().historicalView.code)} 未锁定该企业报告</strong><span>该节点仅保留当时已形成的模块状态；请查看锁定报告的 CP06 及后续 Checkpoint，或退出历史只读模式。</span>${button("查看快照目录", "view-checkpoints", { primary: true, icon: "layers" })}</div>`;
    }
    const reportContent = formal?.content || {};
    const lowest = record.lowestMetrics || [];
    const formalActionsAllowed = Boolean(authority.canFormalReport && formal && formal.projectionOnly !== true);
    const artifactButton = formalActionsAllowed && formal?.artifact
      ? `<button class="btn btn-ghost" type="button" data-action="open-formal-report">${icon("external", "sm")}<span>打开正式制品</span></button>`
      : `<button class="btn btn-ghost" type="button" disabled title="${attr(authority.workProjection ? "工作投影未形成正式不可变制品" : "当前报告未装载正式制品")}">${icon("lock", "sm")}<span>正式制品${authority.workProjection ? "（待导出）" : ""}</span></button>`;
    const deepLinkButton = `<button class="btn btn-ghost" type="button" data-action="copy-report-link" ${authority.canFormalReport ? "" : `disabled title="${attr("工作投影或隔离演练不生成正式报告深链")}"`}>${icon("copy", "sm")}<span>${authority.historical ? "复制历史只读链接" : "复制正式深链"}</span></button>`;
    const printButton = button(authority.canFormalReport ? "打印 / 导出 PDF" : "正式导出（待 Owner）", "print-now", { primary: true, icon: authority.canFormalReport ? "print" : "lock", disabled: !authority.canFormalReport });
    const disposition = !authority.formalEvidence
      ? `<div class="authority-blocked-card">${icon("lock", "sm")}<div><strong>行动链未开放</strong><p>${esc(authority.workProjection ? "本页为工作投影报告预览；待 Owner 导出正式 C035 / Published 事实后，才能从驾驶舱提交行动申请。" : "隔离演练报告不得生成行动申请或负责人待办。")}</p></div></div>`
      : candidate
        ? `<div class="report-action-card"><span class="report-action-icon">${icon("target", "lg")}</span><div><strong>${esc(candidateActionLabel(candidate))}</strong><p>底层合同 ${esc(candidate.actionTypeId)} · ${esc(candidate.riskTierName || meta.name)}企业按亮灯形成预警；报告不会自动创建行动申请或待办。</p></div>${decision ? statusChip("已形成负责人待办", "success") : submitted ? `<div class="candidate-request-state">${statusChip("待接口人确认", "warning")}<small>已送达 ${esc(submittedRequest?.decisionRecipient?.recipientName || "对应成员单位债务风险接口人")}</small><button class="btn btn-primary" type="button" data-action="view-decision">${icon("external", "sm")}到决策中心查看</button></div>` : `<button class="btn btn-primary" type="button" data-action="open-decision" data-candidate-id="${attr(candidate.candidateId)}" ${authority.canDecision ? "" : `disabled title="${attr("历史证据只读，不得提交行动申请")}"`}>${icon("target", "sm")}提交行动申请</button>`}</div>`
        : `<div class="callout compact success">${icon("check", "sm")}<div><strong>当前未生成处置候选</strong><p>仍应按集团债务风险管理要求保持常态监测。</p></div></div>`;
    return `<div class="report-toolbar">${button("返回企业明细", "view-enterprises", { ghost: true, icon: "back" })}<div>${artifactButton}${deepLinkButton}${printButton}</div></div><div class="report-mode-banner ${attr(authority.mode)}">${icon(authority.formalEvidence ? "check" : "alert", "sm")}<div><strong>${esc(authority.label)}</strong><span>${esc(authority.formalEvidence ? "报告内容与当前运行身份一致；正式深链、制品和导出按锁定证据提供。" : "当前页面仅供预览；正式深链、不可变制品、PDF 导出与 M03 / M04 消费均保持禁用。")}</span></div></div><article class="report-page ${meta.className} ${authority.formalEvidence ? "formal-evidence" : "report-preview"}">
      <header class="report-header"><div class="report-brand"><span class="report-logo">OFW</span><div><strong>智财问策 · Ontology Financial World</strong><small>S003 债务风险监测</small></div></div><div class="report-document-meta"><span>${authority.formalEvidence ? "企业债务风险诊断报告" : "企业债务风险诊断报告 · 预览"}</span><strong>${esc(record.assessmentAt)}</strong><small>内容版本 ${esc(reportContent.contentVersion || "1.0.0")} · ${esc(authority.label)}</small></div></header>
      <section class="report-title"><div><span>${esc(record.category)}</span><h1>${esc(record.enterpriseName)}</h1><p>${esc(record.enterpriseId)} · 币种 ${esc(bundle().fixture.currency)} · 金额单位 ${esc(bundle().fixture.amountUnit)}</p></div>${riskBadge(record.riskTier, false)}</section>
      <section class="report-score-band"><div class="report-score-main"><span>调整后综合得分</span><strong>${DATA.formatScore(record.finalScore)}</strong><small>/ 100</small></div><div class="report-score-breakdown"><div><span>原始得分</span><strong>${record.rawScore == null ? "—" : DATA.formatScore(record.rawScore)}</strong></div><div><span>调节系数合计</span><strong>${record.factorSum == null ? "—" : `${Number(record.factorSum) > 0 ? "+" : ""}${Number(record.factorSum).toFixed(2)}`}</strong></div><div><span>综合调整系数</span><strong>${record.compositeAdjustment == null ? "—" : Number(record.compositeAdjustment).toFixed(2)}</strong></div><div><span>风险等级</span><strong>${esc(meta.name)}</strong></div></div></section>
      <section class="report-section conclusion"><div class="report-section-number">01</div><div><span class="eyebrow">总体判断</span><h2>总体风险评分与结论</h2><p>${esc(reportConclusion(record))}</p><div class="risk-basis"><strong>${icon("shield", "sm")}分档依据</strong><span>${esc(meta.description)}；阈值来源于 Published 模型包 ${esc(displayModel()?.packageVersion || "—")}。</span></div></div></section>
      <section class="report-section"><div class="report-section-number">02</div><div class="report-section-body"><span class="eyebrow">业务调节</span><h2>调节因子明细</h2><div class="data-table-wrap report-table"><table class="data-table"><thead><tr><th>调节因子</th><th>企业取值</th><th>分档</th><th class="num">系数</th><th>语义状态</th></tr></thead><tbody>${reportFactorRows(record)}</tbody></table></div></div></section>
      <section class="report-section"><div class="report-section-number">03</div><div class="report-section-body"><span class="eyebrow">财务评分</span><h2>15 项财务指标评分明细</h2><div class="data-table-wrap report-table"><table class="data-table"><thead><tr><th>#</th><th>指标</th><th>实际值</th><th class="num">等级</th><th class="num">权重</th><th class="num">指标得分</th><th class="num">加权得分</th><th>公式 / 备注</th></tr></thead><tbody>${reportMetricRows(record)}</tbody></table></div></div></section>
      <section class="report-section"><div class="report-section-number">04</div><div class="report-section-body"><span class="eyebrow">重点风险</span><h2>关键风险指标与证据</h2>${lowest.length ? `<div class="report-risk-cards">${lowest.slice(0, 3).map(function (metric, index) { return `<article><span>0${index + 1}</span><div><strong>${esc(metric.name || metric.metricName || "风险指标")}</strong><p>实际值 ${metricValue(metric.actualValue ?? metric.value)} · 指标得分 ${DATA.formatScore(metric.indicatorScore ?? metric.score)} · 加权 ${DATA.formatScore(metric.weightedScore)}${metric.note ? ` · ${esc(metric.note)}` : ""}</p>${metric.evidencePointer ? `<small>${esc(metric.evidencePointer)}</small>` : ""}</div></article>`; }).join("")}</div>` : `<div class="empty-state compact">${icon("info", "sm")}<span>M01 尚未返回最低三项指标明细。</span></div>`}<div class="evidence-row"><div><span>数据资产</span><strong>${esc(displayRun()?.dataAssetId || "—")}</strong></div><div><span>人工输入</span><strong>${esc(displayRun()?.inputSnapshotId || "—")}</strong></div><div><span>质量结果</span><strong>${esc(displayQualityResult()?.qualityResultId || "—")}</strong></div></div>${(reportContent.ruleExplanations || record.ruleExplanations || []).length ? `<div class="rule-explanations"><strong>Published 规则解释</strong><ul>${(reportContent.ruleExplanations || record.ruleExplanations || []).map(function (rule) { return `<li><b>${esc(rule.title || rule.ruleId)}</b><span>${esc(rule.statement || rule.description || "—")}</span>${rule.applied != null ? statusChip(rule.applied ? "本轮适用" : "本轮未触发", rule.applied ? "success" : "neutral") : ""}</li>`; }).join("")}</ul></div>` : ""}</div></section>
      <section class="report-section"><div class="report-section-number">05</div><div class="report-section-body"><span class="eyebrow">风险行动</span><h2>分档预警、行动申请与成员单位分办状态</h2>${disposition}</div></section>
      <section class="report-section identity-section"><div class="report-section-number">06</div><div class="report-section-body"><span class="eyebrow">版本与追溯</span><h2>报告身份、来源和默认语义</h2>${reportIdentity(record)}<div class="default-semantics"><span><b>HISTORY_INSUFFICIENT_DEFAULT_A</b>盈利历史不足按 A（100 分）</span><span><b>DEFAULTED_ZERO</b>适用但缺失因子按 0 档</span><span><b>NOT_APPLICABLE</b>业务不适用，不等同于缺失</span><span><b>UNDER_CONSTRUCTION_60</b>在建企业原始分固定为 60</span></div></div></section>
      <footer class="report-footer"><span>${authority.formalEvidence ? "本报告由 S003 场景工作台基于 M01 C035 权威评估结果生成。" : "工作投影报告预览 · 待 Owner 导出正式 C035 / Published 事实后方可正式消费与归档。"}</span><span>${esc(context.scenarioRunId)}</span></footer>
    </article>`;
  }

  function renderCurrentView() {
    const view = state().currentView;
    if (view === "platform-home") return renderPlatformHome();
    if (view === "module-M02") return renderModuleFrame("M02");
    if (view === "module-M01") return renderModuleFrame("M01");
    if (view === "module-M03") return renderModuleFrame("M03");
    if (view === "module-M04") return renderModuleFrame("M04");
    if (view === "module-M05") return renderModuleFrame("M05");
    if (view === "module-M06") return renderModuleFrame("M06");
    if (view === "data-quality") return renderDataQuality();
    if (view === "enterprises") return renderEnterprises();
    if (view === "factor-entry") return renderFactorEntry();
    if (view === "configuration") return renderConfiguration();
    if (view === "runs") return renderRuns();
    if (view === "query-decision") return renderQueryDecision();
    if (view === "checkpoints") return renderCheckpoints();
    if (view === "agent-boundary") return renderAgentBoundary();
    if (view === "report") return renderReport();
    return renderOverview();
  }

  function pendingActionRequest() {
    const pending = state().pendingDecision;
    if (!pending) return null;
    const direct = actionRequestRecord(pending);
    const status = String(direct?.status || pending?.stage || pending?.requestStatus || "").toLowerCase();
    const submitted = Boolean(
      pending?.isSubmittedActionRequest
      || pending?.actionRequestStage === "submitted"
      || pending?.decisionStage === "submitted"
      || status.includes("pending-member-unit")
      || status.includes("awaiting")
      || (direct?.actionRequestId && direct?.decisionRecipient && direct?.owner == null && direct?.todoId == null)
    );
    return submitted ? direct : null;
  }

  function invokeStoreMethod(names, payload) {
    const method = names.find(function (name) { return typeof STORE[name] === "function"; });
    if (!method) throw new Error(`当前场景运行服务未提供${names[0]}操作。`);
    return STORE[method](payload);
  }

  function renderModal() {
    const pending = state().pendingDecision;
    if (!pending) {
      modalRoot.innerHTML = "";
      document.body.classList.remove("modal-open");
      return;
    }
    const canConfirm = runAuthority().canDecision;
    const submittedRequest = pendingActionRequest();
    const isSubmitted = Boolean(submittedRequest);
    const recipient = submittedRequest?.decisionRecipient?.recipientName
      || submittedRequest?.recipientName
      || pending?.decisionRecipient?.recipientName
      || "对应成员单位债务风险接口人";
    const recommendedOwner = submittedRequest?.recommendedTaskOwner
      || submittedRequest?.recommendedTaskOwnerName
      || pending?.recommendedTaskOwner
      || "";
    const defaultOwner = isSubmitted ? recommendedOwner : "";
    const title = isSubmitted ? "接口人确认并分办行动申请" : "提交风险行动申请";
    const eyebrow = isSubmitted ? "通用决策中心 · 成员单位收件" : "通用 Action Request · 驾驶舱提交";
    const confirmLabel = isSubmitted ? "确认并形成负责人待办" : "提交行动申请";
    const checkLabel = isSubmitted ? "我已核实企业、风险等级、行动类型与行动依据" : "我已核对企业、风险等级、行动类型与行动依据";
    const helper = isSubmitted
      ? `当前收件人：${recipient}。接口人确认并选择负责人后，才会形成负责人待办。`
      : `提交后将直接送达${recipient}的决策中心；本步骤不设置负责人，也不会创建待办。`;
    document.body.classList.add("modal-open");
    modalRoot.innerHTML = `<div class="modal-backdrop" data-action="close-decision"><section class="decision-modal" role="dialog" aria-modal="true" aria-labelledby="decision-modal-title" onclick="event.stopPropagation()"><header><div><span class="eyebrow">${esc(eyebrow)}</span><h2 id="decision-modal-title">${esc(title)}</h2></div><button type="button" class="modal-close" data-action="close-decision" aria-label="关闭">${icon("close")}</button></header><div class="modal-body"><div class="decision-summary"><span class="decision-summary-icon">${icon("target", "lg")}</span><div><strong>${esc(pending.enterpriseName || pending.subjectName)}</strong><p>${riskBadge(pending.riskTier, true)}<b>${DATA.formatScore(pending.finalScore)} 分</b></p></div></div><dl class="modal-facts"><div><dt>Action Type</dt><dd>${esc(pending.actionTypeId || pending.actionType?.id)}</dd></div><div><dt>行动类型</dt><dd>${esc(actionTypeLabel(pending.actionTypeId || pending.actionType?.id))}</dd></div><div><dt>接收接口人</dt><dd>${esc(recipient)}</dd></div><div><dt>来源运行</dt><dd title="${attr(pending.scenarioRunId || pending.scenarioIdentity?.scenarioRunId)}">${esc(DATA.shortId(pending.scenarioRunId || pending.scenarioIdentity?.scenarioRunId, 23, 8))}</dd></div><div><dt>评估时点</dt><dd>${esc(pending.assessmentAt || pending.metric?.evaluatedAt)}</dd></div></dl><div class="callout compact info">${icon("info", "sm")}<div><strong>${isSubmitted ? "当前处于成员单位确认阶段" : "当前处于驾驶舱提交阶段"}</strong><p>${esc(helper)}</p></div></div>${isSubmitted ? `<label class="form-field"><span>实际负责人</span><input id="decision-owner" type="text" value="${attr(defaultOwner)}" placeholder="由成员单位接口人选择本单位负责人" ${canConfirm ? "" : "disabled"}/></label>` : ""}<label class="form-field"><span>${isSubmitted ? "接口人确认说明（可选）" : "提交说明（可选）"}</span><textarea id="decision-note" rows="3" placeholder="补充风险依据、处置重点或交接说明" ${canConfirm ? "" : "disabled"}></textarea></label><label class="confirm-check"><input id="decision-confirmed" type="checkbox" ${canConfirm ? "" : "disabled"}/><span><strong>${esc(checkLabel)}</strong><small>${canConfirm ? (isSubmitted ? "确认后形成对应成员单位负责人的待办，不启动多级审批或集团统一分办。" : "提交后只形成送达对应成员单位接口人的行动申请，不设置负责人、不创建待办。") : "当前运行不是可消费的正式 Published 证据，提交与分办已禁用。"}</small></span></label><div class="callout compact warning">${icon("alert", "sm")}<div><strong>${isSubmitted ? "接口人确认门" : "驾驶舱提交门"}</strong><p>${canConfirm ? (isSubmitted ? "成员单位接口人确认并选择负责人后，沿用通用决策中心框架形成负责人待办。" : "集团债务风险管理人员显式提交后，行动申请直达对应成员单位债务风险接口人。") : "工作投影、历史只读或隔离演练均不得创建行动申请、通知或负责人待办。"}</p></div></div></div><footer><button type="button" class="btn btn-ghost" data-action="close-decision">取消</button><button type="button" class="btn btn-primary" data-action="confirm-decision" ${canConfirm ? "" : `disabled title="${attr("仅正式 Published 证据可进行当前操作")}"`}>${icon(isSubmitted ? "check" : "target", "sm")}${esc(confirmLabel)}</button></footer></section></div>`;
  }

  function render() {
    if (!state().ready) {
      app.innerHTML = renderBoot();
      renderModal();
      return;
    }
    ensureModuleFrameCacheContext();
    cacheCurrentModuleFrame();
    const active = document.activeElement;
    const activeFilter = active?.dataset?.filter;
    const selectionStart = activeFilter && typeof active.selectionStart === "number" ? active.selectionStart : null;
    app.innerHTML = renderShell(renderCurrentView());
    renderModal();
    let frame = app.querySelector("#module-frame");
    if (frame) {
      renderedFrameModuleId = frame.dataset.moduleId || null;
      const module = DATA.MODULES.find(function (item) { return item.id === renderedFrameModuleId; });
      const cached = moduleFrameCache.get(renderedFrameModuleId);
      if (cached?.frame && cached.frame !== frame) {
        frame.replaceWith(cached.frame);
        frame = cached.frame;
        const stage = frame.closest(".module-frame-stage");
        if (cached.loaded) stage?.classList.add("is-loaded");
        if (cached.fallback) stage?.classList.add("is-fallback");
      } else {
        moduleFrameCache.set(renderedFrameModuleId, { frame, loaded: false, fallback: false });
      }
      frame.addEventListener("load", function () { adaptModuleFrame(frame, module); }, { once: true });
      frame.addEventListener("error", function () {
        frame.dataset.frameState = "fallback";
        frame.closest(".module-frame-stage")?.classList.add("is-fallback");
      }, { once: true });
      if (frame.contentDocument?.readyState === "complete") adaptModuleFrame(frame, module);
    } else {
      renderedFrameModuleId = null;
    }
    if (activeFilter) {
      const next = app.querySelector(`[data-filter="${CSS.escape(activeFilter)}"]`);
      if (next) {
        next.focus({ preventScroll: true });
        if (selectionStart != null && typeof next.setSelectionRange === "function") next.setSelectionRange(selectionStart, selectionStart);
      }
    }
  }

  function toast(message, tone) {
    const item = document.createElement("div");
    item.className = `toast ${tone || "info"}`;
    item.innerHTML = `${icon(tone === "danger" ? "alert" : tone === "success" ? "check" : "info", "sm")}<span>${esc(message)}</span>`;
    toastRegion.appendChild(item);
    window.setTimeout(function () { item.classList.add("leaving"); }, 3200);
    window.setTimeout(function () { item.remove(); }, 3600);
  }

  function setHash(view, enterpriseId, replace, anchor) {
    const url = new URL(window.location.href);
    url.hash = view === "report" ? `#report/${encodeURIComponent(enterpriseId)}` : `#${view}${anchor ? `/${anchor}` : ""}`;
    ["scenarioId", "scenarioVersion", "scenarioRunId", "prototypeVersion", "enterpriseId", "reportId", "checkpoint"].forEach(function (key) { url.searchParams.delete(key); });
    const context = displayContext();
    const run = displayRun();
    if (context?.scenarioId) url.searchParams.set("scenarioId", context.scenarioId);
    if (context?.scenarioVersion) url.searchParams.set("scenarioVersion", context.scenarioVersion);
    url.searchParams.set("prototypeVersion", "1.1.0");
    if (state().historicalView) {
      url.searchParams.set("checkpoint", state().historicalView.code);
    } else if (run?.runId || context?.scenarioRunId) {
      url.searchParams.set("scenarioRunId", run?.runId || context.scenarioRunId);
    }
    if (view === "report") {
      url.searchParams.set("enterpriseId", enterpriseId);
      if (!state().historicalView && isPublishedEvidenceRun(run)) {
        const report = formalReportFor(enterpriseId);
        if (report?.manifest?.reportId) url.searchParams.set("reportId", report.manifest.reportId);
      }
    }
    if (replace) history.replaceState({ s003: true }, "", url.href);
    else history.pushState({ s003: true }, "", url.href);
  }

  function navigate(view, enterpriseId, options) {
    const config = options || {};
    captureFramePosition();
    STORE.setView(view, enterpriseId, config.moduleId, config.anchor);
    setHash(view, enterpriseId, config.replace, config.anchor);
    window.requestAnimationFrame(function () {
      const target = config.anchor ? document.getElementById(config.anchor) : null;
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      else window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  async function quickRerun() {
    try {
      const run = await STORE.quickRerun();
      if (run) {
        toast(`重评完成：${DATA.shortId(run.runId)} · 已形成工作投影 / 待 Owner 导出。`, "info");
        navigate("runs", null, { replace: true });
      } else {
        toast(state().runError || "本次重评未成功，已保留上一成功运行。", "danger");
      }
    } catch (error) {
      toast(error.message || String(error), "danger");
    }
  }

  function openReport(enterpriseId) {
    if (!enterpriseId) return;
    STORE.selectEnterprise(enterpriseId);
    navigate("report", enterpriseId);
  }

  async function copyReportLink() {
    const id = state().selectedEnterpriseId;
    if (state().historicalView) {
      const url = new URL(window.location.href);
      url.hash = `report/${encodeURIComponent(id)}`;
      ["scenarioRunId", "reportId"].forEach(function (key) { url.searchParams.delete(key); });
      url.searchParams.set("scenarioId", displayContext().scenarioId);
      url.searchParams.set("scenarioVersion", displayContext().scenarioVersion);
      url.searchParams.set("prototypeVersion", "1.1.0");
      url.searchParams.set("checkpoint", state().historicalView.code);
      url.searchParams.set("enterpriseId", id);
      try {
        await navigator.clipboard.writeText(url.href);
        toast("历史报告只读链接已复制；刷新后仍按 Checkpoint 还原。", "success");
      } catch (_) {
        toast(url.href, "info");
      }
      return;
    }
    if (!runAuthority().canFormalReport) {
      toast("工作投影或隔离演练不生成正式报告深链；请等待 Owner 导出正式 Published 证据。", "danger");
      return;
    }
    const formal = formalReportFor(id);
    if (formal?.manifest?.deepLink?.href) {
      const url = new URL(formal.manifest.deepLink.href, window.location.href);
      try {
        await navigator.clipboard.writeText(url.href);
        toast("正式报告深链已复制；已锁定 scenarioRunId 与 reportId。", "success");
      } catch (_) {
        toast(url.href, "info");
      }
      return;
    }
    const url = new URL(window.location.href);
    url.hash = `report/${encodeURIComponent(id)}`;
    const context = displayContext();
    const run = displayRun();
    url.searchParams.set("scenarioId", context.scenarioId);
    url.searchParams.set("scenarioVersion", context.scenarioVersion);
    url.searchParams.set("scenarioRunId", run?.runId || context.scenarioRunId);
    url.searchParams.set("prototypeVersion", "1.1.0");
    url.searchParams.set("enterpriseId", id);
    url.searchParams.set("reportId", `S003-RPT-${run?.runId || context.scenarioRunId}-${id}`);
    try {
      await navigator.clipboard.writeText(url.href);
      toast("报告深链已复制；链接携带当前 scenarioRunId。", "success");
    } catch (_) {
      toast(url.href, "info");
    }
  }

  function openFormalReport() {
    if (!isPublishedEvidenceRun(displayRun())) return toast("当前为工作投影或隔离演练，仅可在工作台预览，不能打开正式制品。", "danger");
    const formal = formalReportFor(state().selectedEnterpriseId);
    if (!formal?.artifact?.html || formal.projectionOnly) return toast("当前运行尚未形成正式不可变报告制品。", "danger");
    const url = URL.createObjectURL(new Blob([formal.artifact.html], { type: "text/html;charset=utf-8" }));
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    if (!opened) toast("浏览器阻止了新窗口，请允许弹窗后重试。", "danger");
  }

  function printReport() {
    if (!runAuthority().canFormalReport) return toast("当前报告仅为工作投影或隔离演练预览；正式打印与 PDF 导出须等待 Owner 导出。", "danger");
    if (state().currentView !== "report") {
      const id = state().selectedEnterpriseId || records()[0]?.enterpriseId;
      if (!id) return toast("尚无可打印的企业报告。", "danger");
      openReport(id);
      window.setTimeout(function () { window.print(); }, 180);
      return;
    }
    window.print();
  }

  async function handleAction(action, target) {
    if (action === "toggle-nav") return STORE.toggleNav();
    if (action === "toggle-mobile-nav") return STORE.toggleMobileNav();
    if (action === "go-back") {
      if (window.history.length > 1) return window.history.back();
      return navigate("platform-home", null, { replace: true });
    }
    if (action === "view-platform-home") return navigate("platform-home", null, { replace: false });
    if (action === "open-module-adapter") {
      const moduleId = target?.dataset?.baselineModuleId;
      const module = DATA.MODULE_SOURCE_BY_ID?.[moduleId] || DATA.MODULES.find(function (item) { return item.id === moduleId; });
      if (!module?.frameView) return toast("当前模块未登记 v1.0.3 基线适配入口。", "danger");
      return navigate(module.frameView, null, { moduleId: module.id, replace: false });
    }
    if (action === "view-data-quality") return navigate(moduleFrameView("M02"), null, { moduleId: "M02" });
    if (action === "view-configuration") return navigate(moduleFrameView("M01"), null, { moduleId: "M01" });
    if (action === "view-query") return navigate(moduleFrameView("M03"), null, { moduleId: "M03" });
    if (action === "view-decision") return navigate(moduleFrameView("M04"), null, { moduleId: "M04" });
    if (action === "view-agent-boundary") return navigate(moduleFrameView("M05"), null, { moduleId: "M05" });
    if (action === "view-report-center") return navigate(moduleFrameView("M06"), null, { moduleId: "M06" });
    if (action === "view-overview") return navigate("overview", null, { moduleId: "M06" });
    if (action === "view-enterprises") return navigate("enterprises");
    if (action === "view-sector-enterprises") {
      STORE.setFilter("enterpriseSectorFilter", target.dataset.sector || "ALL");
      STORE.setFilter("enterpriseRiskFilter", "ALL");
      STORE.setFilter("enterpriseSearch", "");
      return navigate("enterprises");
    }
    if (action === "view-factor-entry") return navigate("factor-entry");
    if (action === "view-runs") return navigate("runs");
    if (action === "view-checkpoints") return navigate("checkpoints");
    // S003 场景适配视图动作：M06 仪表盘扩展内的业务工作区，区别于
    // open-module-adapter 打开的 v1.0.3 基线模块页面。
    if (action === "view-scene-data") return navigate("data-quality", null, { moduleId: "M02" });
    if (action === "view-scene-config") return navigate("configuration", null, { moduleId: "M01" });
    if (action === "view-scene-query") return navigate("query-decision", null, { moduleId: "M03", anchor: "m03-query" });
    if (action === "view-scene-decision") return navigate("query-decision", null, { moduleId: "M04", anchor: "m04-decision" });
    if (action === "view-scene-agent") return navigate("agent-boundary", null, { moduleId: "M05" });
    if (action === "view-scene-reports") return navigate("runs", null, { moduleId: "M06" });
    if (action === "view-decision-todos") return navigate("query-decision", null, { moduleId: "M04", anchor: "m04-todos" });
    if (action === "refresh-source") {
      try {
        await STORE.bootstrap();
        toast("已重新读取 S003 场景、模块状态和当前运行证据。", "success");
      } catch (error) {
        toast(error.message || String(error), "danger");
      }
      return;
    }
    if (action === "reset-current-scenario") {
      try {
        if (typeof STORE.resetCurrentScenario !== "function") throw new Error("当前场景尚未提供安全重置能力。");
        await STORE.resetCurrentScenario();
        navigate("platform-home", null, { replace: true });
        toast("已重置当前 S003 场景并开启新的 scenarioRunId；历史证据保持不变。", "success");
      } catch (error) {
        toast(error.message || String(error), "danger");
      }
      return;
    }
    if (action === "open-report") return openReport(target.dataset.enterpriseId);
    if (action === "select-factor-enterprise") return STORE.selectEnterprise(target.dataset.enterpriseId);
    if (action === "save-factor-draft") return toast("Draft 已保存为当前场景的可丢弃工作投影；未触发重评。", "info");
    if (action === "validate-factor-inputs") {
      const result = STORE.validateFactorInputs();
      return toast(result.ok ? "企业因子输入校验通过。" : `校验未通过：${result.errors[0]}`, result.ok ? "success" : "danger");
    }
    if (action === "publish-factor-inputs") {
      try { const snapshot = STORE.publishFactorInputs(); return toast(`已形成输入快照投影 ${snapshot.snapshotId}；尚未重评。`, "success"); } catch (error) { return toast(error.message, "danger"); }
    }
    if (action === "validate-publish-factors") {
      try {
        const validation = STORE.validateFactorInputs();
        if (!validation.ok) throw new Error(validation.errors[0]);
        const snapshot = STORE.publishFactorInputs();
        return toast(`校验通过并发布 ${snapshot.snapshotId}；请显式点击快速重跑。`, "success");
      } catch (error) { return toast(error.message, "danger"); }
    }
    if (action === "validate-configuration") {
      const result = STORE.validateConfiguration();
      return toast(result.ok ? "配置校验通过，可发布新版本。" : `配置未通过：${result.errors[0]}`, result.ok ? "success" : "danger");
    }
    if (action === "publish-configuration") {
      try { const model = STORE.publishConfiguration(); return toast(`模型包 ${model.packageVersion} 已发布；不会自动重评。`, "success"); } catch (error) { return toast(error.message, "danger"); }
    }
    if (action === "reset-configuration") { STORE.resetConfiguration(); return toast("已放弃 Draft，恢复当前 Published 配置。", "info"); }
    if (action === "quick-rerun") return quickRerun();
    if (action === "return-successful-run") {
      try { STORE.returnToLastSuccessfulRun(); navigate("runs", null, { replace: true }); toast("已返回正式成功运行；未重放任何历史副作用。", "success"); } catch (error) { toast(error.message, "danger"); }
      return;
    }
    if (action === "run-query") {
      if (!runAuthority().canQuery) return toast("M03 已阻断：工作投影或隔离演练不得作为 Published 问数输入。", "danger");
      try { STORE.runQuery(target.dataset.queryId); } catch (error) { toast(error.message, "danger"); }
      return;
    }
    if (action === "open-decision") {
      try {
        if (!runAuthority().canDecision) throw new Error("M04 已阻断：仅正式 Published 事实可提交行动申请。");
        navigate("query-decision", null, { moduleId: "M04", anchor: "m04-decision", replace: true });
        STORE.openDecision(target.dataset.candidateId || target.dataset.enterpriseId);
      } catch (error) { toast(error.message, "danger"); }
      return;
    }
    if (action === "open-submitted-action") {
      try {
        if (!runAuthority().canDecision) throw new Error("M04 已阻断：历史或隔离运行不得进行接口人确认。");
        navigate("query-decision", null, { moduleId: "M04", anchor: "m04-todos", replace: true });
        const reference = target.dataset.candidateId || target.dataset.requestId || target.dataset.enterpriseId;
        if (typeof STORE.openSubmittedActionRequest === "function") STORE.openSubmittedActionRequest(reference);
        else if (typeof STORE.openDecision === "function") STORE.openDecision(reference);
        else throw new Error("当前场景运行服务未提供行动申请确认入口。");
      } catch (error) { toast(error.message, "danger"); }
      return;
    }
    if (action === "close-decision") return STORE.closeDecision();
    if (action === "confirm-decision") {
      try {
        if (!runAuthority().canDecision) throw new Error("当前运行不是可消费的正式 Published 证据，禁止提交或分办。");
        const pending = state().pendingDecision;
        if (!pending) throw new Error("没有待处理的行动申请。");
        const submitted = pendingActionRequest();
        const payload = {
          owner: document.getElementById("decision-owner")?.value.trim(),
          note: document.getElementById("decision-note")?.value.trim(),
          confirmed: Boolean(document.getElementById("decision-confirmed")?.checked),
          recipientConfirmed: Boolean(document.getElementById("decision-confirmed")?.checked),
          recipientId: submitted?.decisionRecipient?.recipientId || submitted?.recipientId || pending?.decisionRecipient?.recipientId || null,
          recipientName: submitted?.decisionRecipient?.recipientName || submitted?.recipientName || pending?.decisionRecipient?.recipientName || null
        };
        let result;
        if (submitted) {
          result = invokeStoreMethod(["confirmMemberUnitDecision", "confirmMemberUnitActionRequest", "confirmSubmittedActionRequest", "confirmDecision"], payload);
          return toast(`${result.enterpriseName || result.subjectName || pending.enterpriseName} 已由成员单位接口人确认，已形成负责人待办。`, "success");
        }
        result = invokeStoreMethod(["submitActionRequest", "submitDecision"], payload);
        return toast(`${result.enterpriseName || result.subjectName || pending.enterpriseName} 的行动申请已定向送达对应成员单位接口人的决策中心，待接口人确认分办。`, "success");
      } catch (error) { return toast(error.message, "danger"); }
    }
    if (action === "view-checkpoint") {
      try {
        await STORE.viewCheckpoint(target.dataset.checkpointCode);
        setHash(state().currentView, state().selectedEnterpriseId, true, state().currentAnchor);
      } catch (error) { toast(error.message, "danger"); }
      return;
    }
    if (action === "exit-historical") {
      STORE.exitHistoricalView();
      navigate(state().currentView, state().selectedEnterpriseId, { moduleId: state().activeModuleId, anchor: state().currentAnchor, replace: true });
      return;
    }
    if (action === "restore-checkpoint") {
      try { const operation = await STORE.cloneRestore(target.dataset.checkpointCode); navigate("runs", null, { replace: true }); toast(`已克隆恢复为新运行 ${DATA.shortId(operation.context.scenarioRunId)}；尚未评估。`, "success"); } catch (error) { toast(error.message, "danger"); }
      return;
    }
    if (action === "regress-checkpoint") {
      try {
        const operation = await STORE.isolatedRegression(target.dataset.checkpointCode);
        if (operation.run) navigate("runs", null, { replace: true });
        toast(operation.run ? `隔离回归完成：${DATA.shortId(operation.context.scenarioRunId)}。` : state().runError || "隔离回归未成功，已保留上一成功运行。", operation.run ? "success" : "danger");
      } catch (error) { toast(error.message, "danger"); }
      return;
    }
    if (action === "print-report" || action === "print-now") return printReport();
    if (action === "open-formal-report") return openFormalReport();
    if (action === "copy-report-link") return copyReportLink();
  }

  app.addEventListener("click", function (event) {
    const platformTarget = event.target.closest("[data-platform-action]");
    if (platformTarget) {
      event.preventDefault();
      void handleAction(platformTarget.dataset.platformAction, platformTarget);
      return;
    }
    const moduleTarget = event.target.closest("[data-module-id]");
    if (moduleTarget) {
      const module = DATA.MODULES.find(function (item) { return item.id === moduleTarget.dataset.moduleId; });
      if (module) navigate(module.frameView || module.view, null, { moduleId: module.id, anchor: module.anchor || null });
      return;
    }
    const viewTarget = event.target.closest("[data-view]");
    if (viewTarget) {
      navigate(viewTarget.dataset.view);
      return;
    }
    const actionTarget = event.target.closest("[data-action]");
    if (!actionTarget) return;
    event.preventDefault();
    void handleAction(actionTarget.dataset.action, actionTarget);
  });

  modalRoot.addEventListener("click", function (event) {
    const actionTarget = event.target.closest("[data-action]");
    if (!actionTarget) return;
    event.preventDefault();
    void handleAction(actionTarget.dataset.action, actionTarget);
  });

  app.addEventListener("input", function (event) {
    const filter = event.target.dataset.filter;
    if (filter && ["enterpriseSearch", "factorEntrySearch"].includes(filter)) STORE.setFilter(filter, event.target.value);
  });

  app.addEventListener("change", function (event) {
    const target = event.target;
    if (target.dataset.filter) return STORE.setFilter(target.dataset.filter, target.value);
    if (target.dataset.factorName) return STORE.updateFactorInput(target.dataset.enterpriseId, target.dataset.factorName, target.value);
    if (target.dataset.weightCategory) return STORE.updateWeight(target.dataset.weightCategory, Number(target.dataset.weightIndex), target.value);
    if (target.dataset.factorId) return STORE.updateFactorCoefficient(target.dataset.factorId, target.dataset.tierId, target.value);
    if (target.dataset.riskTierId) return STORE.updateRiskThreshold(target.dataset.riskTierId, target.value);
  });

  app.addEventListener("click", function (event) {
    const tab = event.target.closest("[data-config-tab]");
    if (tab) STORE.setFilter("activeConfigTab", tab.dataset.configTab);
  });

  window.addEventListener("popstate", function () {
    // 深链的 scenarioRunId / reportId 必须经过统一 bootstrap 校验，避免回退到另一轮运行。
    captureFramePosition();
    void STORE.bootstrap();
  });

  window.addEventListener("beforeunload", captureFramePosition);

  window.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && state().pendingDecision) STORE.closeDecision();
    if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
      event.preventDefault();
      navigate("enterprises");
      window.setTimeout(function () { document.querySelector('[data-filter="enterpriseSearch"]')?.focus(); }, 100);
    }
  });

  STORE.subscribe(render);
  render();
  void STORE.bootstrap().then(warmModuleSources).catch(function () {});
})();
