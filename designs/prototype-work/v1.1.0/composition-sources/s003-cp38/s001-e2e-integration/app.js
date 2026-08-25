(function () {
  "use strict";

  const DATA = window.S001_DATA;
  const STORE = window.S001_STORE;
  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modal-root");
  const toastRegion = document.getElementById("toast-region");

  let modalState = null;
  let renderedModuleId = null;
  let frameObserver = null;
  let frameSaveTimer = null;
  let homeScrollSaveTimer = null;
  let storageRefreshTimer = null;
  let homeDomain = "foundation";
  let homeOrbitTurn = 0;
  let suppressHomeDomainStateRender = false;
  let ontologyBridgeFrame = null;
  let ontologyBridgeReady = null;
  let ontologyContractReplay = null;
  let s003RuntimeReady = null;
  let s003RuntimeSnapshot = null;
  let s003RuntimeUnsubscribe = null;
  let requestedModuleTarget = null;
  const s003ModulePageHealth = Object.create(null);
  const S003_MODULE_HEALTH_IDS = Object.freeze({ data: "M02", ontology: "M01", query: "M03", decision: "M04", agent: "M05", report: "M06", dashboard: "M06" });
  const S003_PROTOTYPE_BUILD = "20260819-40-performance";

  const IQ_STATE_KEY = "ontology3.iq.review.conversation.v1";
  const C008_PROJECTION_KEY = "ontology3-c008-authoritative-projection-v1";
  const HANDOFF_CHANNEL = STORE.HANDOFF_CHANNEL || "ontology3.0-s001-handoff-v1";
  const SCENARIO_SHELL_CHANNEL = "ontology3.0-scenario-shell-v1";
  const SCENARIO_URL_IDENTITY_FIELDS = Object.freeze([
    "scenarioVersion", "scenarioRunId", "formedAt", "status",
    "contextCreatedAt", "contextStatus", "scenarioFormedAt", "scenarioStatus"
  ]);

  const HOME_DOMAIN_ORDER = ["foundation", "intelligence", "action"];
  const HOME_DOMAINS = {
    foundation: {
      order: "01", en: "可信数据", name: "数据治理", icon: "database", modules: ["data", "ontology"],
      kicker: "数据治理 · 可信底座", title: "把持续变化的数据，治理成稳定、可追溯的业务基础",
      lead: "数据工程负责来源、管道、数据资产与质量；本体管理负责业务对象、关系、指标、规则和行动类型。两者共同形成可被后续环节稳定引用的业务基础。",
      core: "数据治理 · 语义问数 · 行动智能"
    },
    intelligence: {
      order: "02", en: "可信理解", name: "语义问数", icon: "insight", modules: ["query", "report"],
      kicker: "语义问数 · 可信理解", title: "让每次问数与报告都能回到明确的数据和业务定义",
      lead: "智能问数在固定上下文中回答问题；报告中心负责确定性核验、正式发布和当前数据比较。答案与报告始终保留版本与来源。",
      core: "数据治理 · 语义问数 · 行动智能"
    },
    action: {
      order: "03", en: "受控协作", name: "行动智能", icon: "action", modules: ["decision", "agent"],
      kicker: "行动智能 · 受控闭环", title: "让洞察进入人的判断，再形成清晰、可追溯的行动",
      lead: "Agent 应用解释固定证据；决策中心承接行动申请、人工确认和负责人待办。任何环节都不能绕过人工确认直接形成待办。",
      core: "数据治理 · 语义问数 · 行动智能"
    }
  };

  const icons = {
    home: '<path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    network: '<circle cx="12" cy="5" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m10.7 7.2-3.4 8.6M13.3 7.2l3.4 8.6M8.5 18h7"/>',
    brainCircuit: '<path class="brain-mesh-outline" d="M12 4.35C10.92 2.72 8.42 2.35 6.92 3.78 4.76 3.6 3.14 5.67 3.82 7.7 2.18 8.78 2.28 11.18 3.72 12.5 2.62 14.5 3.8 16.96 5.93 17.52 6.22 20.2 9.42 21.38 11.28 19.72c.45-.4.72-.9.72-1.5 0 .6.27 1.1.72 1.5 1.86 1.66 5.06.48 5.35-2.2 2.13-.56 3.31-3.02 2.21-5.02 1.44-1.32 1.54-3.72-.1-4.8.68-2.03-.94-4.1-3.1-3.92-1.5-1.43-4-1.06-5.08.57Z"/><path class="brain-mesh-edge" d="M12 4.35 8.65 4.6 6.05 6.15 9.4 7.3 12 8.95 14.6 7.3 17.95 6.15 15.35 4.6 12 4.35M6.05 6.15 4.78 9.05 7.35 10.35 9.4 7.3M4.78 9.05 5.55 13.55 7.35 10.35 9.95 11.7 12 8.95M5.55 13.55 8.65 15.55 9.95 11.7 12 14.05 10.25 17.55 8.65 15.55M5.55 13.55 6.02 16.35 8.65 15.55M10.25 17.55 12 19.25 13.75 17.55 12 14.05M12 8.95 12 14.05M17.95 6.15 19.22 9.05 16.65 10.35 14.6 7.3M19.22 9.05 18.45 13.55 16.65 10.35 14.05 11.7 12 8.95M18.45 13.55 15.35 15.55 14.05 11.7 12 14.05 13.75 17.55 15.35 15.55M18.45 13.55 17.98 16.35 15.35 15.55M7.35 10.35 12 8.95 16.65 10.35M8.65 15.55 12 14.05 15.35 15.55"/><path class="brain-mesh-seam" d="M12 4.35v15"/><circle class="brain-mesh-node phase-a node-key" cx="12" cy="4.35" r=".48"/><circle class="brain-mesh-node phase-b" cx="8.65" cy="4.6" r=".34"/><circle class="brain-mesh-node phase-c" cx="6.05" cy="6.15" r=".38"/><circle class="brain-mesh-node phase-d" cx="9.4" cy="7.3" r=".34"/><circle class="brain-mesh-node phase-b" cx="4.78" cy="9.05" r=".4"/><circle class="brain-mesh-node phase-a" cx="7.35" cy="10.35" r=".34"/><circle class="brain-mesh-node phase-c" cx="9.95" cy="11.7" r=".38"/><circle class="brain-mesh-node phase-d" cx="5.55" cy="13.55" r=".38"/><circle class="brain-mesh-node phase-b" cx="6.02" cy="16.35" r=".34"/><circle class="brain-mesh-node phase-a" cx="8.65" cy="15.55" r=".4"/><circle class="brain-mesh-node phase-c" cx="10.25" cy="17.55" r=".34"/><circle class="brain-mesh-node phase-d node-key" cx="12" cy="8.95" r=".46"/><circle class="brain-mesh-node phase-a node-key" cx="12" cy="14.05" r=".46"/><circle class="brain-mesh-node phase-c node-key" cx="12" cy="19.25" r=".48"/><circle class="brain-mesh-node phase-b" cx="15.35" cy="4.6" r=".34"/><circle class="brain-mesh-node phase-a" cx="17.95" cy="6.15" r=".38"/><circle class="brain-mesh-node phase-d" cx="14.6" cy="7.3" r=".34"/><circle class="brain-mesh-node phase-c" cx="19.22" cy="9.05" r=".4"/><circle class="brain-mesh-node phase-b" cx="16.65" cy="10.35" r=".34"/><circle class="brain-mesh-node phase-d" cx="14.05" cy="11.7" r=".38"/><circle class="brain-mesh-node phase-a" cx="18.45" cy="13.55" r=".38"/><circle class="brain-mesh-node phase-c" cx="17.98" cy="16.35" r=".34"/><circle class="brain-mesh-node phase-d" cx="15.35" cy="15.55" r=".4"/><circle class="brain-mesh-node phase-b" cx="13.75" cy="17.55" r=".34"/>',
    sparkles: '<path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3Z"/><path d="m5 14 .8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Zm14-2 .7 1.8 1.8.7-1.8.7L19 16l-.7-1.8-1.8-.7 1.8-.7L19 12Z"/>',
    insight: '<path d="M4 19V9m5 10V5m6 14v-7m5 7V3"/><path d="m3 13 6-5 6 2 6-6"/>',
    action: '<circle cx="12" cy="12" r="3"/><circle cx="4" cy="7" r="2"/><circle cx="20" cy="5" r="2"/><circle cx="20" cy="19" r="2"/><circle cx="4" cy="19" r="2"/><path d="m6 8 3.5 2m5 0 3.5-4m-3.5 8 3.5 4m-8.5-4L6 18"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/><path d="m15.5 8.5 5-5M17 3h3.5v3.5"/>',
    bot: '<rect x="5" y="7" width="14" height="11" rx="2"/><path d="M12 3v4M8.5 12h.01M15.5 12h.01M9 15h6M3 11v4M21 11v4"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    reset: '<path d="M4.9 5.9A9 9 0 1 1 3 12"/><path d="M3 4v6h6"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    alert: '<path d="M10.3 3.8 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    shield: '<path d="M12 3 5 6v5c0 4.8 2.8 8 7 10 4.2-2 7-5.2 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-5"/>',
    panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16M18 9h.01M18 13h.01"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2"/>',
    building: '<path d="M4 21V6l8-3v18M12 9h8v12M2 21h20M7 9h2M7 13h2M7 17h2M15 13h2M15 17h2"/>',
    dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
  };

  function icon(name, className = "") {
    return `<span class="icon ${className}" aria-hidden="true"><svg viewBox="0 0 24 24">${icons[name] || icons.dots}</svg></span>`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function htmlElement(markup) {
    const template = document.createElement("template");
    template.innerHTML = markup.trim();
    return template.content.firstElementChild;
  }

  function parseRoute() {
    const hash = window.location.hash || "#home";
    if (hash === "#home" || hash === "#/" || hash === "#") return { type: "home", active: "home", key: "home" };
    if (hash === "#dashboard") return { type: "dashboard", active: "dashboard", key: "dashboard" };
    const moduleMatch = hash.match(/^#module\/(data|ontology|query|decision|agent|report)$/);
    if (moduleMatch) return { type: "module", moduleId: moduleMatch[1], active: moduleMatch[1], key: `module-${moduleMatch[1]}` };
    return { type: "home", active: "home", key: "home" };
  }

  function projection() {
    try {
      return STORE.getProjection?.() || { steps: {} };
    } catch (_) {
      return { steps: {} };
    }
  }

  function rawStep(stepId) {
    const current = projection();
    return current.steps?.[stepId] || current[stepId] || {};
  }

  function stepState(stepId) {
    const record = rawStep(stepId);
    if (record.complete === true) return "complete";
    const value = String(record.state || record.status || "pending").toLowerCase();
    if (["complete", "completed", "verified", "success", "done"].includes(value)) return "complete";
    if (["observed", "unlinked", "detected"].includes(value)) return "observed";
    if (["running", "processing", "checking", "queued"].includes(value)) return "running";
    if (["failed", "failure", "error"].includes(value)) return "failed";
    if (["blocked", "unverifiable", "unknown", "stale"].includes(value)) return "blocked";
    return "pending";
  }

  function isComplete(stepId) {
    return typeof STORE.isComplete === "function" ? Boolean(STORE.isComplete(stepId)) : stepState(stepId) === "complete";
  }

  function completedCount() {
    return activeWorkflow().filter((step) => isComplete(step.id)).length;
  }

  function firstIncomplete() {
    const candidate = STORE.firstIncomplete?.();
    if (typeof candidate === "string") return activeStepById()[candidate] || null;
    if (candidate?.id) return activeStepById()[candidate.id] || candidate;
    return activeWorkflow().find((step) => !isComplete(step.id)) || null;
  }

  function moduleProgress(module) {
    const reported = STORE.moduleProgress?.(module.id) || STORE.moduleProgress?.(module);
    if (reported && Number.isFinite(reported.done) && Number.isFinite(reported.total)) return reported;
    const done = module.steps.filter(isComplete).length;
    const observed = module.steps.filter((id) => stepState(id) === "observed").length;
    return { done, observed, total: module.steps.length, complete: done === module.steps.length };
  }

  function statusMeta(state) {
    return {
      complete: { label: "已确认", tone: "success", icon: "check" },
      observed: { label: "待关联", tone: "warning", icon: "link" },
      running: { label: "处理中", tone: "info", icon: "refresh" },
      failed: { label: "未通过", tone: "danger", icon: "alert" },
      blocked: { label: "暂不可继续", tone: "warning", icon: "alert" },
      pending: { label: "待开始", tone: "", icon: "clock" }
    }[state] || { label: "待开始", tone: "", icon: "clock" };
  }

  function recordDetail(stepId) {
    const step = activeStepById()[stepId];
    const record = rawStep(stepId);
    return record.detail || record.reason || record.message || record.summary || step?.summary || "等待在相应模块中完成。";
  }

  function recordAt(stepId) {
    const record = rawStep(stepId);
    return record.at || record.observedAt || record.updatedAt || record.completedAt || "";
  }

  function stateDataAsOf() {
    const current = projection();
    return current.meta?.dataAsOf || current.dataAsOf || STORE.get().context.dataAsOf || activeScenario().dataAsOf;
  }

  function enabledScenarios() {
    const registry = Array.isArray(DATA.scenarioRegistry) ? DATA.scenarioRegistry : [DATA.scenario];
    return registry.filter((scenario) => scenario?.id && scenario.enabled !== false);
  }

  function activeScenario() {
    const scenarioId = STORE.get().activeScenarioId || STORE.getScenario?.()?.scenarioId || DATA.scenario.id;
    return DATA.scenarioById?.[scenarioId] || enabledScenarios().find((scenario) => scenario.id === scenarioId) || DATA.scenario;
  }

  function scenarioUrl(scenarioId, hash = "#home", suppliedContext = null) {
    const url = new URL(window.location.href);
    if (scenarioId === DATA.scenario.id) url.searchParams.delete("scenarioId");
    else url.searchParams.set("scenarioId", scenarioId);
    SCENARIO_URL_IDENTITY_FIELDS.forEach((field) => url.searchParams.delete(field));
    const context = suppliedContext
      || STORE.getScenarioContext?.(scenarioId)
      || STORE.getScenario?.(scenarioId)?.scenarioContext
      || null;
    if (scenarioId === "S003" && context?.scenarioId === scenarioId) {
      const identity = {
        scenarioVersion: context.scenarioVersion,
        scenarioRunId: context.scenarioRunId,
        formedAt: context.formedAt,
        status: context.status,
        contextCreatedAt: context.formedAt,
        contextStatus: context.status,
        scenarioFormedAt: context.formedAt,
        scenarioStatus: context.status
      };
      Object.entries(identity).forEach(([field, value]) => {
        if (value !== undefined && value !== null && value !== "") url.searchParams.set(field, value);
      });
    }
    url.hash = hash;
    return `${url.pathname}${url.search}${url.hash}`;
  }

  function scenarioHistoryState(scenarioId, depth, suppliedContext = null) {
    const context = suppliedContext
      || STORE.getScenarioContext?.(scenarioId)
      || STORE.getScenario?.(scenarioId)?.scenarioContext
      || null;
    return {
      ...(history.state || {}),
      s001Shell: true,
      scenarioId,
      scenarioVersion: context?.scenarioVersion || null,
      scenarioRunId: context?.scenarioRunId || null,
      scenarioFormedAt: context?.formedAt || null,
      scenarioStatus: context?.status || null,
      s001Depth: depth
    };
  }

  function activeWorkflow() {
    return DATA.workflowForScenario?.(activeScenario().id) || DATA.workflow;
  }

  function activeModules() {
    return DATA.modulesForScenario?.(activeScenario().id) || DATA.modules;
  }

  function activeModuleById(moduleId) {
    return DATA.moduleForScenario?.(activeScenario().id, moduleId) || DATA.moduleById[moduleId] || null;
  }

  function activeStepById() {
    return DATA.stepByScenario?.[activeScenario().id] || DATA.stepById;
  }

  function activeScenarioContext() {
    return STORE.getScenarioContext?.(activeScenario().id) || STORE.getScenario?.(activeScenario().id)?.scenarioContext || null;
  }

  function immutableCheckpointProgress() {
    const scenario = activeScenario();
    const workflow = activeWorkflow();
    const configured = scenario.snapshotProjection || null;
    if (scenario.id !== "S003" || configured?.kind !== "immutable-checkpoint" || !configured.checkpointId || !configured.manifestUrl) {
      const done = completedCount();
      return { done, total: workflow.length, checkpointId: null, immutable: false };
    }
    const done = workflow.filter((step) => {
      const supplied = configured.steps?.[step.id];
      return supplied?.complete === true || supplied?.status === "complete";
    }).length;
    return { done, total: workflow.length, checkpointId: configured.checkpointId, immutable: true };
  }

  function dashboardRunAvailable(run) {
    return Boolean(
      run
      && run.status === "succeeded"
      && run.runId
      && run.runId === run.scenarioContext?.scenarioRunId
    );
  }

  // S003 的运行状态仍按内部合同保留原始值；壳层只向业务用户展示可理解的状态。
  // 这层转换不改变 scenarioRunId、Published 指针或任何健康检查结果。
  function s003UserFacingCopy(value) {
    return String(value ?? "")
      .replace(/S003 场景运行服务未就绪/g, "正在准备本次评估结果")
      .replace(/当前运行已阻断/g, "当前运行需要刷新")
      .replace(/当前运行检查未通过/g, "当前运行需要刷新")
      .replace(/当前为工作投影/g, "当前为本次评估批次")
      .replace(/工作投影/g, "本次评估批次")
      .replace(/历史快照 · 只读/g, "历史评估记录")
      .replace(/历史运行只读/g, "历史评估记录")
      .replace(/历史只读/g, "历史记录，仅供查看")
      .replace(/不可消费/g, "暂未形成正式结果")
      .replace(/继续阻断/g, "暂不进入后续处理")
      .replace(/正式消费继续阻断/g, "正式处理暂缓")
      .replace(/外部副作用继续阻断/g, "不会触发外部操作")
      .replace(/M03\/M04、/g, "问数与决策、")
      .replace(/M03\/M04 /g, "问数与决策");
  }

  function s003DashboardAvailability() {
    if (activeScenario().id !== "S003") {
      const available = isComplete(activeScenario().dashboardReadyStepId || "publish");
      return { available, mode: available ? "baseline-published" : "unavailable", runId: null, warning: null };
    }
    const snapshot = s003RuntimeSnapshot;
    const current = snapshot?.activeRun;
    if (dashboardRunAvailable(current)) {
      const projectionOnly = current.projectionOnly === true || current.authorityMode === "published-runtime";
      const regression = current.authorityMode === "isolated-regression" || current.scenarioContext?.status === "regression";
      return {
        available: true,
        mode: regression ? "current-regression" : projectionOnly ? "current-projection" : "current-formal",
        runId: current.runId,
        warning: regression
          ? `当前为隔离回归 ${current.runId}；驾驶舱仅供演练查看，不会触发 Action Request、通知或负责人待办。`
          : projectionOnly
            ? `当前为本次评估批次 ${current.runId}；驾驶舱可查看本轮评分与报告预览，问数与决策、正式报告暂不进入后续处理。`
            : null
      };
    }
    const previous = snapshot?.lastSuccessfulRun;
    if (dashboardRunAvailable(previous)) {
      return {
        available: true,
        mode: "previous-formal",
        runId: previous.runId,
        warning: `当前轮次尚无可展示的评分结果；驾驶舱展示上一批次 ${previous.runId} 的结果，不会重复发送历史行动申请、通知或待办。`
      };
    }
    const checkpoint = immutableCheckpointProgress();
    const configured = activeScenario().snapshotProjection;
    if (checkpoint.immutable && configured?.meta?.reportNo) {
      return {
        available: true,
        mode: "checkpoint-formal",
        runId: configured.scenarioIdentity?.scenarioRunId || checkpoint.checkpointId,
        warning: `当前轮次尚无运行结果；驾驶舱展示快照 ${checkpoint.checkpointId} 锁定的上一批次结果，不会重复执行历史操作。`
      };
    }
    return {
      available: false,
      mode: snapshot?.ready === false || snapshot?.fatalError ? "runtime-blocked" : "no-run",
      runId: null,
      warning: null,
      reason: snapshot?.fatalError || snapshot?.runError || "当前没有评分运行或可定位的上一正式运行。"
    };
  }

  function s003FormalReturnAvailability() {
    if (activeScenario().id !== "S003") return { available: false, run: null };
    const snapshot = s003RuntimeSnapshot;
    const previous = snapshot?.lastSuccessfulRun;
    if (!dashboardRunAvailable(previous)) return { available: false, run: null };
    const currentRunId = snapshot?.activeRun?.runId || snapshot?.context?.scenarioRunId || activeScenarioContext()?.scenarioRunId || null;
    if (currentRunId === previous.runId && snapshot?.runStatus === "succeeded") return { available: false, run: previous };
    return {
      available: true,
      run: previous,
      detail: `返回正式运行 ${previous.runId}；不会执行重评，也不会重放历史 Action Request、通知或负责人待办。`
    };
  }

  function s003SideEffectProjectionKey(context) {
    return `ofw:v1.1.0:${context.scenarioId}:${context.scenarioVersion}:${context.scenarioRunId}:m04:${encodeURIComponent("action-requests/current")}`;
  }

  function assertS003NoHistoricalSideEffectReplay(snapshot, context, operationLabel) {
    if (!snapshot || !context || context.scenarioId !== "S003") throw new Error(`${operationLabel} 未返回完整 S003 运行快照。`);
    if (Array.isArray(snapshot.decisions) && snapshot.decisions.length) {
      throw new Error(`${operationLabel} 检测到历史 Action Request 或负责人待办被带入新运行，已拒绝采用该运行上下文。`);
    }
    const activeRun = snapshot.activeRun;
    for (const field of ["actionRequests", "tasks", "todos", "notifications"]) {
      if (Array.isArray(activeRun?.[field]) && activeRun[field].length) {
        throw new Error(`${operationLabel} 检测到 ${field} 被重放，已拒绝采用该运行上下文。`);
      }
    }
    const physicalKey = s003SideEffectProjectionKey(context);
    const raw = localStorage.getItem(physicalKey);
    if (raw) {
      let envelope;
      try { envelope = JSON.parse(raw); } catch (_) { throw new Error(`${operationLabel} 的新运行 M04 投影不是有效 JSON。`); }
      const items = envelope?.payload?.items;
      if (!Array.isArray(items)) throw new Error(`${operationLabel} 的新运行 M04 投影结构不兼容，已拒绝静默忽略。`);
      if (items.length) throw new Error(`${operationLabel} 检测到新运行 M04 投影包含历史副作用，已拒绝采用。`);
    }
    return { operationLabel, scenarioRunId: context.scenarioRunId, actionRequestsReplayed: false, notificationsReplayed: false, todosReplayed: false, checkedAt: new Date().toISOString() };
  }

  function s003HealthView() {
    if (activeScenario().id !== "S003") return null;
    const base = s003RuntimeSnapshot?.runtimeHealth || {
      status: s003RuntimeSnapshot?.fatalError ? "blocked" : "checking",
      currentRunHealthy: false,
      blockingReasons: s003RuntimeSnapshot?.fatalError ? [s003RuntimeSnapshot.fatalError] : [],
      warnings: [],
      modules: {},
      acceptanceReady: false
    };
    const context = activeScenarioContext();
    const modules = {};
    const blockingReasons = [...(base.blockingReasons || [])];
    const warnings = [...(base.warnings || [])];
    const checkingReasons = [];
    ["M01", "M02", "M03", "M04", "M05", "M06"].forEach(function (moduleId) {
      const formal = base.modules?.[moduleId] || { status: "checking", detail: "正式资源健康尚未形成。" };
      const page = s003ModulePageHealth[moduleId];
      const pageMatchesRun = Boolean(page && context
        && page.scenarioContext?.scenarioId === context.scenarioId
        && page.scenarioContext?.scenarioVersion === context.scenarioVersion
        && page.scenarioContext?.scenarioRunId === context.scenarioRunId);
      const pageHealth = pageMatchesRun ? page : {
        moduleId,
        status: "not-checked",
        detail: "该模块页面尚未在当前浏览器会话中打开；正式资源健康不受影响，进入模块时补充页面级检查。",
        scenarioContext: context,
        acceptanceReady: false
      };
      const status = formal.status === "blocked" || pageHealth.status === "blocked"
        ? "blocked"
        : formal.status === "warning" || pageHealth.status === "warning"
          ? "warning"
          : formal.status === "checking" || pageHealth.status === "checking"
            ? "checking"
            : "healthy";
      const pageHasRuntimeIssue = ["blocked", "warning", "checking"].includes(pageHealth.status);
      const detail = pageHasRuntimeIssue ? pageHealth.detail : formal.detail || pageHealth.detail;
      modules[moduleId] = { ...formal, status, detail, pageHealth };
      if (status === "blocked") blockingReasons.push(`${moduleId}：${detail || "模块页面或正式资源健康检查未通过。"}`);
      else if (status === "warning") warnings.push(`${moduleId}：${detail || "模块页面处于降级状态。"}`);
      else if (status === "checking") checkingReasons.push(`${moduleId}：${detail || "模块页面健康检查中。"}`);
    });
    const status = blockingReasons.length ? "blocked" : checkingReasons.length ? "checking" : warnings.length ? "degraded" : base.status === "healthy" ? "healthy" : base.status;
    return {
      ...base,
      schemaVersion: "ofw.s003.runtime-health.v2",
      status,
      currentRunHealthy: status === "healthy",
      modules,
      blockingReasons: [...new Set(blockingReasons)],
      warnings: [...new Set(warnings)],
      checkingReasons,
      uncheckedModules: Object.entries(modules).filter(function ([, value]) { return value?.pageHealth?.status === "not-checked"; }).map(function ([moduleId]) { return moduleId; }),
      modulePageHealth: Object.fromEntries(Object.entries(s003ModulePageHealth).map(([key, value]) => [key, { ...value }])),
      acceptanceReady: false
    };
  }

  function s003HealthSummary() {
    const health = s003HealthView();
    if (!health) return null;
    if (health.status === "healthy" && health.currentRunHealthy) {
      const unchecked = health.uncheckedModules || [];
      return { status: "healthy", tone: "success", label: "当前运行资源健康", detail: unchecked.length ? `当前场景身份、六模块正式资源与 Published 消费门均已通过；${unchecked.join("、")} 将在进入页面时补充交互健康检查。` : "当前场景身份、模块正式资源、Published 消费门与已打开页面均已通过健康检查。", route: "#dashboard" };
    }
    const moduleRoute = { M01: "ontology", M02: "data", M03: "query", M04: "decision", M05: "agent", M06: "report" };
    const issueModule = Object.entries(health.modules || {}).find(function ([, value]) {
      return value?.status === "blocked" || value?.status === "warning";
    })?.[0];
    const detail = s003UserFacingCopy(health.blockingReasons?.[0] || health.warnings?.[0] || health.checkingReasons?.[0] || (health.status === "checking" ? "正在读取当前运行服务、模块资源与本次评估状态。" : "当前运行需要刷新。"));
    return {
      status: health.status,
      tone: health.status === "blocked" ? "danger" : "warning",
      label: health.status === "checking" ? "正在检查本次评估" : health.status === "blocked" ? "当前运行需要刷新" : "当前运行有提示",
      detail,
      route: issueModule ? `#module/${moduleRoute[issueModule] || "report"}` : "#dashboard"
    };
  }

  function syncS003HealthChrome() {
    if (activeScenario().id !== "S003") return;
    const trigger = app.querySelector('[data-action="open-flow"]');
    const summary = s003HealthSummary();
    const checkpoint = immutableCheckpointProgress();
    if (!trigger || !summary) return;
    const title = trigger.querySelector("b");
    const detail = trigger.querySelector("small");
    const meter = trigger.querySelector(":scope > i > i");
    if (title) title.textContent = `历史节点 · ${checkpoint.done}/${checkpoint.total}`;
    if (detail) detail.textContent = `当前运行 · ${summary.label}`;
    if (meter) meter.style.width = `${checkpoint.total ? Math.round(checkpoint.done / checkpoint.total * 100) : 0}%`;
    trigger.dataset.runtimeHealth = summary.status;
  }

  window.S003ShellHealth = Object.freeze({
    getSnapshot: () => s003HealthView(),
    getModulePageHealth: () => Object.fromEntries(Object.entries(s003ModulePageHealth).map(([key, value]) => [key, { ...value }]))
  });

  function ensureS003Runtime() {
    if (!window.S003Store) return Promise.reject(new Error("S003 场景运行服务未加载。"));
    if (!s003RuntimeReady) {
      s003RuntimeReady = Promise.resolve(window.S003Store.bootstrap()).then(() => {
        const snapshot = window.S003Store.getRuntimeSnapshot?.();
        if (!snapshot?.ready) throw new Error(snapshot?.fatalError || "S003 场景运行服务初始化失败。");
        s003RuntimeSnapshot = snapshot;
        // The first shell projection is built before the asynchronous S003
        // runtime finishes bootstrapping.  Re-read it now so the home page
        // derives current-run progress from the runtime contract instead of
        // leaving the historical Checkpoint as the only visible source.
        STORE.refreshProjection?.(false, "S003");
        if (!s003RuntimeUnsubscribe && typeof window.S003Store.subscribe === "function") {
          s003RuntimeUnsubscribe = window.S003Store.subscribe(function () {
            const nextSnapshot = window.S003Store.getRuntimeSnapshot?.() || null;
            s003RuntimeSnapshot = nextSnapshot;
            const runtimeContext = nextSnapshot?.context || nextSnapshot?.runtimeHealth?.scenarioContext || null;
            const shellContext = activeScenarioContext();
            const runtimeIdentityAdopted = Boolean(runtimeContext && shellContext
              && runtimeContext.scenarioId === shellContext.scenarioId
              && runtimeContext.scenarioVersion === shellContext.scenarioVersion
              && runtimeContext.scenarioRunId === shellContext.scenarioRunId);
            if (activeScenario().id === "S003" && runtimeIdentityAdopted) {
              STORE.refreshProjection?.(false, "S003");
              render();
              if (modalState && ["flow", "step"].includes(modalState.kind)) renderModal();
            }
          });
        }
        return window.S003Store;
      }).catch((error) => {
        s003RuntimeReady = null;
        throw error;
      });
    }
    return s003RuntimeReady;
  }

  function postScenarioShellResponse(event, message, ok, result = null, error = null) {
    event.source?.postMessage?.({
      channel: SCENARIO_SHELL_CHANNEL,
      operation: `${message.operation}:response`,
      requestId: message.requestId || null,
      scenarioId: message.scenarioId || null,
      scenarioVersion: message.scenarioVersion || null,
      scenarioRunId: message.scenarioRunId || null,
      ok,
      result,
      error,
      respondedAt: new Date().toISOString()
    }, window.location.origin);
  }

  async function executeS003RuntimeOperation(message) {
    const runtime = await ensureS003Runtime();
    const payload = message.payload || {};
    if (message.operation === "getS003RuntimeSnapshot") return runtime.getRuntimeSnapshot();
    if (message.operation === "getS003PublishedResources") return runtime.getPublishedResourceSnapshot();
    if (message.operation === "getS003FactorInputs") {
      const snapshot = runtime.getRuntimeSnapshot();
      return {
        context: snapshot.context,
        factorEntryStatus: snapshot.factorEntryStatus,
        factorEntryValidation: snapshot.factorEntryValidation,
        factorInputSnapshot: snapshot.factorInputSnapshot,
        factorInputs: snapshot.factorInputs,
        projectionHealth: snapshot.projectionHealth?.M02 || null,
        projectionRecoveryReceipts: (snapshot.projectionRecoveryReceipts || []).filter((item) => item.scope === "m02"),
        projectionNotice: snapshot.projectionNotice,
        runtimeHealth: snapshot.runtimeHealth
      };
    }
    if (message.operation === "saveS003ConfigurationDraft") runtime.replaceConfigurationDraft(payload.draft);
    else if (message.operation === "validateS003Configuration") runtime.validateConfiguration();
    else if (message.operation === "publishS003Configuration") runtime.publishConfiguration();
    else if (message.operation === "resetS003Configuration") runtime.resetConfiguration();
    else if (message.operation === "saveS003FactorInputs") runtime.replaceFactorInputs(payload.values);
    else if (message.operation === "validateS003FactorInputs") runtime.validateFactorInputs();
    else if (message.operation === "publishS003FactorInputs") runtime.publishFactorInputs();
    else throw new Error(`不支持的 S003 场景运行操作：${message.operation}`);
    return runtime.getRuntimeSnapshot();
  }

  function sourceWithScenarioContext(source) {
    const context = activeScenarioContext();
    const hintedScenarioId = new URLSearchParams(window.location.search).get("scenarioId");
    // The first shell render can happen before S003Store publishes C033.  A
    // module iframe created in that window still needs the current S003 build
    // token; otherwise a cached B2 page can survive the later context update.
    if (!context && hintedScenarioId !== "S003") return source;
    try {
      const url = new URL(source, window.location.href);
      const scenario = activeScenario();
      if (url.pathname.endsWith("/agent-application/Agent%E5%BA%94%E7%94%A8.html") || url.pathname.endsWith("/agent-application/Agent应用.html")) {
        url.searchParams.set("prototypeBuild", S003_PROTOTYPE_BUILD);
      }
      if (url.pathname.includes("/ontology-management-review/canvas-first/index.html")) {
        url.searchParams.set("prototypeBuild", S003_PROTOTYPE_BUILD);
      }
      if (url.pathname.includes("/data-engineering-prototype-review/review-v3/")) {
        // S003's native data contract adapter is served from the same
        // standalone B2 page; pin a build token so an old cached iframe can
        // never reintroduce a pre-contract member projection.
        url.searchParams.set("prototypeBuild", S003_PROTOTYPE_BUILD);
      }
      if (url.pathname.includes("/decision-center-prototype/")
        || url.pathname.includes("/intelligent-query-prototype/")
        || url.pathname.includes("/report-center/review-lifecycle/")) {
        url.searchParams.set("prototypeBuild", S003_PROTOTYPE_BUILD);
      }
      if (!context) {
        url.searchParams.set("scenarioId", "S003");
        url.searchParams.set("prototypeVersion", "1.1.0");
        return url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : url.href;
      }
      const fields = {
        scenarioId: context.scenarioId,
        scenarioVersion: context.scenarioVersion,
        scenarioRunId: context.scenarioRunId,
        formedAt: context.formedAt,
        status: context.status,
        contextCreatedAt: context.formedAt,
        contextStatus: context.status,
        scenarioFormedAt: context.formedAt,
        scenarioStatus: context.status,
        baselineVersion: scenario.baselineVersion || STORE.FOUNDATION?.CURRENT_BASELINE_VERSION,
        baselineSnapshotId: scenario.baselineSnapshotId || STORE.BASELINE_SNAPSHOT_ID,
        prototypeVersion: scenario.prototypeVersion || "1.1.0",
        publishedResourceVersion: scenario.trustedOntologyVersion || scenario.ontologyVersion || "",
        publishedDataVersion: scenario.dataVersion || "",
        assessmentAt: scenario.dataAsOf || ""
      };
      Object.entries(fields).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value); });
      return url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : url.href;
    } catch (_) {
      return source;
    }
  }

  function deliverScenarioContextToFrame(frame, module) {
    const context = STORE.publishScenarioContext?.(activeScenario().id, false) || activeScenarioContext();
    if (!frame?.contentWindow || !context || !["data", "ontology"].includes(module.id)) return;
    const targetModule = module.id === "data" ? "数据工程" : "本体管理";
    const payload = module.id === "ontology" ? STORE.getScenarioContextEnvelope?.(context.scenarioId) : context;
    if (!payload) return;
    frame.contentWindow.postMessage({
      channel: STORE.HANDOFF_CHANNEL || "ontology3.0-s001-handoff-v1",
      targetModule,
      operation: "deliverScenarioContext",
      requestId: `C033-${context.scenarioRunId}-${module.id}`,
      payload
    }, window.location.origin);
  }

  function readStoredObject(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value && typeof value === "object" ? value : null;
    } catch (_) {
      return null;
    }
  }

  function currentC008ProjectionKey() {
    const context = activeScenarioContext();
    if (context?.scenarioId !== "S003") return C008_PROJECTION_KEY;
    return `${C008_PROJECTION_KEY}:${context.scenarioId}:${context.scenarioVersion}:${context.scenarioRunId}`;
  }

  function stableDigest(value) {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36).toUpperCase().padStart(7, "0");
  }

  function ensureOntologyBridgeFrame() {
    if (ontologyBridgeFrame?.isConnected && ontologyBridgeReady) return ontologyBridgeReady;
    const module = activeModuleById("ontology");
    ontologyBridgeFrame = document.createElement("iframe");
    ontologyBridgeFrame.id = "ontology-contract-bridge";
    ontologyBridgeFrame.hidden = true;
    ontologyBridgeFrame.tabIndex = -1;
    ontologyBridgeFrame.setAttribute("aria-hidden", "true");
    ontologyBridgeFrame.setAttribute("sandbox", "allow-scripts allow-same-origin");
    ontologyBridgeFrame.src = sourceWithScenarioContext(module.source);
    ontologyBridgeReady = new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("本体合同桥加载超时")), 5000);
      ontologyBridgeFrame.addEventListener("load", () => {
        window.clearTimeout(timeout);
        deliverScenarioContextToFrame(ontologyBridgeFrame, module);
        resolve(ontologyBridgeFrame);
      }, { once: true });
    });
    document.body.appendChild(ontologyBridgeFrame);
    return ontologyBridgeReady;
  }

  async function requestOntologyBridge(operation, payload, requestId) {
    const frame = await ensureOntologyBridgeFrame();
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        window.removeEventListener("message", receive);
        reject(new Error(`${operation} 未取得本体管理响应`));
      }, 4000);
      function receive(event) {
        const response = event.data;
        if (event.origin !== window.location.origin || event.source !== frame.contentWindow) return;
        if (response?.channel !== HANDOFF_CHANNEL || response?.targetModule !== "本体管理" || response?.requestId !== requestId || response?.operation !== operation) return;
        window.clearTimeout(timeout);
        window.removeEventListener("message", receive);
        resolve(response);
      }
      window.addEventListener("message", receive);
      frame.contentWindow.postMessage({
        channel: HANDOFF_CHANNEL,
        targetModule: "本体管理",
        sourceModule: "统一平台",
        requestId,
        operation,
        payload
      }, window.location.origin);
    });
  }

  function currentC009Record() {
    const queryState = readStoredObject(IQ_STATE_KEY);
    const config = queryState?.activeConfig;
    const validation = config?.c009Validation;
    const scenario = activeScenarioContext();
    const sameScenario = validation?.sceneId === scenario?.scenarioId
      && validation?.sceneVersion === scenario?.scenarioVersion
      && validation?.sceneRunId === scenario?.scenarioRunId;
    if (config?.status !== "已启用" || config?.compatibility !== "兼容" || validation?.status !== "通过" || !sameScenario) return null;
    return {
      sourceModule: "智能问数",
      contractCode: "C009",
      configId: config.id,
      configVersion: config.version,
      consumer: "智能问数",
      semanticVersionId: validation.versionId,
      semanticVersion: validation.semanticVersion,
      dataVersion: validation.dataVersion,
      status: "compatible",
      checkedAt: validation.checkedAt,
      reason: null,
      evidenceLocator: `智能问数/${config.id}/${validation.configFingerprint || config.contentFingerprint || "兼容核验"}`
    };
  }

  async function reconcileOntologyContracts() {
    if (ontologyContractReplay) return ontologyContractReplay;
    ontologyContractReplay = (async () => {
      const c009 = currentC009Record();
      if (!c009) return false;
      const c009RequestId = `C009-${activeScenario().id}-${stableDigest(c009)}`;
      const compatibility = await requestOntologyBridge("deliverConsumerCompatibility", c009, c009RequestId);
      if (!compatibility?.ok) throw new Error(compatibility?.error || "智能问数兼容状态未被本体管理接收");

      const projection = readStoredObject(currentC008ProjectionKey());
      const context = projection?.scenarioContext;
      const current = projection?.current;
      if (!projection || projection.readStatus !== "available" || !current?.semanticVersionId || context?.scenarioRunId !== activeScenarioContext()?.scenarioRunId) {
        throw new Error("当前 C008 权威组合不可读取");
      }
      const requestId = `IQ-C004C007-${stableDigest({
        projectionId: projection.projectionId,
        ontologyStableId: current.ontologyStableId,
        semanticVersionId: current.semanticVersionId,
        semanticVersion: current.semanticVersion,
        dataVersion: current.dataVersion,
        asOf: current.asOf,
        t019EvidenceId: current.t019?.evidenceId || null,
        resourceContractFingerprint: current.resourceContractFingerprint || null,
        endpointContractFingerprint: current.endpointContractFingerprint || null,
        scenarioId: context?.scenarioId || null,
        scenarioVersion: context?.scenarioVersion || null,
        scenarioRunId: context?.scenarioRunId || null
      })}`;
      const publishedContext = await requestOntologyBridge("publishedContext", { versionId: current.semanticVersionId }, requestId);
      if (!publishedContext?.ok || !publishedContext?.result) throw new Error(publishedContext?.error || "已发布语义资源未返回");
      localStorage.setItem(`${HANDOFF_CHANNEL}:response:${requestId}`, JSON.stringify(publishedContext));
      document.documentElement.dataset.ontologyContracts = "ready";
      return true;
    })().catch((error) => {
      document.documentElement.dataset.ontologyContracts = "blocked";
      document.documentElement.dataset.ontologyContractReason = error?.message || "合同重放未完成";
      return false;
    });
    return ontologyContractReplay;
  }

  function scenarioWorkspaceMarkup() {
    const scenarios = enabledScenarios();
    const current = activeScenario();
    if (scenarios.length < 2) {
      return `<div class="scenario-workspace" aria-label="当前场景"><span>当前场景 · ${escapeHtml(current.id)}</span><strong>${escapeHtml(current.name)}</strong></div>`;
    }
    return `<label class="scenario-workspace scenario-select"><span>当前场景</span><select data-action="switch-scenario" aria-label="切换当前场景">${scenarios.map((scenario) => `<option value="${escapeHtml(scenario.id)}" ${scenario.id === current.id ? "selected" : ""}>${escapeHtml(scenario.id)} · ${escapeHtml(scenario.name)}</option>`).join("")}</select></label>`;
  }

  function setDocumentTitle(route) {
    const page = route.type === "module" ? activeModuleById(route.moduleId)?.name : route.type === "dashboard" ? "仪表盘" : "首页";
    document.title = route.type === "home" ? DATA.brand.full : `${page} · ${DATA.brand.zh}`;
  }

  function navigate(route, options = {}) {
    captureFramePosition();
    captureHomePosition();
    closeModal();
    const scenario = activeScenario();
    // S003 一级菜单进入模块时回到基线原生入口；模块内部深链仍通过
    // 显式 hash/场景消息进入，不让上一次企业详情或异常页劫持主路径。
    const moduleMatch = String(route || "").match(/^#module\/(data|ontology|query|decision|agent|report)$/);
    if (scenario.id === "S003" && moduleMatch && requestedModuleTarget?.moduleId !== moduleMatch[1]) {
      requestedModuleTarget = { moduleId: moduleMatch[1], hash: initialHash(moduleMatch[1]) };
    }
    const currentDepth = Number(history.state?.s001Depth || 0);
    STORE.saveNavigationContext?.({
      lastRoute: route,
      returnRoute: window.location.hash || "#home",
      moduleId: route.match?.(/^#module\/(.+)$/)?.[1] || null,
      scenarioId: scenario.id
    });
    const nextState = scenarioHistoryState(scenario.id, options.replace ? currentDepth : currentDepth + 1);
    if (options.replace) history.replaceState(nextState, "", route);
    else history.pushState(nextState, "", route);
    render();
  }

  function returnToPrevious() {
    const depth = Number(history.state?.s001Depth || 0);
    if (depth > 0) history.back();
    else navigate("#home", { replace: true });
  }

  function topbar(route) {
    const checkpoint = immutableCheckpointProgress();
    const done = checkpoint.done;
    const next = firstIncomplete();
    const scenario = activeScenario();
    const workflow = activeWorkflow();
    const runtimeSummary = s003HealthSummary();
    const progressTitle = scenario.id === "S003" ? `历史节点 · ${done}/${checkpoint.total}` : `链路进度 · ${done}/${workflow.length}`;
    const progressDetail = scenario.id === "S003"
      ? `当前运行 · ${runtimeSummary?.label || "检查中"}`
      : runtimeSummary ? runtimeSummary.label : next ? `下一步：${next.title}` : "全部来源状态已确认";
    const currentName = route.type === "module" ? activeModuleById(route.moduleId)?.name : route.type === "dashboard" ? "仪表盘" : "首页";
    return `<header class="global-topbar">
      <div class="top-title">${route.type === "home" ? "" : `<button class="top-icon-button" type="button" data-action="return-context" title="返回上一位置" aria-label="返回上一位置">${icon("back", "sm")}</button>`}${icon(route.type === "dashboard" ? "chart" : route.type === "module" ? activeModuleById(route.moduleId)?.icon : "home")}
        <div class="top-title-copy"><span>统一工作台</span><strong>${currentName}</strong></div>
      </div>
      ${scenarioWorkspaceMarkup()}
      <div class="top-actions">
        <button class="flow-trigger" type="button" data-action="open-flow" aria-label="打开 ${escapeHtml(scenario.id)} 链路进度">
          ${icon("layers", "sm")}<span><b>${escapeHtml(progressTitle)}</b><small>${escapeHtml(progressDetail)}</small></span><i><i style="width:${workflow.length ? Math.round((done / workflow.length) * 100) : 0}%"></i></i>
        </button>
        ${route.type === "module" || route.type === "dashboard" ? `<button class="top-action" type="button" data-action="refresh-source" aria-label="重新读取六个模块状态" title="重新读取">${icon("refresh", "sm")}<span>重新读取</span></button>` : ""}
        <button class="top-action" type="button" data-action="open-reset" aria-label="重置当前场景" title="重置当前场景">${icon("reset", "sm")}<span>重置当前场景</span></button>
        <div class="user-account" title="当前账号"><span class="user-avatar">管</span><strong>平台管理员</strong></div>
      </div>
    </header>`;
  }

  function navigation(route) {
    const state = STORE.get();
    const scenario = activeScenario();
    const checkpoint = immutableCheckpointProgress();
    const done = scenario.id === "S003" ? checkpoint.done : completedCount();
    const next = firstIncomplete();
    const runtimeSummary = s003HealthSummary();
    const footTitle = scenario.id === "S003" ? `历史节点 ${done}/${checkpoint.total}` : `${done}/${activeWorkflow().length} 项来源状态已确认`;
    const footDetail = scenario.id === "S003" ? `当前运行 · ${runtimeSummary?.label || "检查中"}` : runtimeSummary ? runtimeSummary.label : next ? `下一步：${next.title}` : "本次链路状态已全部确认";
    return `<aside class="global-nav">
      <button class="brand-lockup" type="button" data-action="toggle-navigation" aria-label="${state.navCollapsed ? "展开主菜单" : "收起主菜单"}" title="${state.navCollapsed ? "展开主菜单" : "收起主菜单"}">
        <span class="brand-mark brand-mark-ai" aria-hidden="true">${icon("brainCircuit", "brand-brain")}</span><div><strong>${DATA.brand.zh}</strong><small>${DATA.brand.en}</small></div>
      </button>
      ${scenario.id === "S003" ? "" : `<div class="nav-context"><span>当前场景</span><strong>${escapeHtml(scenario.id)} · ${escapeHtml(scenario.name)}</strong></div>`}
      <nav class="primary-nav" aria-label="一级导航">
        ${DATA.nav.map((item) => {
          const module = activeModuleById(item.id);
          const progress = module ? moduleProgress(module) : null;
          const dashboardReadyStepId = scenario.dashboardReadyStepId || "publish";
          const itemDone = module ? progress.complete : item.id === "dashboard" ? isComplete(dashboardReadyStepId) : false;
          const itemObserved = module ? !itemDone && (progress.observed || 0) > 0 : false;
          return `<button class="nav-item ${route.active === item.id ? "active" : ""}" type="button" data-route="${item.route}" title="${item.name}">
            ${icon(item.icon)}<span>${item.name}</span>${item.id === "home" ? "" : `<i class="nav-state ${itemDone ? "done" : itemObserved ? "observed" : ""}" aria-hidden="true"></i>`}
          </button>`;
        }).join("")}
      </nav>
      <div class="nav-foot"><div><i class="connection-dot ${runtimeSummary?.status === "blocked" ? "warning" : done ? "active" : ""}"></i><strong>${escapeHtml(footTitle)}</strong></div><p>${escapeHtml(footDetail)}</p></div>
    </aside>`;
  }

  function patchStableShell(route) {
    const nav = app.querySelector(".global-nav");
    const top = app.querySelector(".global-topbar");
    const view = app.querySelector(".module-view");
    const shell = app.querySelector(".platform-shell");
    if (!nav || !top || !view || !shell) return false;
    nav.replaceWith(htmlElement(navigation(route)));
    top.replaceWith(htmlElement(topbar(route)));
    shell.className = `platform-shell ${STORE.get().navCollapsed ? "nav-collapsed" : ""}`.trim();
    shell.dataset.scenarioId = activeScenario().id;
    setDocumentTitle(route);
    return true;
  }

  function renderShell(content, route, options = {}) {
    setDocumentTitle(route);
    const sameRoute = app.dataset.routeKey === route.key;
    const sameFrameMode = app.dataset.frameMode === (options.frameMode || "");
    if (options.preserveFrame && sameRoute && sameFrameMode && patchStableShell(route)) return false;
    if (frameObserver) { frameObserver.disconnect(); frameObserver = null; }
    app.innerHTML = `<div class="platform-shell ${STORE.get().navCollapsed ? "nav-collapsed" : ""}" data-scenario-id="${escapeHtml(activeScenario().id)}">${navigation(route)}<section class="shell-main">${topbar(route)}<main class="route-stage">${content}</main></section></div>`;
    app.dataset.routeKey = route.key;
    app.dataset.frameMode = options.frameMode || "";
    return true;
  }

  function syncHomeDomainFromScenario() {
    if (typeof STORE.getScenario !== "function") return;
    const scenario = STORE.getScenario() || {};
    const home = scenario.home || scenario.homepage || scenario.homeSummary || {};
    const savedDomain = home.selectedDomain
      || home.activeDomain
      || home.selectedCapabilityDomain
      || scenario.homeDomain;
    const nextDomain = HOME_DOMAINS[savedDomain] ? savedDomain : "foundation";
    const nextIndex = HOME_DOMAIN_ORDER.indexOf(nextDomain);
    const savedTurn = home.orbitTurn ?? home.turn ?? scenario.homeOrbitTurn;
    let nextTurn = Number.isFinite(Number(savedTurn)) ? Math.max(0, Math.trunc(Number(savedTurn))) : nextIndex;
    const remainder = ((nextTurn % HOME_DOMAIN_ORDER.length) + HOME_DOMAIN_ORDER.length) % HOME_DOMAIN_ORDER.length;
    if (remainder !== nextIndex) nextTurn += (nextIndex - remainder + HOME_DOMAIN_ORDER.length) % HOME_DOMAIN_ORDER.length;
    homeDomain = nextDomain;
    homeOrbitTurn = nextTurn;
  }

  function homeDomainCardsMarkup(domain) {
    return domain.modules.map((id) => {
      const module = activeModuleById(id);
      const progress = moduleProgress(module);
      const label = progress.complete ? "已确认" : progress.observed ? "待关联" : progress.done ? `${progress.done}/${progress.total} 已确认` : "待开始";
      const tone = progress.complete ? "success" : progress.observed ? "warning" : progress.done ? "info" : "";
      return `<article class="classic-module-card"><div class="classic-card-title"><span>${icon(module.icon)}</span><div><small>${module.short}</small><strong>${module.name}</strong></div><em class="status-badge ${tone}">${label}</em></div><p>${module.description}</p><footer><span>${progress.done}/${progress.total} 项来源状态已确认</span><button type="button" data-route="#module/${module.id}">进入模块 ${icon("arrow", "sm")}</button></footer></article>`;
    }).join("");
  }

  function homeDomainPagerMarkup() {
    return Object.entries(HOME_DOMAINS).map(([key, item]) => `<button type="button" class="${homeDomain === key ? "active" : ""}" data-action="home-domain" data-domain="${key}" aria-label="切换到${item.name}" aria-pressed="${homeDomain === key}">${item.order}</button>`).join("");
  }

  function homeArchitecturePathMarkup() {
    const activeSegment = HOME_DOMAIN_ORDER.indexOf(homeDomain) + 1;
    return `<svg class="architecture-path" viewBox="0 0 640 520" style="--orbit-angle:${homeOrbitTurn * 120}deg" aria-hidden="true">
      <defs><marker id="home-architecture-arrow" viewBox="0 0 12 12" refX="10.5" refY="6" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto"><path d="M2 1.5 10.5 6 2 10.5"/></marker></defs>
      <g class="path-segment segment-1${activeSegment === 1 ? " active" : ""}"><path class="path-track" d="M373.3 29.1 A237 237 0 0 1 534.8 360.2" marker-end="url(#home-architecture-arrow)"/><path class="path-flow" pathLength="1" d="M373.3 29.1 A237 237 0 0 1 534.8 360.2"/></g>
      <g class="path-segment segment-2${activeSegment === 2 ? " active" : ""}"><path class="path-track" d="M475.5 438.9 A237 237 0 0 1 170.9 444.2" marker-end="url(#home-architecture-arrow)"/><path class="path-flow" pathLength="1" d="M475.5 438.9 A237 237 0 0 1 170.9 444.2"/></g>
      <g class="path-segment segment-3${activeSegment === 3 ? " active" : ""}"><path class="path-track" d="M108.8 367.6 A237 237 0 0 1 258.7 31.1" marker-end="url(#home-architecture-arrow)"/><path class="path-flow" pathLength="1" d="M108.8 367.6 A237 237 0 0 1 258.7 31.1"/></g>
    </svg>`;
  }

  function homeCoreGraphicMarkup() {
    const domain = HOME_DOMAINS[homeDomain] || HOME_DOMAINS.foundation;
    return `<div class="classic-core" data-core-state="${homeDomain}" aria-hidden="true">
      <svg viewBox="0 0 220 150">
        <g class="core-grid"><path d="M34 112 110 137l76-25-76-25-76 25Zm19-6 57 19 57-19M72 100l38 13 38-13M34 112v8l76 25 76-25v-8M72 100v26m38-39v58m38-45v26"/></g>
        <path class="core-hud" d="M31 30v-8h9m140 0h9v8M31 104v8h9m140 0h9v-8M110 13v8m0 91v12M28 67h12m140 0h12"/>
        <polygon class="core-piece core-a" points="110,18 166,48 110,78 54,48"/>
        <polygon class="core-piece core-b" points="110,29 153,52 110,75 67,52"/>
        <polygon class="core-piece core-c" points="110,40 143,58 110,76 77,58"/>
        <rect class="core-piece core-d" x="83" y="31" width="54" height="54"/>
        <rect class="core-piece core-e" x="105" y="53" width="10" height="10"/>
        <path class="core-trace core-trace-foundation" d="M72 34H48v10H36m112-10h24v10h12M65 60H43v20H31m124-20h22v20h12M70 86H50v18H38m112-18h20v18h12M110 18v98"/>
        <path class="core-trace core-trace-intelligence" d="M46 42 76 26l30 16-30 16-30-16Zm0 0v34l30 17 30-17V42M76 58v35M114 46l30-16 30 16-30 16-30-16Zm0 0v34l30 17 30-17V46M144 62v35M106 58h8m-8 14h8"/>
        <path class="core-trace core-trace-action" d="M92 27h36l30 22M161 60v23l-36 26M110 111H91L59 88V57m51-11 25 16-25 16-25-16 25-16Z"/>
        <path class="core-scan" d="M45 29h130"/>
        <rect class="core-pulse" x="103" y="51" width="14" height="14"/>
      </svg>
      <b>${DATA.brand.zh}</b><span class="core-label">${domain.core}</span>
    </div>`;
  }

  function animateHomeDomainDetail(detail) {
    if (!detail || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || typeof detail.animate !== "function") return;
    detail.getAnimations().forEach((animation) => animation.cancel());
    detail.animate(
      [{ opacity: 0.72, transform: "translateX(5px)" }, { opacity: 1, transform: "translateX(0)" }],
      { duration: 480, easing: "cubic-bezier(.2,.85,.25,1)" }
    );
  }

  function selectHomeDomain(nextDomain) {
    if (!HOME_DOMAINS[nextDomain] || nextDomain === homeDomain) return;
    const currentIndex = HOME_DOMAIN_ORDER.indexOf(homeDomain);
    const nextIndex = HOME_DOMAIN_ORDER.indexOf(nextDomain);
    homeOrbitTurn += (nextIndex - currentIndex + HOME_DOMAIN_ORDER.length) % HOME_DOMAIN_ORDER.length;
    homeDomain = nextDomain;

    const frame = app.querySelector(".classic-home-frame");
    if (frame) {
      frame.dataset.homeDomain = homeDomain;
      const path = frame.querySelector(".architecture-path");
      path?.style.setProperty("--orbit-angle", `${homeOrbitTurn * 120}deg`);
      path?.querySelectorAll(".path-segment").forEach((segment, index) => segment.classList.toggle("active", index === nextIndex));
      frame.querySelectorAll(".architecture-node").forEach((node) => {
        const selected = node.dataset.domain === homeDomain;
        node.classList.toggle("active", selected);
        node.setAttribute("aria-pressed", String(selected));
      });
      const core = frame.querySelector(".classic-core");
      if (core) {
        core.dataset.coreState = homeDomain;
        const coreLabel = core.querySelector(".core-label");
        if (coreLabel) coreLabel.textContent = HOME_DOMAINS[homeDomain].core;
      }

      const domain = HOME_DOMAINS[homeDomain];
      const detail = frame.querySelector(".classic-domain-detail");
      if (detail) {
        detail.querySelector(".detail-kicker").textContent = domain.kicker;
        detail.querySelector("h2").textContent = domain.title;
        detail.querySelector(":scope > p").textContent = domain.lead;
        detail.querySelector(".classic-domain-cards").innerHTML = homeDomainCardsMarkup(domain);
        detail.querySelector(".domain-pager").innerHTML = homeDomainPagerMarkup();
        animateHomeDomainDetail(detail);
      }
    }

    if (typeof STORE.saveHomeDomain === "function") {
      suppressHomeDomainStateRender = true;
      const release = () => { suppressHomeDomainStateRender = false; };
      try {
        STORE.saveHomeDomain(homeDomain, homeOrbitTurn);
      } catch (_) {
        release();
        return;
      }
      if (typeof window.queueMicrotask === "function") window.queueMicrotask(release);
      else window.setTimeout(release, 0);
    }
  }

  function renderHome() {
    renderedModuleId = null;
    syncHomeDomainFromScenario();
    const state = STORE.get();
    const scenario = activeScenario();
    const workflow = activeWorkflow();
    const modules = activeModules();
    const next = firstIncomplete();
    const runtimeSummary = s003HealthSummary();
    const currentRuntimeIssue = Boolean(runtimeSummary && runtimeSummary.status !== "healthy");
    const formalReturn = s003FormalReturnAvailability();
    const sourceDone = completedCount();
    const checkpoint = immutableCheckpointProgress();
    const checkpointMode = scenario.id === "S003" && checkpoint.immutable;
    const done = checkpointMode ? checkpoint.done : sourceDone;
    const progressTotal = checkpointMode ? checkpoint.total : workflow.length;
    const percent = progressTotal ? Math.round((done / progressTotal) * 100) : 0;
    const nextState = next ? stepState(next.id) : "complete";
    const nextStatus = statusMeta(nextState);
    const currentModule = next ? activeModuleById(next.module) : activeModuleById("report");
    const domain = HOME_DOMAINS[homeDomain] || HOME_DOMAINS.foundation;

    const chain = modules.map((module) => {
      const progress = moduleProgress(module);
      const active = next?.module === module.id;
      const chainStatus = progress.complete ? "已确认" : active ? "当前处理" : progress.observed ? "待关联" : progress.done ? "进行中" : "待开始";
      return `<button class="home-chain-node ${progress.complete ? "done" : active ? "active" : progress.observed ? "observed" : ""}" type="button" data-route="#module/${module.id}" title="进入${module.name}" aria-label="进入${module.name}，${chainStatus}，${progress.done}/${progress.total} 项来源状态已确认">
        <span>${icon(progress.complete ? "check" : progress.observed ? "link" : module.icon, "sm")}</span><strong>${module.name}</strong><small>${chainStatus} · ${progress.done}/${progress.total}</small>
      </button>`;
    }).join("");

    const domainCards = homeDomainCardsMarkup(domain);
    const blockerCopy = currentRuntimeIssue ? runtimeSummary.detail : next ? recordDetail(next.id) : "全部来源状态已按同一链路确认。";
    const activities = workflow
      .map((step) => ({ step, record: rawStep(step.id), state: stepState(step.id), at: recordAt(step.id) }))
      .filter((item) => item.state !== "pending" && (item.at || item.state === "running" || item.state === "failed"))
      .slice(0, 4);
    const activity = activities.length
      ? activities.map((item) => {
          const meta = statusMeta(item.state);
          return `<article class="activity-item"><i class="activity-dot ${meta.tone}"></i><div><strong>${item.step.title} · ${meta.label}</strong><span>${escapeHtml(recordDetail(item.step.id))}</span></div><time>${escapeHtml(item.at)}</time></article>`;
        }).join("")
      : `<div class="empty-state">${icon("clock", "lg")}<strong>暂无最近任务或结果</strong><span>在相应模块完成操作后，这里会读取并汇总来源状态。</span></div>`;
    const selectedNames = scenario.selectedEntityNames?.length
      ? scenario.selectedEntityNames
      : state.context.selectedEntities.map((id) => DATA.entities.find((entity) => entity.id === id)?.name || id).filter(Boolean);
    const progressLabel = checkpointMode ? `${scenario.id} 历史节点` : `${scenario.id} 链路进度`;
    const progressNote = checkpointMode
      ? `不可变 Checkpoint 完成度；当前来源链路 ${sourceDone}/${workflow.length}，不代表当前运行健康`
      : `${percent}% 来源状态已确认`;
    const statusLabel = currentRuntimeIssue ? "当前运行健康" : next ? "下一步操作" : "当前状态";
    const statusTitle = currentRuntimeIssue ? runtimeSummary.label : next ? next.title : "全链路状态已确认";
    const primaryRoute = currentRuntimeIssue ? runtimeSummary.route : next ? `#module/${next.module}` : "#dashboard";
    const primaryLabel = currentRuntimeIssue ? "查看受影响模块" : next ? `前往${currentModule.name}` : "查看仪表盘";
    const blockerTone = currentRuntimeIssue ? runtimeSummary.tone : next ? nextStatus.tone : "success";
    const blockerLabel = currentRuntimeIssue ? runtimeSummary.label : next ? nextStatus.label : "当前无阻断";
    const content = `<div class="home-view scheme-a-home"><div class="home-container">
      <section class="home-status-strip">
        <div class="scenario-identity"><span>当前场景 · ${escapeHtml(scenario.id)}</span><strong>${escapeHtml(scenario.name)}</strong><small>${escapeHtml(state.context.organization)} · ${escapeHtml(selectedNames.join("、"))} · 数据时点 ${escapeHtml(stateDataAsOf())}</small></div>
        <div class="scenario-progress"><div><span>${escapeHtml(progressLabel)}</span><b>${done}/${progressTotal}</b></div><i><i style="width:${percent}%"></i></i><small>${escapeHtml(progressNote)}</small></div>
        <div class="scenario-next ${currentRuntimeIssue ? "runtime-warning" : ""}"><span>${escapeHtml(statusLabel)}</span><strong>${escapeHtml(statusTitle)}</strong><small>${escapeHtml(blockerCopy)}</small></div>
        <div class="home-status-actions">${formalReturn.available ? `<button class="btn" type="button" data-action="return-formal-run">返回正式运行</button>` : ""}<button class="btn primary" type="button" data-route="${escapeHtml(primaryRoute)}">${escapeHtml(primaryLabel)}${icon("arrow", "sm")}</button></div>
      </section>

      <section class="classic-home-frame" data-home-domain="${homeDomain}">
        <div class="classic-architecture">
          <div class="architecture-intro"><div><span>${DATA.brand.en} · 平台能力架构</span><h1>从可信数据到可追溯行动</h1></div><p>数据、语义与行动沿同一证据链协作；首页只汇总进度并把工作带回对应业务模块。</p></div>
          <div class="architecture-cycle" aria-label="平台三大能力域">
            ${homeArchitecturePathMarkup()}
            ${Object.entries(HOME_DOMAINS).map(([key, item]) => `<button class="architecture-node ${key}${homeDomain === key ? " active" : ""}" type="button" data-action="home-domain" data-domain="${key}" aria-pressed="${homeDomain === key}"><span class="node-en">${item.en}</span>${icon(item.icon, "architecture-node-icon")}<span class="node-zh">${item.name}</span></button>`).join("")}
            ${homeCoreGraphicMarkup()}
          </div>
          <div class="architecture-foot">
            <span><b>01 数据治理</b>数据源、数据管道、资产版本与质量。</span>
            <span><b>02 语义问数</b>已发布业务定义、可信问数、报告与证据。</span>
            <span><b>03 行动智能</b>行动申请、人工确认与受控协作。</span>
          </div>
        </div>
        <div class="classic-domain-detail" aria-live="polite">
          <div class="detail-kicker">${domain.kicker}</div><h2>${domain.title}</h2><p>${domain.lead}</p>
          <div class="classic-domain-cards">${domainCards}</div>
          <div class="domain-pager" aria-label="切换能力域">${homeDomainPagerMarkup()}</div>
        </div>
        <nav class="home-chain-track" aria-label="六模块链路入口">${chain}</nav>
      </section>

      <div class="home-summary-grid">
        <section class="panel"><div class="panel-head"><div><h2>当前运行状态</h2><p>历史节点完成度与当前运行健康分开核验。</p></div><span class="status-badge ${escapeHtml(blockerTone)}">${escapeHtml(blockerLabel)}</span></div><div class="home-blocker"><span class="blocker-icon ${!currentRuntimeIssue && !next ? "clear" : ""}">${icon(currentRuntimeIssue || next ? "alert" : "shield")}</span><div><strong>${escapeHtml(currentRuntimeIssue ? runtimeSummary.label : next ? next.title : "当前无待处理事项")}</strong><p>${escapeHtml(blockerCopy)}</p></div><div><button class="btn" type="button" data-action="refresh-source">重新读取</button>${currentRuntimeIssue || next ? `<button class="btn primary" type="button" data-route="${escapeHtml(primaryRoute)}">前往处理</button>` : ""}</div></div></section>
        <section class="panel"><div class="panel-head"><div><h2>最近任务与结果</h2><p>读取各模块最近保存的业务状态。</p></div></div><div class="activity-list compact">${activity}</div></section>
      </div>
      <div class="workspace-note">首页只汇总各业务模块已保存的状态；发布、确认、交办与报告操作均在相应模块内完成。</div>
    </div></div>`;
    renderShell(content, { type: "home", active: "home", key: "home" });
    const homeView = app.querySelector(".home-view");
    const savedScrollTop = Math.max(0, Number(STORE.getScenario?.()?.navigation?.homeScrollTop) || 0);
    if (homeView) {
      window.requestAnimationFrame(() => { homeView.scrollTop = savedScrollTop; });
      homeView.addEventListener("scroll", () => {
        window.clearTimeout(homeScrollSaveTimer);
        homeScrollSaveTimer = window.setTimeout(captureHomePosition, 120);
      }, { passive: true });
    }
  }

  function initialHash(moduleId) {
    const scenario = activeScenario();
    const configured = scenario.moduleOverrides?.[moduleId]?.initialHash;
    if (configured) return configured;
    if (moduleId === "dashboard" && scenario.moduleOverrides?.dashboard?.initialHash) return scenario.moduleOverrides.dashboard.initialHash;
    return { data: "#/resources", ontology: "#modeling", query: "#/ask", decision: "#workbench", agent: "#/agents", report: "#/lifecycle", dashboard: "#/scenes" }[moduleId] || "";
  }

  function migrateDeprecatedModuleHash(moduleId, hash) {
    const scenario = activeScenario();
    if (scenario.id !== "S003") return hash;
    const deprecated = scenario.moduleOverrides?.[moduleId]?.deprecatedInitialHashes || [];
    const matchesDeprecated = deprecated.some((entry) => {
      const pattern = String(entry || "");
      if (!pattern) return false;
      return pattern.endsWith("*") ? String(hash || "").startsWith(pattern.slice(0, -1)) : pattern === hash;
    });
    return matchesDeprecated ? initialHash(moduleId) : hash;
  }

  function frameSource(module) {
    if (requestedModuleTarget?.moduleId === module.id) {
      const target = requestedModuleTarget;
      requestedModuleTarget = null;
      return sourceWithScenarioContext(`${module.source}${migrateDeprecatedModuleHash(module.id, target.hash || initialHash(module.id))}`);
    }
    // A direct S003 top-level module entry must start at the native baseline
    // route; stale framePositions may still point at a previous detail page.
    if (activeScenario().id === "S003" && window.location.hash === `#module/${module.id}`) {
      return sourceWithScenarioContext(`${module.source}${initialHash(module.id)}`);
    }
    const saved = STORE.get().framePositions[module.id];
    const fallback = `${module.source}${initialHash(module.id)}`;
    if (module.id === "dashboard") return sourceWithScenarioContext(fallback);
    if (!saved?.href) return sourceWithScenarioContext(fallback);
    try {
      const approvedUrl = new URL(module.source, window.location.href);
      const savedUrl = new URL(saved.href, window.location.href);
      const approvedDirectory = new URL("./", approvedUrl).pathname;
      const pathnameAllowed = module.id === "decision"
        ? savedUrl.pathname.startsWith(approvedDirectory)
        : savedUrl.pathname === approvedUrl.pathname;
      const migratedHash = migrateDeprecatedModuleHash(module.id, savedUrl.hash);
      if (pathnameAllowed && migratedHash !== savedUrl.hash) {
        STORE.saveFramePosition?.(module.id, {
          scenarioId: activeScenario().id,
          href: `${savedUrl.pathname}${savedUrl.search}${migratedHash}`,
          windowY: 0,
          containerY: 0,
          savedAt: Date.now(),
          migration: "deprecated-s003-private-entry-to-baseline-entry"
        });
      }
      return sourceWithScenarioContext(pathnameAllowed ? `${savedUrl.pathname}${savedUrl.search}${migratedHash}` : fallback);
    } catch (_) {
      return sourceWithScenarioContext(fallback);
    }
  }

  function recordS003ModulePageHealth(moduleKey, value = {}) {
    if (activeScenario().id !== "S003") return;
    const moduleId = S003_MODULE_HEALTH_IDS[moduleKey];
    const context = activeScenarioContext();
    if (!moduleId || !context) return;
    const status = ["healthy", "warning", "blocked", "checking"].includes(value.status) ? value.status : "blocked";
    const scenarioContext = value.scenarioContext || context;
    const sameRun = scenarioContext?.scenarioId === context.scenarioId
      && scenarioContext?.scenarioVersion === context.scenarioVersion
      && scenarioContext?.scenarioRunId === context.scenarioRunId;
    s003ModulePageHealth[moduleId] = {
      ...value,
      moduleId,
      status: sameRun ? status : "blocked",
      detail: sameRun ? (value.detail || "模块页面健康状态已返回。") : "模块页面返回的场景运行身份与统一场景壳不一致。",
      scenarioContext: { ...scenarioContext },
      checkedAt: new Date().toISOString(),
      acceptanceReady: false
    };
  }

  function moduleHealthGetter(frameWindow, moduleKey) {
    if (moduleKey === "ontology") return frameWindow.ONTOLOGY_SCENARIO_EXTENSION?.getHealth;
    if (moduleKey === "data") return frameWindow.DE_SCENARIO_EXTENSION?.getHealth;
    if (moduleKey === "query") return frameWindow.S003IQNativeBridge?.getHealth;
    if (moduleKey === "decision") return frameWindow.S003DecisionAdapter?.getHealth;
    if (moduleKey === "agent") return frameWindow.S003AgentAdapter?.getHealth;
    if (["report", "dashboard"].includes(moduleKey)) return frameWindow.S003ReportModuleHealth;
    return null;
  }

  function inspectS003ModulePageHealth(frame, module) {
    if (activeScenario().id !== "S003" || !frame?.contentWindow) return;
    const moduleKey = module.id === "dashboard" ? "dashboard" : module.id;
    recordS003ModulePageHealth(moduleKey, { status: "checking", detail: "基线模块页面已打开，正在读取场景扩展和运行状态。", scenarioContext: activeScenarioContext() });
    let attempts = 0;
    const poll = () => {
      if (document.getElementById("module-frame") !== frame || activeScenario().id !== "S003") return;
      attempts += 1;
      try {
        const getter = moduleHealthGetter(frame.contentWindow, moduleKey);
        const value = typeof getter === "function" ? getter.call(frame.contentWindow) : null;
        if (value && typeof value === "object") {
          recordS003ModulePageHealth(moduleKey, { ...value, pageUrl: frame.contentWindow.location.href });
          if (value.status !== "checking") {
            // 页面级健康回执完成后立即刷新统一壳摘要；保留现有 iframe，
            // 避免页眉长期停在“检查中”直到用户手工重新读取。
            syncS003HealthChrome();
            if (modalState && ["flow", "step"].includes(modalState.kind)) renderModal();
            return;
          }
        }
      } catch (error) {
        if (attempts >= 80) {
          recordS003ModulePageHealth(moduleKey, { status: "blocked", detail: `模块页面健康读取失败：${error?.message || String(error)}`, scenarioContext: activeScenarioContext() });
          syncS003HealthChrome();
          return;
        }
      }
      if (attempts >= 80) {
        recordS003ModulePageHealth(moduleKey, { status: "blocked", detail: "模块页面已加载，但未在 8 秒内返回可验证的 S003 健康状态。", scenarioContext: activeScenarioContext() });
        syncS003HealthChrome();
        return;
      }
      window.setTimeout(poll, 100);
    };
    poll();
  }

  function renderModule(moduleId) {
    const module = activeModuleById(moduleId);
    if (!module) return renderHome();
    const content = `<div class="module-view"><section class="frame-stage"><iframe id="module-frame" class="module-frame" data-scenario-id="${escapeHtml(activeScenario().id)}" title="${module.name}" src="${escapeHtml(frameSource(module))}" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"></iframe></section></div>`;
    const route = { type: "module", moduleId, active: moduleId, key: `module-${moduleId}` };
    const rebuilt = renderShell(content, route, { preserveFrame: true, frameMode: "module" });
    renderedModuleId = moduleId;
    if (rebuilt) {
      const frame = document.getElementById("module-frame");
      if (frame) frame.addEventListener("load", () => { adaptFrame(frame, module); inspectS003ModulePageHealth(frame, module); });
    }
  }

  function renderDashboard() {
    const reportModule = activeModuleById("report");
    const dashboardModule = { ...reportModule, id: "dashboard", name: "仪表盘" };
    const availability = s003DashboardAvailability();
    const available = availability.available;
    const source = frameSource(dashboardModule);
    const warning = available && availability.warning
      ? `<div class="dashboard-shell-notice warning" role="status">${icon("alert", "sm")}<span>${escapeHtml(availability.warning)}</span></div>`
      : "";
    const frameBody = available
      ? `${warning}<iframe id="module-frame" class="module-frame" data-scenario-id="${escapeHtml(activeScenario().id)}" data-dashboard-mode="${escapeHtml(availability.mode)}" data-dashboard-run-id="${escapeHtml(availability.runId || "")}" title="仪表盘" src="${escapeHtml(source)}" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"></iframe>`
      : `<div class="consume-gate">${icon("chart", "lg")}<h1>暂无可展示的债务风险运行</h1><p>${escapeHtml(availability.reason || "请先形成当前评分运行，或确认上一正式运行和报告仍可定位。")}</p><button class="btn primary" type="button" data-route="#module/report">前往报告中心</button></div>`;
    const content = `<div class="module-view"><section class="frame-stage ${warning ? "dashboard-with-notice" : ""}" data-dashboard-availability="${available ? "available" : "blocked"}" data-dashboard-mode="${escapeHtml(availability.mode)}">${frameBody}</section></div>`;
    const route = { type: "dashboard", active: "dashboard", key: "dashboard" };
    const frameMode = available ? `dashboard-frame-${availability.mode}-${availability.runId || "none"}` : `dashboard-gate-${availability.mode}`;
    const rebuilt = renderShell(content, route, { preserveFrame: available, frameMode });
    renderedModuleId = available ? "dashboard" : null;
    if (rebuilt && available) {
      const frame = document.getElementById("module-frame");
      if (frame) frame.addEventListener("load", () => { adaptFrame(frame, dashboardModule); inspectS003ModulePageHealth(frame, dashboardModule); });
    }
  }

  function render() {
    const route = parseRoute();
    if (route.type === "module") renderModule(route.moduleId);
    else if (route.type === "dashboard") renderDashboard();
    else renderHome();
  }

  function showToast(title, detail, tone = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${tone}`;
    toast.innerHTML = `${icon(tone === "success" ? "check" : tone === "warning" ? "alert" : "close")}<div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></div>`;
    toastRegion.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3600);
  }

  function modalShell({ title, subtitle, iconName, body, footer, large = false }) {
    return `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal ${large ? "large" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-modal-panel>
      <header class="modal-head"><div class="modal-title"><span>${icon(iconName)}</span><div><h2 id="modal-title">${title}</h2><p>${subtitle}</p></div></div><button class="btn icon-only" type="button" data-action="close-modal" aria-label="关闭">${icon("close", "sm")}</button></header>
      <div class="modal-body">${body}</div><footer class="modal-foot">${footer}</footer></section></div>`;
  }

  function flowModal() {
    const next = firstIncomplete();
    const scenario = activeScenario();
    const workflow = activeWorkflow();
    const runtimeSummary = s003HealthSummary();
    const checkpoint = immutableCheckpointProgress();
    const checkpointSubtitle = scenario.id === "S003" && checkpoint.immutable
      ? `历史节点 ${checkpoint.done}/${checkpoint.total} · 当前来源链路 ${completedCount()}/${workflow.length}`
      : `${completedCount()}/${workflow.length} 项来源状态已确认`;
    const formalReturn = s003FormalReturnAvailability();
    const runtimeCard = runtimeSummary
      ? `<div class="runtime-health-card ${escapeHtml(runtimeSummary.tone)}"><div><strong>${escapeHtml(runtimeSummary.label)}</strong><span>${escapeHtml(runtimeSummary.detail)}</span></div><small>acceptanceReady=false</small></div>`
      : "";
    return modalShell({
      title: `${scenario.id} 链路进度`,
      subtitle: `${checkpointSubtitle}${runtimeSummary ? ` · ${runtimeSummary.label}` : ""}`,
      iconName: "layers",
      large: true,
      body: `${runtimeCard}<div class="step-list">${workflow.map((step, index) => {
        const currentState = stepState(step.id);
        const meta = statusMeta(currentState);
        return `<button class="step-row ${currentState === "complete" ? "done" : currentState === "observed" ? "observed" : currentState === "failed" ? "failed" : next?.id === step.id ? "active" : ""}" type="button" data-action="go-flow-step" data-step="${step.id}"><span class="step-index">${currentState === "complete" ? icon("check", "sm") : currentState === "observed" ? icon("link", "sm") : index + 1}</span><span><strong>${step.title}</strong><small>${activeModuleById(step.module)?.name || step.module} · ${escapeHtml(recordDetail(step.id))}</small></span><em>${meta.label}</em></button>`;
      }).join("")}</div>`,
      footer: `<button class="btn" type="button" data-action="refresh-source">重新读取</button><button class="btn" type="button" data-action="close-modal">关闭</button>${formalReturn.available ? `<button class="btn" type="button" data-action="return-formal-run">返回正式运行</button>` : ""}${runtimeSummary?.status !== "healthy" ? `<button class="btn primary" type="button" data-route="${escapeHtml(runtimeSummary.route)}">查看受影响模块</button>` : next ? `<button class="btn primary" type="button" data-action="go-flow-step" data-step="${next.id}">前往下一步</button>` : `<button class="btn primary" type="button" data-route="#dashboard">查看仪表盘</button>`}`
    });
  }

  function resetModal() {
    const scenario = activeScenario();
    const rerun = modalState?.intent === "rerun";
    return modalShell({
      title: rerun ? "快速重跑当前场景" : "重置当前场景",
      subtitle: `${scenario.id} · ${scenario.name}`,
      iconName: "reset",
      body: `<div class="reset-warning">${icon("alert")}<div><strong>${rerun ? "封存当前轮次并创建新的 scenarioRunId" : "只清除当前场景的本地工作记录"}</strong><span>不会影响其他场景，也不会删除源文件、业务文档和既有归档。${rerun ? "确认后返回仪表盘查看新轮次；历史结果仅保留为只读证据，不会被提升为新轮次完成态。" : "完成后将返回当前场景首页，并从数据上传开始重新读取状态。"}</span></div></div>`,
      footer: `<button class="btn" type="button" data-action="close-modal">保留当前状态</button><button class="btn danger" type="button" data-action="confirm-reset">${rerun ? "确认创建新轮次" : `确认重置 ${escapeHtml(scenario.id)}`}</button>`
    });
  }

  function stepModal(stepId) {
    const step = activeStepById()[stepId];
    const record = rawStep(stepId);
    const currentState = stepState(stepId);
    const meta = statusMeta(currentState);
    const sourceRef = record.sourceRecordId || record.recordId || record.sourceRef || record.runId || record.version || "";
    const moduleName = activeModuleById(step.module)?.name || step.module;
    const recovery = record.recovery || record.next || (currentState === "complete" ? "可继续下一步。" : `请在${moduleName}中处理后重新读取状态。`);
    return modalShell({
      title: step.title,
      subtitle: `${moduleName} · ${meta.label}`,
      iconName: meta.icon,
      body: `<div class="task-card ${currentState === "complete" ? "success" : currentState === "failed" || currentState === "blocked" || currentState === "observed" ? "warning" : ""}"><div class="task-card-head"><span>当前状态</span><span class="status-badge ${meta.tone}">${meta.label}</span></div><h3>${step.title}</h3><p>${escapeHtml(recordDetail(stepId))}</p><div class="fact-grid"><div><span>所属模块</span><strong>${moduleName}</strong></div><div><span>状态时间</span><strong>${escapeHtml(recordAt(stepId) || "尚未形成")}</strong></div></div><div class="recovery-copy"><strong>下一步</strong><span>${escapeHtml(recovery)}</span></div>${sourceRef ? `<details class="source-reference"><summary>查看来源定位</summary><code>${escapeHtml(sourceRef)}</code></details>` : ""}</div>`,
      footer: `<button class="btn" type="button" data-action="close-modal">关闭</button><button class="btn primary" type="button" data-action="go-flow-step" data-step="${stepId}">前往${moduleName}</button>`
    });
  }

  function modalMarkup() {
    if (!modalState) return "";
    if (modalState.kind === "flow") return flowModal();
    if (modalState.kind === "reset") return resetModal();
    if (modalState.kind === "step") return stepModal(modalState.stepId);
    return "";
  }

  function renderModal() {
    modalRoot.innerHTML = modalMarkup();
  }

  function openModal(kind, payload = {}) {
    modalState = { kind, ...payload };
    renderModal();
    window.setTimeout(() => modalRoot.querySelector("button")?.focus(), 0);
  }

  function closeModal(clear = true) {
    modalState = null;
    if (clear) modalRoot.replaceChildren();
  }

  function refreshSourceState(withToast = true) {
    STORE.refreshProjection?.();
    if (activeScenario().id === "S003" && window.S003Store?.getRuntimeSnapshot) {
      s003RuntimeSnapshot = window.S003Store.getRuntimeSnapshot();
    }
    render();
    if (modalState) renderModal();
    if (withToast) showToast("状态已更新", "已重新读取六个模块当前保存的状态。", "success");
  }

  function focusModule() {
    const frame = document.getElementById("module-frame");
    if (!frame) return;
    frame.focus();
    try { frame.contentWindow.focus(); } catch (_) {}
    showToast("已进入模块", "请在模块页面完成当前业务操作，完成后在页眉点击“重新读取”。", "success");
  }

  function captureFramePosition() {
    const moduleId = renderedModuleId;
    if (!moduleId) return;
    const frame = document.getElementById("module-frame");
    if (!frame) return;
    try {
      const doc = frame.contentDocument;
      const scroller = doc?.querySelector(".main, .screen-stage, .page-shell, .workspace-main, [data-scroll-container]");
      const href = frame.contentWindow.location.pathname + frame.contentWindow.location.search + frame.contentWindow.location.hash;
      const mapped = shellRouteForUrl(href);
      if (mapped && mapped[2] !== moduleId && !(moduleId === "dashboard" && mapped[2] === "report")) return;
      STORE.saveFramePosition(moduleId, { scenarioId: activeScenario().id, href, windowY: frame.contentWindow.scrollY || 0, containerY: scroller?.scrollTop || 0, savedAt: Date.now() });
    } catch (_) {}
  }

  function captureHomePosition() {
    const homeView = app.querySelector(".home-view");
    if (!homeView) return;
    STORE.saveNavigationContext?.({
      scenarioId: activeScenario().id,
      homeScrollTop: Math.max(0, Math.round(homeView.scrollTop || 0))
    });
  }

  function shellRouteForUrl(url) {
    const routeMap = [
      ["ontology3-homepage-review", "#home", "home"],
      ["data-engineering-prototype-review", "#module/data", "data"],
      ["ontology-management-review", "#module/ontology", "ontology"],
      ["ontology-management-prototype", "#module/ontology", "ontology"],
      ["intelligent-query-prototype", "#module/query", "query"],
      ["decision-center-prototype", "#module/decision", "decision"],
      ["agent-application", "#module/agent", "agent"],
      ["report-center", "#module/report", "report"]
    ];
    let pathname = "";
    try {
      pathname = new URL(String(url || ""), window.location.href).pathname;
    } catch (_) {
      pathname = String(url || "").split(/[?#]/, 1)[0];
    }
    return routeMap.find(([needle]) => pathname.includes(needle)) || null;
  }

  function frameAdapterCss(moduleId) {
    const kind = moduleId;
    const common = `
      html, body { width:100%!important; height:100%!important; }
      body { overflow:hidden!important; }
    `;
    const s003NavigationDedupe = activeScenario().id === "S003" && moduleId !== "dashboard" ? `
      /* The public shell already names the active M01-M06 module. Keep the
         module's real secondary navigation, but remove its duplicate title row. */
      .product-nav > .product-nav-head { display:none!important; }
    ` : "";
    const adapters = {
      data: `
        .app-shell { grid-template-columns:184px minmax(0,1fr)!important; }
        .app-shell > .platform-rail { display:none!important; }
        .app-shell > .product-nav { grid-column:1!important; grid-row:1!important; }
        .app-shell > .app-workspace { grid-column:2!important; grid-row:1!important; grid-template-rows:minmax(0,1fr)!important; }
        .app-workspace > .topbar { display:none!important; }
        @media (max-width:960px) {
          .app-shell { grid-template-columns:58px minmax(0,1fr)!important; }
        }
        @media (max-width:700px) {
          .app-shell { grid-template-columns:minmax(0,1fr)!important; }
          .app-shell > .product-nav { display:none!important; }
          .app-shell > .app-workspace { grid-column:1!important; }
        }
      `,
      ontology: `
        .app-shell { grid-template-columns:184px minmax(0,1fr)!important; }
        .app-shell > .platform-rail { display:none!important; }
        .app-shell > .product-nav { grid-column:1!important; grid-row:1!important; }
        .app-shell > .app-workspace { grid-column:2!important; grid-row:1!important; grid-template-rows:minmax(0,1fr)!important; }
        .app-workspace > .topbar { display:none!important; }
        @media (max-width:960px) {
          .app-shell { grid-template-columns:58px minmax(0,1fr)!important; }
        }
        @media (max-width:700px) {
          .app-shell { grid-template-columns:minmax(0,1fr)!important; }
          .app-shell > .product-nav { display:none!important; }
          .app-shell > .app-workspace { grid-column:1!important; }
        }
      `,
      query: `
        .app-shell { grid-template-columns:184px minmax(0,1fr)!important; grid-template-rows:minmax(0,1fr)!important; }
        .app-shell > .platform-rail { display:none!important; }
        .app-shell > .product-nav { grid-column:1!important; grid-row:1!important; }
        .app-shell > .app-workspace { grid-column:2!important; grid-row:1!important; grid-template-rows:minmax(0,1fr)!important; }
        .app-workspace > .topbar { width:168px!important; min-height:0!important; height:auto!important; padding:0!important; position:fixed!important; left:8px!important; right:auto!important; top:auto!important; bottom:70px!important; z-index:85!important; display:block!important; overflow:visible!important; background:transparent!important; border:0!important; }
        .app-workspace > .topbar > .breadcrumb,
        .app-workspace > .topbar .top-actions > :not(.data-context) { display:none!important; }
        .app-workspace > .topbar .top-actions { display:block!important; }
        .app-workspace > .topbar .data-context { width:168px!important; min-height:34px!important; display:flex!important; justify-content:flex-start!important; box-shadow:0 5px 16px rgba(22,36,54,.13)!important; }
        @media (max-width:700px) {
          .app-shell { grid-template-columns:minmax(0,1fr)!important; grid-template-rows:minmax(0,1fr) 58px!important; }
          .app-shell > .product-nav { grid-column:1!important; grid-row:2!important; }
          .app-shell > .app-workspace { grid-column:1!important; grid-row:1!important; }
          .app-workspace > .topbar { left:8px!important; bottom:66px!important; }
        }
      `,
      decision: `
        .decision-app { grid-template-columns:184px minmax(0,1fr)!important; grid-template-rows:minmax(0,1fr)!important; }
        .decision-app > .app-rail { display:none!important; }
        .decision-app > .product-nav { grid-column:1!important; grid-row:1!important; }
        .decision-app > .product-nav > .product-nav-foot { display:none!important; }
        .decision-app > .app-workspace { grid-column:2!important; grid-row:1!important; grid-template-rows:minmax(0,1fr)!important; }
        .decision-app > .app-workspace > .app-topbar { display:none!important; }
        @media (max-width:760px) {
          .decision-app { grid-template-columns:minmax(0,1fr)!important; grid-template-rows:60px minmax(0,1fr)!important; }
          .decision-app > .product-nav { grid-column:1!important; grid-row:1!important; }
          .decision-app > .app-workspace { grid-column:1!important; grid-row:2!important; }
        }
      `,
      agent: `
        .app-shell { grid-template-columns:188px minmax(0,1fr)!important; }
        .app-shell > .platform-rail { display:none!important; }
        .app-shell > .product-nav { grid-column:1!important; grid-row:1!important; }
        .app-shell > .workspace { grid-column:2!important; grid-row:1!important; grid-template-rows:minmax(0,1fr)!important; }
        .app-shell > .workspace > .topbar { display:none!important; }
        @media (max-width:820px) {
          .app-shell { grid-template-columns:58px minmax(0,1fr)!important; }
        }
        @media (max-width:700px) {
          .app-shell { grid-template-columns:minmax(0,1fr)!important; }
          .app-shell > .product-nav { display:none!important; }
          .app-shell > .workspace { grid-column:1!important; }
        }
      `,
      report: `
        .app-shell { grid-template-columns:190px minmax(0,1fr)!important; }
        .app-shell > .platform-rail { display:none!important; }
        .app-shell > .product-nav { grid-column:1!important; grid-row:1!important; }
        .app-shell > .app-workspace { grid-column:2!important; grid-row:1!important; grid-template-rows:minmax(0,1fr)!important; }
        .app-workspace > .topbar { min-height:0!important; height:0!important; padding:0!important; position:absolute!important; inset:0!important; z-index:90!important; overflow:visible!important; background:transparent!important; border:0!important; }
        .app-workspace > .topbar .breadcrumb,
        .app-workspace > .topbar .topbar-actions { display:none!important; }
        .app-workspace > .topbar .mobile-nav-toggle { display:none!important; }
        .app-workspace > .topbar .persistence-banner { top:8px!important; right:16px!important; display:flex!important; }
        @media (max-width:980px) {
          .app-shell { grid-template-columns:minmax(0,1fr)!important; }
          .app-shell > .app-workspace { grid-column:1!important; }
          .app-shell > .product-nav { grid-column:auto!important; grid-row:auto!important; position:fixed!important; left:0!important; top:0!important; bottom:0!important; width:220px!important; transform:translateX(-110%)!important; }
          .app-shell.nav-open > .product-nav { transform:translateX(0)!important; }
          .app-workspace > .topbar .topbar-left { display:block!important; }
          .app-workspace > .topbar .mobile-nav-toggle { width:38px!important; height:38px!important; position:fixed!important; left:8px!important; top:8px!important; z-index:95!important; display:grid!important; background:#fff!important; border:1px solid #c6d0dc!important; box-shadow:0 5px 16px rgba(22,36,54,.14)!important; }
          .app-workspace > .main:not(.reader-main):not(.external-main) { padding-left:58px!important; }
          .app-workspace .reader-toolbar,
          .app-workspace .external-head { padding-left:58px!important; }
        }
        @media (max-width:700px) {
          .app-shell > .product-nav { width:min(280px,85vw)!important; }
          .app-workspace > .topbar .persistence-banner { right:8px!important; width:calc(100vw - 62px)!important; }
        }
      `,
      dashboard: `
        .app-shell { grid-template-columns:minmax(0,1fr)!important; grid-template-rows:minmax(0,1fr)!important; }
        .app-shell > .platform-rail,
        .app-shell > .product-nav { display:none!important; }
        .app-shell > .app-workspace { grid-column:1!important; grid-row:1!important; grid-template-rows:minmax(0,1fr)!important; }
        .app-workspace > .topbar { display:none!important; }
        .app-workspace > .main,
        .app-workspace .reader-toolbar,
        .app-workspace .external-head { padding-left:initial!important; }
        .app-workspace > .main { min-width:0!important; }
      `
    };
    return `${common}${s003NavigationDedupe}${adapters[kind] || ""}`;
  }

  function installFrameAdapter(doc, moduleId) {
    let style = doc.getElementById("s001-shell-adapter");
    if (!style) {
      style = doc.createElement("style");
      style.id = "s001-shell-adapter";
      doc.head.appendChild(style);
    }
    style.textContent = frameAdapterCss(moduleId);
  }

  function adaptFrame(frame, module) {
    if (frameObserver) frameObserver.disconnect();
    try {
      const href = frame.contentWindow.location.href;
      const mapped = shellRouteForUrl(href);
      if (mapped && mapped[2] !== module.id && !(module.id === "dashboard" && mapped[2] === "report")) {
        navigate(mapped[1]);
        return;
      }
      deliverScenarioContextToFrame(frame, module);
      const doc = frame.contentDocument;
      const frameView = doc?.defaultView;
      const body = doc?.body;
      if (!body) return;
      doc.title = `${module.name} · ${DATA.brand.zh}`;
      installFrameAdapter(doc, module.id);
      const saved = STORE.get().framePositions[module.id];
      if (saved) {
        window.setTimeout(() => {
          try {
            frame.contentWindow.scrollTo(0, saved.windowY || 0);
            const scroller = doc.querySelector(".main, .screen-stage, .page-shell, .workspace-main, [data-scroll-container]");
            if (scroller) scroller.scrollTop = saved.containerY || 0;
          } catch (_) {}
        }, 80);
      }

      const phrases = [
        ["这是评审环境辅助能力，不属于正式产品。重置只清理本轮新增状态并恢复可信基线；正式产品中的运行历史、失败证据和不可变资产版本不得通过此操作删除或回滚。", "重置只清理当前浏览器内的工作记录并恢复初始状态；源文件、业务文档和既有归档不会被删除。"],
        ["仅用于重新评审完整交互流程", "清除本地工作记录并恢复初始状态"],
        ["重置评审工作区状态", "重置工作区状态"],
        ["评审工作区", "当前工作区"],
        ["Action Request", "行动申请"],
        ["Rule 命中", "规则触发"],
        ["规则自动命中", "规则触发"],
        ["规则命中", "规则触发"],
        ["Rule 自动命中", "规则触发"],
        ["Rule 条件", "规则条件"],
        ["Rule 与主体", "规则与主体"],
        ["Rule 与行动", "规则与行动"],
        ["Rule 事实", "规则事实"],
        ["Rule 评估", "规则评估"],
        ["Rule 结果", "规则结果"],
        ["Rule 结论", "规则结论"],
        ["Metric 快照", "指标快照"],
        ["Action Type", "行动类型"],
        ["行动请求", "行动申请"],
        ["C027 当前比较", "与当前数据比较"],
        ["演示数据", "业务数据"],
        ["测试数据", "业务数据"],
        ["演示环境", "业务工作区"],
        ["评审环境", "业务工作区"],
        ["交互原型", "业务工作台"],
        ["原型夹具", "预置配置"],
        ["非真实结果", "待发布结果"],
        ["设计说明", "业务说明"],
        ["设计目标", "业务目标"],
        ["一期方案", "当前范围"],
        ["内部建议", "操作建议"]
      ];
      const replaceKnownText = (value) => {
        let next = String(value || "").replace(/Ontology\s*3\.0/gi, DATA.brand.zh).replace(/ontology3\.0/gi, DATA.brand.zh);
        if (next.trim() === "O3") next = next.replace("O3", "OF");
        phrases.forEach(([from, to]) => { next = next.replaceAll(from, to); });
        return next;
      };
      const scrubNode = (root) => {
        const walker = doc.createTreeWalker(root, frameView.NodeFilter?.SHOW_TEXT || 4);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach((node) => {
          const parent = node.parentElement;
          if (!parent || ["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE"].includes(parent.tagName)) return;
          const next = replaceKnownText(node.nodeValue);
          if (next !== node.nodeValue) node.nodeValue = next;
        });
        if (root.nodeType === 1) {
          [root, ...root.querySelectorAll("[aria-label], [title], [placeholder]")].forEach((element) => {
            ["aria-label", "title", "placeholder"].forEach((name) => {
              if (!element.hasAttribute?.(name)) return;
              const current = element.getAttribute(name);
              const next = replaceKnownText(current);
              if (next !== current) element.setAttribute(name, next);
            });
          });
        }
      };
      scrubNode(body);

      doc.addEventListener("click", (event) => {
        const anchor = event.target.closest?.("a[href]");
        if (anchor) {
          const target = shellRouteForUrl(anchor.href);
          if (target && target[2] !== module.id && !(module.id === "dashboard" && target[2] === "report")) {
            event.preventDefault();
            navigate(target[1]);
            return;
          }
        }
        [0, 240, 720].forEach((delay) => window.setTimeout(() => {
          try { if (doc.body?.isConnected) scrubNode(doc.body); } catch (_) {}
        }, delay));
        window.clearTimeout(frameSaveTimer);
        frameSaveTimer = window.setTimeout(() => { captureFramePosition(); refreshSourceState(false); }, 220);
      }, true);
      doc.addEventListener("scroll", () => {
        window.clearTimeout(frameSaveTimer);
        frameSaveTimer = window.setTimeout(captureFramePosition, 180);
      }, true);
      refreshSourceState(false);
    } catch (_) {
      showToast("模块页面已打开", "当前页面仍可使用统一导航和返回。", "warning");
    }
  }

  document.addEventListener("click", async (event) => {
    const routeButton = event.target.closest("[data-route]");
    if (routeButton) { navigate(routeButton.dataset.route); return; }
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    const action = actionButton.dataset.action;
    const stepId = actionButton.dataset.step;
    if (action === "open-flow") openModal("flow");
    if (action === "open-reset") openModal("reset");
    if (action === "close-modal") closeModal();
    if (action === "backdrop-close" && event.target === actionButton) closeModal();
    if (action === "confirm-reset") {
      const scenario = activeScenario();
      const rerun = modalState?.intent === "rerun";
      captureFramePosition();
      closeModal();
      if (scenario.id === "S003" && window.S003Store) {
        try {
          showToast(rerun ? "S003 正在快速重跑" : "S003 正在创建新轮次", rerun ? "正在锁定 Published 模型与企业因子输入，并形成隔离的新 scenarioRunId。" : "正在封存旧轮次并初始化新上下文。", "info");
          const runtime = await ensureS003Runtime();
          const runOrContext = rerun ? await runtime.quickRerun() : await runtime.resetCurrentScenario();
          const generatedContext = rerun ? runOrContext?.scenarioContext : runOrContext;
          if (!generatedContext) throw new Error(rerun ? "快速重跑未形成新运行结果。" : "场景重置未形成新上下文。");
          const generatedSnapshot = runtime.getRuntimeSnapshot?.();
          assertS003NoHistoricalSideEffectReplay(generatedSnapshot, generatedContext, rerun ? "快速重跑" : "场景重置");
          let shellContext = generatedContext;
          if (rerun) {
            // 快速重跑产物保留为 M06 可切换的隔离预览；六模块公共 C033
            // 继续使用最近正式运行。这样既不把浏览器预览伪装成 Published
            // 事实，也不会让预览轮次阻断问数、决策、Agent 与正式报告。
            const formalRun = runtime.returnToLastSuccessfulRun();
            shellContext = formalRun?.scenarioContext || null;
            if (!shellContext) throw new Error("快速重跑完成，但当前正式运行未能恢复。");
            s003RuntimeSnapshot = runtime.getRuntimeSnapshot?.() || generatedSnapshot || s003RuntimeSnapshot;
            STORE.adoptScenarioContext?.("S003", shellContext, { reason: "快速重跑仅作为驾驶舱预览，公共模块继续使用最近正式运行" });
            const previewRunId = encodeURIComponent(generatedContext.scenarioRunId);
            requestedModuleTarget = { moduleId: "dashboard", hash: `#/dashboard/s003?runId=${previewRunId}` };
          } else {
            s003RuntimeSnapshot = generatedSnapshot || s003RuntimeSnapshot;
            STORE.adoptScenarioContext?.("S003", shellContext, { reason: "场景运行服务创建新轮次" });
          }
          history.replaceState(scenarioHistoryState(scenario.id, 0, shellContext), "", scenarioUrl(scenario.id, rerun ? "#dashboard" : "#home", shellContext));
          renderedModuleId = null;
          render();
          showToast(rerun ? "S003 本次评估已完成" : "S003 新轮次已创建", rerun ? `已形成 ${generatedContext.scenarioRunId} 的评分预览；驾驶舱已切换查看，问数、决策、Agent 与正式报告继续使用当前正式批次。` : "原轮次与证据保持不变；历史行动申请、通知和待办未重放。", "success");
        } catch (error) {
          if (rerun) requestedModuleTarget = { moduleId: "dashboard", hash: "#/dashboard/s003" };
          history.replaceState({ s001Shell: true, scenarioId: scenario.id, s001Depth: 0 }, "", scenarioUrl(scenario.id, "#dashboard"));
          renderedModuleId = null;
          render();
          showToast("S003 场景操作未完成", error?.message || String(error), "warning");
        }
      } else {
        history.replaceState({ s001Shell: true, scenarioId: scenario.id, s001Depth: 0 }, "", scenarioUrl(scenario.id, rerun ? "#module/data" : "#home"));
        renderedModuleId = null;
        if (typeof STORE.resetCurrentScenario === "function") STORE.resetCurrentScenario();
        else STORE.resetAll?.();
        render();
        showToast(rerun ? `${scenario.id} 新轮次已创建` : `${scenario.id} 已重置`, rerun ? "原轮次已封存；请在数据工程确认本轮数据与企业因子输入。" : "已返回当前场景首页，可以从数据上传重新开始。", "success");
      }
    }
    if (action === "refresh-source") refreshSourceState(true);
    if (action === "focus-module") focusModule();
    if (action === "inspect-step") openModal("step", { stepId });
    if (action === "go-flow-step") { closeModal(); navigate(`#module/${activeStepById()[stepId].module}`); }
    if (action === "return-context") returnToPrevious();
    if (action === "return-formal-run") {
      if (activeScenario().id !== "S003") return;
      try {
        const runtime = await ensureS003Runtime();
        const run = runtime.returnToLastSuccessfulRun();
        const nextSnapshot = runtime.getRuntimeSnapshot?.() || null;
        const nextContext = run?.scenarioContext || nextSnapshot?.context || null;
        if (!nextContext) throw new Error("正式成功运行未返回完整场景身份。");
        s003RuntimeSnapshot = nextSnapshot || s003RuntimeSnapshot;
        STORE.adoptScenarioContext?.("S003", nextContext, { reason: "用户返回上一正式成功运行" });
        closeModal();
        requestedModuleTarget = { moduleId: "dashboard", hash: "#/dashboard/s003" };
        history.replaceState(scenarioHistoryState("S003", 0, nextContext), "", scenarioUrl("S003", "#dashboard", nextContext));
        renderedModuleId = null;
        render();
        showToast("已返回正式成功运行", `${nextContext.scenarioRunId} 已恢复为当前只读正式运行；未执行重评，也未重放历史副作用。`, "success");
      } catch (error) {
        showToast("未能返回正式运行", error?.message || String(error), "warning");
      }
    }
    if (action === "toggle-navigation") STORE.toggleNavigation();
    if (action === "home-domain") selectHomeDomain(actionButton.dataset.domain || "foundation");
    if (action === "reload-frame") {
      const frame = document.getElementById("module-frame");
      if (frame) frame.contentWindow.location.reload();
    }
  });

  document.addEventListener("change", (event) => {
    const selector = event.target.closest?.('[data-action="switch-scenario"]');
    if (!selector || typeof STORE.setActiveScenario !== "function") return;
    captureFramePosition();
    const nextScenario = DATA.scenarioById?.[selector.value];
    if (!nextScenario?.enabled) return;
    STORE.setActiveScenario(nextScenario.id);
    const nextContext = STORE.getScenarioContext?.(nextScenario.id) || STORE.getScenario?.(nextScenario.id)?.scenarioContext || null;
    history.replaceState(scenarioHistoryState(nextScenario.id, 0, nextContext), "", scenarioUrl(nextScenario.id, "#home", nextContext));
    closeModal();
    render();
    if (nextScenario.id === "S003") {
      ensureS003Runtime().then(() => {
        s003RuntimeSnapshot = window.S003Store.getRuntimeSnapshot?.() || null;
        render();
      }).catch((error) => showToast("正在准备本次评估结果", s003UserFacingCopy(error?.message || "请稍候刷新页面。"), "warning"));
    }
  });

  window.addEventListener("popstate", (event) => {
    captureFramePosition();
    const targetScenarioId = event.state?.scenarioId;
    if (targetScenarioId && targetScenarioId !== STORE.get().activeScenarioId) STORE.setActiveScenario?.(targetScenarioId);
    const context = activeScenarioContext();
    if (activeScenario().id === "S003" && context?.scenarioRunId && event.state?.scenarioRunId !== context.scenarioRunId) {
      history.replaceState(scenarioHistoryState("S003", Number(event.state?.s001Depth || 0), context), "", scenarioUrl("S003", window.location.hash || "#home", context));
    }
    closeModal();
    render();
  });
  window.addEventListener("hashchange", () => { closeModal(); render(); });
  window.addEventListener("beforeunload", () => {
    captureFramePosition();
    captureHomePosition();
  });
  window.addEventListener("storage", (event) => {
    if (!STORE.MODULE_STORAGE_KEYS?.includes(event.key)) return;
    window.clearTimeout(storageRefreshTimer);
    storageRefreshTimer = window.setTimeout(() => refreshSourceState(false), 120);
  });
  window.addEventListener("s001:state", () => {
    if (suppressHomeDomainStateRender && parseRoute().type === "home") return;
    render();
    if (modalState && ["flow", "step"].includes(modalState.kind)) renderModal();
  });
  window.addEventListener("s001:scenario-context", () => {
    const frame = document.getElementById("module-frame");
    const module = renderedModuleId === "dashboard"
      ? { ...activeModuleById("report"), id: "dashboard" }
      : activeModuleById(renderedModuleId);
    if (frame && module) deliverScenarioContextToFrame(frame, module);
  });
  window.addEventListener("message", async (event) => {
    if (event.origin !== window.location.origin || event.data?.channel !== SCENARIO_SHELL_CHANNEL) return;
    const frame = document.getElementById("module-frame");
    if (!frame || event.source !== frame.contentWindow) return;
    const context = activeScenarioContext();
    const message = event.data;
    const sameRun = message.scenarioId === context?.scenarioId
      && message.scenarioVersion === context?.scenarioVersion
      && message.scenarioRunId === context?.scenarioRunId;
    if (!sameRun) {
      showToast("场景运行身份不一致", "已拒绝模块发起的场景操作；请重新读取统一工作台上下文。", "warning");
      if (message.requestId) postScenarioShellResponse(event, message, false, null, "场景运行身份不一致");
      return;
    }
    if (message.operation === "navigateScenarioModule") {
      const moduleId = String(message.moduleId || message.payload?.moduleId || "");
      const allowed = new Set(["data", "ontology", "query", "decision", "agent", "report"]);
      if (!allowed.has(moduleId)) {
        if (message.requestId) postScenarioShellResponse(event, message, false, null, "目标模块不在 M01—M06 范围内");
        return;
      }
      const requestedHash = message.hash || message.payload?.hash;
      const hash = typeof requestedHash === "string" && requestedHash.startsWith("#") ? requestedHash : initialHash(moduleId);
      const currentFrame = document.getElementById("module-frame");
      if (renderedModuleId === moduleId && currentFrame?.contentWindow) {
        currentFrame.contentWindow.location.hash = hash;
        requestedModuleTarget = null;
      } else {
        requestedModuleTarget = { moduleId, hash };
        navigate(`#module/${moduleId}`);
      }
      if (message.requestId) postScenarioShellResponse(event, message, true, { moduleId, hash }, null);
      return;
    }
    if (message.operation === "openS003DashboardCandidate") {
      const candidateId = String(message.candidateId || message.payload?.candidateId || "");
      const enterpriseId = String(message.enterpriseId || message.payload?.enterpriseId || "");
      const query = new URLSearchParams();
      if (candidateId) query.set("candidateId", candidateId);
      if (enterpriseId) query.set("enterpriseId", enterpriseId);
      requestedModuleTarget = { moduleId: "dashboard", hash: `#/dashboard/s003${query.size ? `?${query}` : ""}` };
      navigate("#dashboard");
      if (message.requestId) postScenarioShellResponse(event, message, true, { candidateId, enterpriseId, route: "#dashboard" }, null);
      return;
    }
    if ([
      "getS003RuntimeSnapshot",
      "getS003PublishedResources",
      "getS003FactorInputs",
      "saveS003ConfigurationDraft",
      "validateS003Configuration",
      "publishS003Configuration",
      "resetS003Configuration",
      "saveS003FactorInputs",
      "validateS003FactorInputs",
      "publishS003FactorInputs"
    ].includes(message.operation)) {
      try {
        const result = await executeS003RuntimeOperation(message);
        postScenarioShellResponse(event, message, true, result, null);
      } catch (error) {
        postScenarioShellResponse(event, message, false, null, error?.message || String(error));
      }
      return;
    }
    if (message.operation === "requestScenarioRestore") {
      try {
        if (activeScenario().id !== "S003" || !activeScenario().featureFlags?.checkpointRead) {
          throw new Error("当前场景未启用 Checkpoint 克隆恢复。");
        }
        if (message.mode && message.mode !== "clone-restore") {
          throw new Error("S003 只允许通过 clone-restore 从快照恢复。");
        }
        const runtime = await ensureS003Runtime();
        const entry = (runtime.getBundle?.().checkpoints || []).find(function (item) {
          return item?.manifest?.checkpointId === message.checkpointId;
        });
        if (!entry?.code || !entry.manifest) throw new Error("请求的不可变 Checkpoint 无法定位。");
        const sourceRunId = entry.manifest.scenarioContext?.scenarioRunId || null;
        if (message.sourceScenarioRunId && message.sourceScenarioRunId !== sourceRunId) {
          throw new Error("Checkpoint 来源 scenarioRunId 与恢复请求不一致。");
        }
        const operation = await runtime.cloneRestore(entry.code);
        const nextContext = operation?.context;
        if (!nextContext) throw new Error("克隆恢复未形成新的隔离 scenarioRunId。");
        const nextSnapshot = runtime.getRuntimeSnapshot?.();
        assertS003NoHistoricalSideEffectReplay(nextSnapshot, nextContext, "Checkpoint 克隆恢复");
        s003RuntimeSnapshot = nextSnapshot || s003RuntimeSnapshot;
        STORE.adoptScenarioContext?.("S003", nextContext, { reason: `从 ${entry.code} 克隆恢复` });
        requestedModuleTarget = { moduleId: "dashboard", hash: "#/dashboard/s003" };
        history.replaceState(scenarioHistoryState("S003", 0, nextContext), "", scenarioUrl("S003", "#dashboard", nextContext));
        renderedModuleId = null;
        render();
        showToast("S003 已完成克隆恢复", `${entry.code} 已形成新运行 ${nextContext.scenarioRunId}；原 ${sourceRunId} 与历史证据保持只读，Action Request、通知和待办未重放。`, "success");
        if (message.requestId) postScenarioShellResponse(event, message, true, { code: entry.code, operation, context: nextContext }, null);
      } catch (error) {
        showToast("S003 克隆恢复未完成", error?.message || String(error), "warning");
        if (message.requestId) postScenarioShellResponse(event, message, false, null, error?.message || String(error));
      }
      return;
    }
    if (message.operation === "requestScenarioRerun") {
      if (!activeScenario().featureFlags?.fastRerun) {
        showToast("当前场景未启用快速重跑", "请按链路进度进入相应模块处理。", "warning");
        return;
      }
      openModal("reset", { intent: "rerun", sourceModule: message.sourceModule || null });
    }
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && modalState) closeModal(); });

  const requestedScenarioParams = new URLSearchParams(window.location.search);
  const requestedScenarioId = requestedScenarioParams.get("scenarioId");
  if (requestedScenarioId && requestedScenarioId !== STORE.get().activeScenarioId && DATA.scenarioById?.[requestedScenarioId]?.enabled) {
    STORE.setActiveScenario?.(requestedScenarioId);
  }
  if (requestedScenarioId === "S003") {
    const requestedScenarioContext = {
      scenarioId: "S003",
      scenarioVersion: requestedScenarioParams.get("scenarioVersion"),
      scenarioRunId: requestedScenarioParams.get("scenarioRunId"),
      formedAt: requestedScenarioParams.get("formedAt")
        || requestedScenarioParams.get("contextCreatedAt")
        || requestedScenarioParams.get("scenarioFormedAt"),
      status: requestedScenarioParams.get("status")
        || requestedScenarioParams.get("contextStatus")
        || requestedScenarioParams.get("scenarioStatus")
    };
    const validation = STORE.FOUNDATION?.validateScenarioContext?.(requestedScenarioContext);
    const current = STORE.getScenarioContext?.("S003");
    if (validation?.ok && current?.scenarioRunId !== requestedScenarioContext.scenarioRunId) {
      STORE.adoptScenarioContext?.("S003", requestedScenarioContext, {
        reason: "采用显式 S003 深链运行身份；保留原运行历史，不以浏览器旧状态覆盖当前正式入口"
      });
    }
  }
  const initialContext = activeScenarioContext();
  if (!window.location.hash) history.replaceState(scenarioHistoryState(activeScenario().id, 0, initialContext), "", scenarioUrl(activeScenario().id, "#home", initialContext));
  else if (!history.state?.s001Shell) history.replaceState(scenarioHistoryState(activeScenario().id, 0, initialContext), "", scenarioUrl(activeScenario().id, window.location.hash, initialContext));
  STORE.refreshProjection?.();
  if (activeScenario().id === "S001") {
    reconcileOntologyContracts().then((updated) => {
      if (updated) refreshSourceState(false);
    });
  }
  if (activeScenario().id === "S003") {
    ensureS003Runtime().then(() => {
      s003RuntimeSnapshot = window.S003Store.getRuntimeSnapshot?.() || null;
      const route = parseRoute();
      const activeRun = s003RuntimeSnapshot?.activeRun || null;
      const formalRun = s003RuntimeSnapshot?.lastSuccessfulRun || null;
      const shouldRestoreFormalEntry = Boolean(
        activeRun?.projectionOnly === true
        && formalRun?.authorityMode === "published-evidence"
        && formalRun?.projectionOnly !== true
        && (route.type !== "module" || !["data", "ontology"].includes(route.moduleId))
      );
      if (shouldRestoreFormalEntry) {
        const previewRunId = activeRun.runId;
        const restored = window.S003Store.returnToLastSuccessfulRun();
        const formalContext = restored?.scenarioContext || null;
        if (formalContext) {
          s003RuntimeSnapshot = window.S003Store.getRuntimeSnapshot?.() || s003RuntimeSnapshot;
          STORE.adoptScenarioContext?.("S003", formalContext, { reason: "演示入口使用正式运行；最近重跑保留为驾驶舱可切换预览" });
          if (route.type === "dashboard" && previewRunId) {
            requestedModuleTarget = { moduleId: "dashboard", hash: `#/dashboard/s003?runId=${encodeURIComponent(previewRunId)}` };
          }
          const currentRoute = window.location.hash || "#home";
          history.replaceState(scenarioHistoryState("S003", Number(history.state?.s001Depth || 0), formalContext), "", scenarioUrl("S003", currentRoute, formalContext));
          renderedModuleId = null;
        }
      }
      render();
    }).catch((error) => {
      s003RuntimeSnapshot = window.S003Store?.getRuntimeSnapshot?.() || { ready: false, fatalError: error?.message || String(error) };
      render();
      showToast("正在准备本次评估结果", s003UserFacingCopy(error?.message || "请稍候刷新页面。"), "warning");
    });
  }
  render();
})();
