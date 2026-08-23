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
  let ontologyContractReplayKey = null;
  let deliveredOntologyContractKey = null;
  let ontologyContractReplayTimer = null;
  let resetModuleRoutes = new Set();

  const IQ_STATE_KEY = "ontology3.iq.review.conversation.v2";
  const C008_PROJECTION_KEY = "ontology3-c008-authoritative-projection-v1";
  const HANDOFF_CHANNEL = STORE.HANDOFF_CHANNEL || "ontology3.0-s001-handoff-v1";

  const HOME_DOMAIN_ORDER = ["foundation", "intelligence", "action"];
  const HOME_DOMAINS = {
    foundation: {
      order: "01", en: "可信数据", name: "数据治理", icon: "database", modules: ["data", "ontology"],
      kicker: "数据治理 · 可信底座", title: "把持续变化的数据，治理成稳定、可追溯的业务基础",
      lead: "数据工程负责来源、管道、数据资产与质量；本体管理负责业务对象、关系、指标、规则和行动类型。两者共同形成可被后续环节稳定引用的业务基础。",
      scope: "资产与定义", flow: "数据治理 → 语义问数", flowDetail: "可信数据资产与已发布业务定义进入问数、报告和核验。",
      core: "数据治理 · 语义问数 · 行动智能"
    },
    intelligence: {
      order: "02", en: "可信理解", name: "语义问数", icon: "insight", modules: ["query", "report"],
      kicker: "语义问数 · 可信理解", title: "让每次问数与报告都能回到明确的数据和业务定义",
      lead: "智能问数在固定上下文中回答问题；报告中心负责确定性核验、正式发布和报告伴读。答案与报告始终保留版本与来源。",
      scope: "问数与报告", flow: "语义问数 → 行动智能", flowDetail: "带证据的答案、报告和规则结果形成受控行动申请。",
      core: "数据治理 · 语义问数 · 行动智能"
    },
    action: {
      order: "03", en: "受控协作", name: "行动智能", icon: "action", modules: ["decision", "agent"],
      kicker: "行动智能 · 受控闭环", title: "让洞察进入人的判断，再形成清晰、可追溯的行动",
      lead: "Agent 应用解释固定证据；决策中心承接行动申请、人工确认和负责人待办。任何环节都不能绕过人工确认直接形成待办。",
      scope: "决策与协作", flow: "行动智能 → 数据治理", flowDetail: "确认、待办与执行结果作为只读证据回流，不改写历史事实。",
      core: "数据治理 · 语义问数 · 行动智能"
    }
  };

  const icons = {
    home: '<path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    network: '<circle cx="12" cy="5" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m10.7 7.2-3.4 8.6M13.3 7.2l3.4 8.6M8.5 18h7"/>',
    brainCircuit: '<path class="brain-mesh-outline" d="M12 4.35C10.92 2.72 8.42 2.35 6.92 3.78 4.76 3.6 3.14 5.67 3.82 7.7 2.18 8.78 2.28 11.18 3.72 12.5 2.62 14.5 3.8 16.96 5.93 17.52 6.22 20.2 9.42 21.38 11.28 19.72c.45-.4.72-.9.72-1.5 0 .6.27 1.1.72 1.5 1.86 1.66 5.06.48 5.35-2.2 2.13-.56 3.31-3.02 2.21-5.02 1.44-1.32 1.54-3.72-.1-4.8.68-2.03-.94-4.1-3.1-3.92-1.5-1.43-4-1.06-5.08.57Z"/><path class="brain-mesh-edge" d="M12 4.35 8.65 4.6 6.05 6.15 9.4 7.3 12 8.95 14.6 7.3 17.95 6.15 15.35 4.6 12 4.35M6.05 6.15 4.78 9.05 7.35 10.35 9.4 7.3M4.78 9.05 5.55 13.55 7.35 10.35 9.95 11.7 12 8.95M5.55 13.55 8.65 15.55 9.95 11.7 12 14.05 10.25 17.55 8.65 15.55M5.55 13.55 6.02 16.35 8.65 15.55M10.25 17.55 12 19.25 13.75 17.55 12 14.05M12 8.95 12 14.05M17.95 6.15 19.22 9.05 16.65 10.35 14.6 7.3M19.22 9.05 18.45 13.55 16.65 10.35 14.05 11.7 12 8.95M18.45 13.55 15.35 15.55 14.05 11.7 12 14.05 13.75 17.55 15.35 15.55M18.45 13.55 17.98 16.35 15.35 15.55M7.35 10.35 12 8.95 16.65 10.35M8.65 15.55 12 14.05 15.35 15.55"/><path class="brain-mesh-seam" d="M12 4.35v15"/><path class="brain-mesh-signal signal-a" pathLength="1" d="M4.78 9.05 7.35 10.35 9.95 11.7 12 14.05 13.75 17.55"/><path class="brain-mesh-signal signal-b" pathLength="1" d="M17.95 6.15 14.6 7.3 12 8.95 9.95 11.7 8.65 15.55"/><circle class="brain-mesh-node phase-a node-key" cx="12" cy="4.35" r=".48"/><circle class="brain-mesh-node phase-b" cx="8.65" cy="4.6" r=".34"/><circle class="brain-mesh-node phase-c" cx="6.05" cy="6.15" r=".38"/><circle class="brain-mesh-node phase-d" cx="9.4" cy="7.3" r=".34"/><circle class="brain-mesh-node phase-b" cx="4.78" cy="9.05" r=".4"/><circle class="brain-mesh-node phase-a" cx="7.35" cy="10.35" r=".34"/><circle class="brain-mesh-node phase-c" cx="9.95" cy="11.7" r=".38"/><circle class="brain-mesh-node phase-d" cx="5.55" cy="13.55" r=".38"/><circle class="brain-mesh-node phase-b" cx="6.02" cy="16.35" r=".34"/><circle class="brain-mesh-node phase-a" cx="8.65" cy="15.55" r=".4"/><circle class="brain-mesh-node phase-c" cx="10.25" cy="17.55" r=".34"/><circle class="brain-mesh-node phase-d node-key" cx="12" cy="8.95" r=".46"/><circle class="brain-mesh-node phase-a node-key" cx="12" cy="14.05" r=".46"/><circle class="brain-mesh-node phase-c node-key" cx="12" cy="19.25" r=".48"/><circle class="brain-mesh-node phase-b" cx="15.35" cy="4.6" r=".34"/><circle class="brain-mesh-node phase-a" cx="17.95" cy="6.15" r=".38"/><circle class="brain-mesh-node phase-d" cx="14.6" cy="7.3" r=".34"/><circle class="brain-mesh-node phase-c" cx="19.22" cy="9.05" r=".4"/><circle class="brain-mesh-node phase-b" cx="16.65" cy="10.35" r=".34"/><circle class="brain-mesh-node phase-d" cx="14.05" cy="11.7" r=".38"/><circle class="brain-mesh-node phase-a" cx="18.45" cy="13.55" r=".38"/><circle class="brain-mesh-node phase-c" cx="17.98" cy="16.35" r=".34"/><circle class="brain-mesh-node phase-d" cx="15.35" cy="15.55" r=".4"/><circle class="brain-mesh-node phase-b" cx="13.75" cy="17.55" r=".34"/>',
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

  function portfolioWorkflow() {
    return window.OFW_COMPOSITE_REGISTRY?.workflow || null;
  }

  function portfolioRuns() {
    const registry = window.OFW_COMPOSITE_REGISTRY;
    if (!registry?.scenes?.length || !registry.workflow) return [];
    return registry.scenes.map((scene) => ({ ...scene, ...(registry.workflow[scene.scenarioId] || {}) }));
  }

  function allPortfolioRunsComplete() {
    const runs = portfolioRuns();
    return runs.length === 4 && runs.every((run) => Number(run.completed) === Number(run.total) && run.status === "completed");
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
    if (allPortfolioRunsComplete()) return true;
    return typeof STORE.isComplete === "function" ? Boolean(STORE.isComplete(stepId)) : stepState(stepId) === "complete";
  }

  function completedCount() {
    if (allPortfolioRunsComplete()) return DATA.workflow.length;
    return DATA.workflow.filter((step) => isComplete(step.id)).length;
  }

  function firstIncomplete() {
    if (allPortfolioRunsComplete()) return null;
    const candidate = STORE.firstIncomplete?.();
    if (typeof candidate === "string") return DATA.stepById[candidate] || null;
    if (candidate?.id) return DATA.stepById[candidate.id] || candidate;
    return DATA.workflow.find((step) => !isComplete(step.id)) || null;
  }

  function moduleProgress(module) {
    if (allPortfolioRunsComplete()) return { done: module.steps.length, observed: 0, total: module.steps.length, complete: true };
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
    const step = DATA.stepById[stepId];
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

  function activeScenarioContext() {
    return STORE.getScenarioContext?.(activeScenario().id) || STORE.getScenario?.(activeScenario().id)?.scenarioContext || null;
  }

  function sourceWithScenarioContext(source) {
    try {
      const url = new URL(source, window.location.href);
      const outerScenarioId = new URLSearchParams(window.location.search).get("scenarioId");
      const sourceScenarioId = url.searchParams.get("scenarioId");
      const requestedScenarioId = sourceScenarioId || outerScenarioId;
      const requestedScene = requestedScenarioId && window.OFW_COMPOSITE_REGISTRY?.scenes?.find((scene) => scene.scenarioId === requestedScenarioId);
      const activeContext = activeScenarioContext();
      const sourceFormedAt = url.searchParams.get("formedAt") || url.searchParams.get("contextCreatedAt") || url.searchParams.get("scenarioFormedAt");
      const formedAtByScenario = {
        S001: "2026-08-16T08:17:48.567Z",
        S002: "2026-08-15T08:00:00.000Z",
        S003: "2026-08-17T16:30:00.000Z",
        S004: "2026-08-15T23:30:00.000Z"
      };
      const context = requestedScene
        ? {
            scenarioId: requestedScene.scenarioId,
            scenarioVersion: requestedScene.scenarioVersion,
            scenarioRunId: requestedScene.scenarioRunId,
            formedAt: sourceFormedAt || (activeContext?.scenarioId === requestedScene.scenarioId ? activeContext.formedAt : null) || formedAtByScenario[requestedScene.scenarioId],
            status: url.searchParams.get("status") || (activeContext?.scenarioId === requestedScene.scenarioId ? activeContext.status : null) || "active"
          }
        : activeContext;
      if (!context) return source;
      if (url.pathname.endsWith("/agent-application/Agent%E5%BA%94%E7%94%A8.html") || url.pathname.endsWith("/agent-application/Agent应用.html")) {
        url.searchParams.set("v", "20260824-08");
        url.searchParams.set("prototypeBuild", "20260814-17");
      }
      if (url.pathname.endsWith("/report-center/review-lifecycle/index.html")) {
        url.searchParams.set("v", "20260824-12");
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
        scenarioStatus: context.status
      };
      Object.entries(fields).forEach(([key, value]) => url.searchParams.set(key, value));
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
    const module = DATA.moduleById.ontology;
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

  async function getOntologyReviewOwner() {
    const frame = await ensureOntologyBridgeFrame();
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const owner = frame?.contentWindow?.ontologyReview;
      if (owner && typeof owner.candidateContext === "function" && typeof owner.deliverValidationRequirement === "function" && typeof owner.deliverValidationReference === "function") return owner;
      await new Promise(resolve => window.setTimeout(resolve, 80));
    }
    throw new Error("本体合同桥接收入口尚未就绪");
  }

  window.S001_ONTOLOGY_OWNER_BRIDGE = Object.freeze({
    getOwner: getOntologyReviewOwner
  });

  function currentC009Record() {
    const queryState = readStoredObject(IQ_STATE_KEY);
    const config = queryState?.activeConfig;
    const validation = config?.c009Validation;
    const envelope = validation?.contractEnvelope;
    const scenario = activeScenarioContext();
    const envelopeScenario = envelope?.scenarioContext;
    const binding = envelope?.publishedOntologyBinding;
    const sameScenario = envelopeScenario?.scenarioId === scenario?.scenarioId
      && envelopeScenario?.scenarioVersion === scenario?.scenarioVersion
      && envelopeScenario?.scenarioRunId === scenario?.scenarioRunId;
    const complete = Boolean(
      envelope?.sourceModule === "智能问数" && envelope.contractCode === "C009" && envelope.consumer === "智能问数" &&
      envelope.configId === config?.id && envelope.configVersion === config?.version && envelope.promptVersion === config?.promptVersion &&
      Array.isArray(envelope.skillVersions) && envelope.skillVersions.length &&
      Array.isArray(envelope.toolVersions) && envelope.toolVersions.length &&
      envelope.resourceWhitelist?.version === config?.whitelistVersion && Array.isArray(envelope.resourceWhitelist?.resourceIds) && envelope.resourceWhitelist.resourceIds.length &&
      binding?.semanticVersionId === validation?.versionId && binding?.semanticVersion === validation?.semanticVersion && binding?.dataVersion === validation?.dataVersion &&
      envelope.effectiveTime?.from && envelope.checkedAt && envelope.evidenceLocator && envelope.configFingerprint === validation?.configFingerprint &&
      sameScenario
    );
    if (config?.status !== "已启用" || config?.compatibility !== "兼容" || validation?.status !== "通过" || !complete) return null;
    return envelope;
  }

  async function reconcileOntologyContracts() {
    const c009 = currentC009Record();
    if (!c009) return false;
    const replayKey = `${activeScenario().id}:${stableDigest(c009)}`;
    if (deliveredOntologyContractKey === replayKey) return false;
    if (ontologyContractReplay && ontologyContractReplayKey === replayKey) return ontologyContractReplay;
    ontologyContractReplayKey = replayKey;
    const replay = (async () => {
      const c009RequestId = `C009-${activeScenario().id}-${stableDigest(c009)}`;
      const compatibility = await requestOntologyBridge("deliverConsumerCompatibility", c009, c009RequestId);
      if (!compatibility?.ok) throw new Error(compatibility?.error || "智能问数兼容状态未被本体管理接收");

      const projection = readStoredObject(C008_PROJECTION_KEY);
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
      deliveredOntologyContractKey = replayKey;
      return true;
    })().catch((error) => {
      document.documentElement.dataset.ontologyContracts = "blocked";
      document.documentElement.dataset.ontologyContractReason = error?.message || "合同重放未完成";
      return false;
    });
    ontologyContractReplay = replay;
    replay.then(() => {
      if (ontologyContractReplayKey !== replayKey) return;
      ontologyContractReplay = null;
      ontologyContractReplayKey = null;
    });
    return replay;
  }

  function scheduleOntologyContractReconcile() {
    window.clearTimeout(ontologyContractReplayTimer);
    ontologyContractReplayTimer = window.setTimeout(() => {
      reconcileOntologyContracts().then((updated) => {
        if (updated) refreshSourceState(false);
      });
    }, 120);
  }

  function scenarioWorkspaceMarkup() {
    const count = window.OFW_COMPOSITE_REGISTRY?.scenes?.length || 4;
    return `<div class="scenario-workspace" aria-label="业务范围"><span>业务范围</span><strong>${count} 个场景 · 统一模块工作区</strong></div>`;
  }

  function setDocumentTitle(route) {
    const page = route.type === "module" ? DATA.moduleById[route.moduleId].name : route.type === "dashboard" ? "仪表盘" : "首页";
    document.title = route.type === "home" ? DATA.brand.full : `${page} · ${DATA.brand.zh}`;
  }

  function navigate(route, options = {}) {
    if (!options.skipFrameCapture) captureFramePosition();
    captureHomePosition();
    closeModal();
    const scenario = activeScenario();
    const currentDepth = Number(history.state?.s001Depth || 0);
    STORE.saveNavigationContext?.({
      lastRoute: route,
      returnRoute: window.location.hash || "#home",
      moduleId: route.match?.(/^#module\/(.+)$/)?.[1] || null,
      scenarioId: scenario.id
    });
    const nextState = { ...(history.state || {}), s001Shell: true, scenarioId: scenario.id, s001Depth: options.replace ? currentDepth : currentDepth + 1 };
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
    const done = completedCount();
    const next = firstIncomplete();
    const scenario = activeScenario();
    const portfolioDone = portfolioRuns().filter((item) => Number(item.completed) === Number(item.total)).length;
    const currentName = route.type === "module" ? DATA.moduleById[route.moduleId].name : route.type === "dashboard" ? "仪表盘" : "首页";
    return `<header class="global-topbar">
      <div class="top-title">${route.type === "home" ? "" : route.type === "module" || route.type === "dashboard" ? "" : `<button class="top-icon-button" type="button" data-action="return-context" title="返回工作台" aria-label="返回工作台">${icon("back", "sm")}</button>`}${icon(route.type === "dashboard" ? "chart" : route.type === "module" ? DATA.moduleById[route.moduleId].icon : "home")}
        <div class="top-title-copy"><span>统一工作台</span><strong>${currentName}</strong></div>
      </div>
      ${scenarioWorkspaceMarkup()}
      <div class="top-actions">
        <button class="flow-trigger" type="button" data-action="open-flow" aria-label="打开四场景运行档案">
          ${icon("layers", "sm")}<span><b>四场景运行 · ${portfolioDone}/4</b><small>${portfolioDone === 4 ? "六模块运行档案完整" : "仍有场景未完成"}</small></span><i><i style="width:${portfolioDone * 25}%"></i></i>
        </button>
        ${route.type === "module" || route.type === "dashboard" ? `<button class="top-action" type="button" data-action="refresh-source" aria-label="重新读取六个模块状态" title="重新读取">${icon("refresh", "sm")}<span>重新读取</span></button>` : ""}
        <button class="top-action" type="button" data-action="open-reset" aria-label="重置浏览位置" title="重置浏览位置">${icon("reset", "sm")}<span>重置浏览</span></button>
        <div class="user-account" title="当前账号"><span class="user-avatar">管</span><strong>平台管理员</strong></div>
      </div>
    </header>`;
  }

  function navigation(route) {
    const state = STORE.get();
    const scenario = activeScenario();
    const done = completedCount();
    const next = firstIncomplete();
    return `<aside class="global-nav">
      <button class="brand-lockup" type="button" data-action="toggle-navigation" aria-label="${state.navCollapsed ? "展开主菜单" : "收起主菜单"}" title="${state.navCollapsed ? "展开主菜单" : "收起主菜单"}">
        <span class="brand-mark brand-mark-ai" aria-hidden="true">${icon("brainCircuit", "brand-brain")}</span><div><strong>${DATA.brand.zh}</strong><small>${DATA.brand.en}</small></div>
      </button>
      <div class="nav-context"><span>业务范围</span><strong>全部场景 · S001 / S002 / S003 / S004</strong></div>
      <nav class="primary-nav" aria-label="一级导航">
        ${DATA.nav.map((item) => {
          const module = DATA.moduleById[item.id];
          const progress = module ? moduleProgress(module) : null;
          const itemDone = module ? progress.complete : item.id === "dashboard" ? isComplete("publish") : false;
          const itemObserved = module ? !itemDone && (progress.observed || 0) > 0 : false;
          return `<button class="nav-item ${route.active === item.id ? "active" : ""}" type="button" data-primary-nav="true" data-route="${item.route}" title="${item.name}">
            ${icon(item.icon)}<span>${item.name}</span>${item.id === "home" ? "" : `<i class="nav-state ${itemDone ? "done" : itemObserved ? "observed" : ""}" aria-hidden="true"></i>`}
          </button>`;
        }).join("")}
      </nav>
      <div class="nav-foot"><div><i class="connection-dot active"></i><strong>${portfolioRuns().filter((item) => Number(item.completed) === Number(item.total)).length}/4 场景全链路已完成</strong></div><p>六模块记录与证据均可追溯</p></div>
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
      const module = DATA.moduleById[id];
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
    return `<svg class="architecture-path" viewBox="0 0 640 520" aria-hidden="true">
      <defs><marker id="home-architecture-arrow" viewBox="0 0 12 12" refX="10.5" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto" overflow="visible"><path d="M2 1.5 10.5 6 2 10.5"/></marker><marker id="home-architecture-arrow-active" viewBox="0 0 12 12" refX="10.5" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto" overflow="visible"><path d="M2 1.5 10.5 6 2 10.5"/></marker></defs>
      <g class="path-segment segment-1${activeSegment === 1 ? " active" : ""}"><path class="path-track" d="M373.3 29.1 A237 237 0 0 1 534.8 360.2" marker-end="url(#home-architecture-arrow${activeSegment === 1 ? "-active" : ""})"/><path class="path-flow" pathLength="1" d="M373.3 29.1 A237 237 0 0 1 534.8 360.2"/></g>
      <g class="path-segment segment-2${activeSegment === 2 ? " active" : ""}"><path class="path-track" d="M475.5 438.9 A237 237 0 0 1 170.9 444.2" marker-end="url(#home-architecture-arrow${activeSegment === 2 ? "-active" : ""})"/><path class="path-flow" pathLength="1" d="M475.5 438.9 A237 237 0 0 1 170.9 444.2"/></g>
      <g class="path-segment segment-3${activeSegment === 3 ? " active" : ""}"><path class="path-track" d="M108.8 367.6 A237 237 0 0 1 258.7 31.1" marker-end="url(#home-architecture-arrow${activeSegment === 3 ? "-active" : ""})"/><path class="path-flow" pathLength="1" d="M108.8 367.6 A237 237 0 0 1 258.7 31.1"/></g>
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
      path?.querySelectorAll(".path-segment").forEach((segment, index) => {
        const selected = index === nextIndex;
        segment.classList.toggle("active", selected);
        segment.querySelector(".path-track")?.setAttribute("marker-end", `url(#home-architecture-arrow${selected ? "-active" : ""})`);
      });
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
      const flowSummary = frame.querySelector(".architecture-flow-summary");
      if (flowSummary) {
        flowSummary.querySelector("strong").textContent = domain.flow;
        flowSummary.querySelector("small").textContent = domain.flowDetail;
      }
      frame.querySelectorAll(".architecture-foot [data-domain]").forEach((button) => button.classList.toggle("active", button.dataset.domain === homeDomain));
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
    const next = firstIncomplete();
    const done = completedCount();
    const percent = Math.round((done / DATA.workflow.length) * 100);
    const nextState = next ? stepState(next.id) : "complete";
    const nextStatus = statusMeta(nextState);
    const currentModule = next ? DATA.moduleById[next.module] : DATA.moduleById.report;
    const domain = HOME_DOMAINS[homeDomain] || HOME_DOMAINS.foundation;

    const chain = DATA.modules.map((module) => {
      const progress = moduleProgress(module);
      const active = next?.module === module.id;
      const chainStatus = progress.complete ? "已确认" : active ? "当前处理" : progress.observed ? "待关联" : progress.done ? "进行中" : "待开始";
      return `<button class="home-chain-node ${progress.complete ? "done" : active ? "active" : progress.observed ? "observed" : ""}" type="button" data-route="#module/${module.id}" title="进入${module.name}" aria-label="进入${module.name}，${chainStatus}，${progress.done}/${progress.total} 项来源状态已确认">
        <span>${icon(progress.complete ? "check" : progress.observed ? "link" : module.icon, "sm")}</span><strong>${module.name}</strong><small>${chainStatus} · ${progress.done}/${progress.total}</small>
      </button>`;
    }).join("");

    const domainCards = homeDomainCardsMarkup(domain);
    const blockerCopy = next ? recordDetail(next.id) : "全部来源状态已按同一链路确认。";
    const activity = portfolioRuns().map((run) => (
      `<article class="activity-item"><i class="activity-dot success"></i><div><strong>${escapeHtml(run.name)} · 已完成</strong><span>${escapeHtml(run.scenarioId)} 全链路 ${escapeHtml(run.completed)}/${escapeHtml(run.total)} · 数据截至 ${escapeHtml(run.dataAsOf)}</span></div><time>${escapeHtml(run.completedAt || "已归档")}</time></article>`
    )).join("");
    const selectedNames = state.context.selectedEntities.map((id) => DATA.entities.find((entity) => entity.id === id)?.name).filter(Boolean);
    const portfolioRunsSnapshot = portfolioRuns();
    const portfolioDoneCount = portfolioRunsSnapshot.filter((item) => Number(item.completed) === Number(item.total)).length;
    const content = `<div class="home-view scheme-a-home"><div class="home-container">
      <section class="home-status-strip">
        <div class="scenario-identity"><span>四场景运行档案</span><strong>融资、预算、债务风险与贷前调查</strong><small>${portfolioRunsSnapshot.map((item) => `${item.scenarioId} · ${item.dataAsOf}`).join("　")}</small></div>
        <div class="scenario-progress"><div><span>场景完成度</span><b>${portfolioDoneCount}/4</b></div><i><i style="width:${portfolioDoneCount * 25}%"></i></i><small>${portfolioDoneCount === 4 ? "六模块运行档案完整" : "仍有场景未完成"}</small></div>
        <div class="scenario-next"><span>当前状态</span><strong>${portfolioDoneCount === 4 ? "四场景全链路已完成" : "存在未完成场景"}</strong><small>数据、语义、问数、决策、Agent、报告和仪表盘均可按场景追溯。</small></div>
        <button class="btn primary" type="button" data-route="#dashboard">查看仪表盘${icon("arrow", "sm")}</button>
      </section>

      <section class="classic-home-frame" data-home-domain="${homeDomain}">
        <div class="classic-architecture">
          <div class="architecture-intro"><div><span>${DATA.brand.en} · 平台能力架构</span><h1>从可信数据到可追溯行动</h1></div><p>数据、语义与行动沿同一证据链协作；首页只汇总进度并把工作带回对应业务模块。</p></div>
          <div class="architecture-cycle" aria-label="平台三大能力域">
            ${homeArchitecturePathMarkup()}
            ${Object.entries(HOME_DOMAINS).map(([key, item]) => `<button class="architecture-node ${key}${homeDomain === key ? " active" : ""}" type="button" data-action="home-domain" data-domain="${key}" aria-pressed="${homeDomain === key}"><span class="node-en">${item.en}</span>${icon(item.icon, "architecture-node-icon")}<span class="node-zh">${item.name}</span><small class="node-scope">${item.scope}</small></button>`).join("")}
            ${homeCoreGraphicMarkup()}
          </div>
          <div class="architecture-flow-summary" aria-live="polite"><span>当前关系</span><strong>${domain.flow}</strong><small>${domain.flowDetail}</small></div>
          <div class="architecture-foot" aria-label="能力域说明">
            <button class="${homeDomain === "foundation" ? "active" : ""}" type="button" data-action="home-domain" data-domain="foundation"><b>01 数据治理</b>数据源、数据管道、资产版本与质量。</button>
            <button class="${homeDomain === "intelligence" ? "active" : ""}" type="button" data-action="home-domain" data-domain="intelligence"><b>02 语义问数</b>已发布业务定义、可信问数、报告与证据。</button>
            <button class="${homeDomain === "action" ? "active" : ""}" type="button" data-action="home-domain" data-domain="action"><b>03 行动智能</b>行动申请、人工确认与受控协作。</button>
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
        <section class="panel"><div class="panel-head"><div><h2>当前阻断</h2><p>只显示下一项需要处理的来源状态。</p></div><span class="status-badge ${next ? nextStatus.tone : "success"}">${next ? nextStatus.label : "当前无阻断"}</span></div><div class="home-blocker"><span class="blocker-icon ${next ? "" : "clear"}">${icon(next ? nextStatus.icon : "shield")}</span><div><strong>${next ? next.title : "当前无待处理事项"}</strong><p>${escapeHtml(blockerCopy)}</p></div><div><button class="btn" type="button" data-action="refresh-source">重新读取</button>${next ? `<button class="btn primary" type="button" data-route="#module/${next.module}">前往处理</button>` : ""}</div></div></section>
        <section class="panel"><div class="panel-head"><div><h2>场景运行记录</h2><p>四个场景分别保留自己的运行轮次和数据时点。</p></div></div><div class="activity-list compact">${activity}</div></section>
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
    const requestedId = new URLSearchParams(window.location.search).get("scenarioId");
    if (moduleId === "report" && (activeScenario().id === "S003" || requestedId === "S003")) return "#/reports?tab=products";
    return { data: "#/resources", ontology: "#published", query: "#/ask", decision: "#workbench", agent: "#/agents", report: "#/catalog", dashboard: "#/dashboards" }[moduleId] || "";
  }

  const MODULE_ROOT_HASH = Object.freeze({
    data: "#/resources",
    ontology: "#published",
    query: "#/ask",
    decision: "#workbench",
    agent: "#/agents",
    report: "#/catalog",
    dashboard: "#/dashboards"
  });

  const FRAME_ROUTE_LABELS = Object.freeze({
    data: [["/pipelines/", "管道画布"], ["/pipeline/", "管道画布"], ["/source/", "数据源详情"], ["/asset/", "数据资产详情"], ["/resources", "数据资源目录"], ["/pipelines", "数据管道目录"]],
    ontology: [["draft", "修订草稿"], ["modeling", "本体画布"], ["mapping", "数据映射"], ["published", "语义资产目录"]],
    query: [["/answer", "回答详情"], ["/semantic", "语义资源"], ["/config", "问数配置"], ["/history", "历史会话"], ["/ask", "问数工作台"]],
    decision: [["operations", "追踪待办"], ["tasks", "待办详情"], ["workbench", "决策工作台"]],
    agent: [["/runs/", "运行详情"], ["/runs", "运行记录"], ["/resources", "配置资源"], ["/evidence", "证据与结果"], ["/agents/", "Agent 详情"], ["/agents", "Agent 目录"]],
    report: [["/report/", "查看正式报告"], ["/reports/view", "查看正式报告"], ["/definitions", "报告定义"], ["/create", "创建与生成"], ["/catalog", "报告目录"]],
    dashboard: [["/view/risk/operations", "债务风险 · 模型与运行"], ["/view/risk/actions", "债务风险 · 风险处置行动"], ["/view/risk/enterprises", "债务风险 · 风险处置行动"], ["/view/risk/analysis", "债务风险 · 产业与薄弱项"], ["/view/risk/overview", "债务风险 · 风险总览"], ["/view/budget/", "预算监督管理驾驶舱"], ["/view/financing/", "集团融资驾驶舱"], ["/dashboards", "仪表盘目录"]]
  });

  function moduleBreadcrumb(module) {
    const initialLabel = FRAME_ROUTE_LABELS[module.id]?.at(-1)?.[1] || `${module.name}首页`;
    return `<nav class="module-breadcrumb" aria-label="当前位置">
      <button type="button" data-route="#home">首页</button>
      <span aria-hidden="true">${icon("chevron", "xs")}</span>
      <button type="button" data-action="module-root" data-module-id="${escapeHtml(module.id)}">${escapeHtml(module.name)}</button>
      <span class="module-breadcrumb-current-wrap"><span aria-hidden="true">${icon("chevron", "xs")}</span><strong id="frame-breadcrumb-current">${escapeHtml(initialLabel)}</strong></span>
    </nav>`;
  }

  function framePageLabel(frame, module) {
    try {
      const doc = frame.contentDocument;
      const href = decodeURIComponent(frame.contentWindow.location.href);
      const routeLabel = (FRAME_ROUTE_LABELS[module.id] || []).find(([needle]) => href.includes(needle))?.[1];
      const active = [...(doc?.querySelectorAll?.('.product-nav-item.active, .module-nav a.active, .module-nav button.active, nav [aria-current="page"], [role="tab"][aria-selected="true"]') || [])]
        .map((node) => node.textContent.replace(/\s+/g, " ").trim())
        .find((text) => text && text.length <= 30);
      const heading = [...(doc?.querySelectorAll?.('main h1, .page-header h1, .page-heading h1, .reader-toolbar strong, .external-head strong') || [])]
        .map((node) => node.textContent.replace(/\s+/g, " ").trim())
        .find((text) => text && text !== module.name && text.length <= 42);
      return heading || active || routeLabel || `${module.name}首页`;
    } catch (_) {
      return `${module.name}首页`;
    }
  }

  function syncFrameBreadcrumb(frame, module) {
    const current = document.getElementById("frame-breadcrumb-current");
    if (!current || !frame) return;
    current.textContent = framePageLabel(frame, module);
    current.title = current.textContent;
  }

  function frameSource(module) {
    const saved = STORE.get().framePositions[module.id];
    const fallback = `${module.source}${initialHash(module.id)}`;
    const requestedScenarioId = new URLSearchParams(window.location.search).get("scenarioId");
    // A deep-linked S003 review must enter the native S003 report route even
    // when a previous generic report position was saved in the shell.
    if (module.id === "report" && requestedScenarioId === "S003") return sourceWithScenarioContext(fallback);
    if (resetModuleRoutes.has(module.id)) {
      resetModuleRoutes.delete(module.id);
      if (module.id === "report") {
        const resetUrl = new URL(fallback, window.location.href);
        resetUrl.searchParams.set("resetRoute", "catalog");
        resetUrl.searchParams.set("resetViewAt", String(Date.now()));
        return sourceWithScenarioContext(`${resetUrl.pathname}${resetUrl.search}${resetUrl.hash}`);
      }
      return sourceWithScenarioContext(fallback);
    }
    if (module.id === "dashboard") return sourceWithScenarioContext(fallback);
    // The platform menu represents the module's catalog entry, not the last
    // nested Agent detail. Re-entering Agent application must always restore
    // the directory; in-module navigation remains intact while the frame lives.
    if (module.id === "agent") return sourceWithScenarioContext(fallback);
    if (!saved?.href) return sourceWithScenarioContext(fallback);
    try {
      const approvedUrl = new URL(module.source, window.location.href);
      const savedUrl = new URL(saved.href, window.location.href);
      const approvedDirectory = new URL("./", approvedUrl).pathname;
      const pathnameAllowed = module.id === "decision"
        ? savedUrl.pathname.startsWith(approvedDirectory)
        : savedUrl.pathname === approvedUrl.pathname;
      approvedUrl.searchParams.forEach((value, key) => savedUrl.searchParams.set(key, value));
      return sourceWithScenarioContext(pathnameAllowed ? `${savedUrl.pathname}${savedUrl.search}${savedUrl.hash}` : fallback);
    } catch (_) {
      return sourceWithScenarioContext(fallback);
    }
  }

  function renderModule(moduleId) {
    const module = DATA.moduleById[moduleId];
    if (!module) return renderHome();
    const content = `<div class="module-view">${moduleBreadcrumb(module)}<section class="frame-stage"><iframe id="module-frame" class="module-frame" data-scenario-id="${escapeHtml(activeScenario().id)}" title="${module.name}" src="${escapeHtml(frameSource(module))}" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"></iframe></section></div>`;
    const route = { type: "module", moduleId, active: moduleId, key: `module-${moduleId}` };
    const rebuilt = renderShell(content, route, { preserveFrame: true, frameMode: "module" });
    renderedModuleId = moduleId;
    if (rebuilt) {
      const frame = document.getElementById("module-frame");
      if (frame) frame.addEventListener("load", () => adaptFrame(frame, module));
    }
  }

  function renderDashboard() {
    const dashboardModule = { id: "dashboard", name: "仪表盘", source: "../dashboard/index.html?v=20260823-19" };
    const published = isComplete("publish");
    const source = frameSource(dashboardModule);
    const frameBody = published
      ? `<iframe id="module-frame" class="module-frame" data-scenario-id="${escapeHtml(activeScenario().id)}" title="仪表盘" src="${escapeHtml(source)}" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"></iframe>`
      : `<div class="consume-gate">${icon("chart", "lg")}<h1>暂无可消费的本次报告</h1><p>请先在报告中心完成报告生成、确定性核验以及 HTML/PDF 发布。</p><button class="btn primary" type="button" data-route="#module/report">前往报告中心</button></div>`;
    const content = `<div class="module-view">${moduleBreadcrumb(dashboardModule)}<section class="frame-stage">${frameBody}</section></div>`;
    const route = { type: "dashboard", active: "dashboard", key: "dashboard" };
    const rebuilt = renderShell(content, route, { preserveFrame: published, frameMode: published ? "dashboard-frame" : "dashboard-gate" });
    renderedModuleId = published ? "dashboard" : null;
    if (rebuilt && published) {
      const frame = document.getElementById("module-frame");
      if (frame) frame.addEventListener("load", () => adaptFrame(frame, dashboardModule));
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
    const runs = portfolioRuns();
    return modalShell({
      title: "四场景运行档案",
      subtitle: `${runs.filter((item) => Number(item.completed) === Number(item.total)).length}/4 个场景已完成`,
      iconName: "layers",
      large: true,
      body: `<div class="step-list">${runs.map((run) => `<div class="step-row done"><span class="step-index">${icon("check", "sm")}</span><span><strong>${escapeHtml(run.scenarioId)} · ${escapeHtml(run.name)}</strong><small>${escapeHtml(run.scenarioRunId)} · 数据截至 ${escapeHtml(run.dataAsOf)} · 完成于 ${escapeHtml(run.completedAt || "已归档")}</small></span><em>${escapeHtml(run.completed)}/${escapeHtml(run.total)}</em></div>`).join("")}</div>`,
      footer: `<button class="btn" type="button" data-action="refresh-source">重新读取</button><button class="btn" type="button" data-action="close-modal">关闭</button><button class="btn primary" type="button" data-route="#dashboard">查看仪表盘</button>`
    });
  }

  function resetModal() {
    return modalShell({
      title: "重置浏览位置",
      subtitle: "统一工作台",
      iconName: "reset",
      body: `<div class="reset-warning">${icon("alert")}<div><strong>只恢复导航、筛选和滚动位置</strong><span>四个场景的运行档案、数据资产、本体、问数结果、决策、Agent 记录、报告和证据不会被删除或改写。</span></div></div>`,
      footer: `<button class="btn" type="button" data-action="close-modal">取消</button><button class="btn danger" type="button" data-action="confirm-reset">确认重置浏览位置</button>`
    });
  }

  function stepModal(stepId) {
    const step = DATA.stepById[stepId];
    const record = rawStep(stepId);
    const currentState = stepState(stepId);
    const meta = statusMeta(currentState);
    const sourceRef = record.sourceRecordId || record.recordId || record.sourceRef || record.runId || record.version || "";
    const recovery = record.recovery || record.next || (currentState === "complete" ? "可继续下一步。" : `请在${DATA.moduleById[step.module].name}中处理后重新读取状态。`);
    return modalShell({
      title: step.title,
      subtitle: `${DATA.moduleById[step.module].name} · ${meta.label}`,
      iconName: meta.icon,
      body: `<div class="task-card ${currentState === "complete" ? "success" : currentState === "failed" || currentState === "blocked" || currentState === "observed" ? "warning" : ""}"><div class="task-card-head"><span>当前状态</span><span class="status-badge ${meta.tone}">${meta.label}</span></div><h3>${step.title}</h3><p>${escapeHtml(recordDetail(stepId))}</p><div class="fact-grid"><div><span>所属模块</span><strong>${DATA.moduleById[step.module].name}</strong></div><div><span>状态时间</span><strong>${escapeHtml(recordAt(stepId) || "尚未形成")}</strong></div></div><div class="recovery-copy"><strong>下一步</strong><span>${escapeHtml(recovery)}</span></div>${sourceRef ? `<details class="source-reference"><summary>查看来源定位</summary><code>${escapeHtml(sourceRef)}</code></details>` : ""}</div>`,
      footer: `<button class="btn" type="button" data-action="close-modal">关闭</button><button class="btn primary" type="button" data-action="go-flow-step" data-step="${stepId}">前往${DATA.moduleById[step.module].name}</button>`
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
      ["/dashboard/", "#dashboard", "dashboard"],
      ["report-center", "#module/report", "report"]
    ];
    return routeMap.find(([needle]) => url.includes(needle)) || null;
  }

  function frameAdapterCss(moduleId) {
    const kind = moduleId;
    const documentScroll = ["report", "dashboard"].includes(kind);
    const common = documentScroll ? `
      html, body { width:100%!important; min-height:100%!important; height:auto!important; }
      html { overflow-y:auto!important; overflow-x:hidden!important; }
      body { overflow:visible!important; }
    ` : `
      html, body { width:100%!important; height:100%!important; }
      body { overflow:hidden!important; }
    `;
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
    const horizontalSubnav = kind === "dashboard" ? "" : `
      @media (min-width:701px) {
        .app-shell {
          grid-template-columns:minmax(0,1fr)!important;
          grid-template-rows:52px minmax(0,1fr)!important;
        }
        .app-shell > .product-nav {
          min-width:0!important;
          min-height:52px!important;
          height:52px!important;
          grid-column:1!important;
          grid-row:1!important;
          display:flex!important;
          flex-direction:row!important;
          align-items:stretch!important;
          overflow:hidden!important;
          border-right:0!important;
          border-bottom:1px solid #dce3eb!important;
          background:#f8fafb!important;
        }
        .app-shell > .product-nav > .product-nav-head {
          width:196px!important;
          min-height:52px!important;
          flex:0 0 196px!important;
          padding:0 12px!important;
          border-right:1px solid #dce3eb!important;
          border-bottom:0!important;
        }
        .app-shell > .product-nav > .product-nav-head small { display:none!important; }
        .app-shell > .product-nav > .product-nav-list {
          min-width:0!important;
          flex:1!important;
          padding:6px 10px!important;
          display:flex!important;
          flex-direction:row!important;
          align-items:center!important;
          gap:5px!important;
          overflow-x:auto!important;
          overflow-y:hidden!important;
        }
        .app-shell > .product-nav .product-nav-label,
        .app-shell > .product-nav > .product-nav-foot { display:none!important; }
        .app-shell > .product-nav .product-nav-item {
          width:auto!important;
          min-width:max-content!important;
          min-height:38px!important;
          height:38px!important;
          padding:0 12px!important;
          border-radius:5px!important;
        }
        .app-shell > .app-workspace,
        .app-shell > .workspace {
          grid-column:1!important;
          grid-row:2!important;
        }
        .app-shell > .app-workspace > .topbar,
        .app-shell > .workspace > .topbar { display:none!important; }

        .decision-app {
          grid-template-columns:minmax(0,1fr)!important;
          grid-template-rows:52px minmax(0,1fr)!important;
        }
        .decision-app > .product-nav {
          min-width:0!important;
          min-height:52px!important;
          height:52px!important;
          grid-column:1!important;
          grid-row:1!important;
          display:flex!important;
          flex-direction:row!important;
          align-items:stretch!important;
          overflow:hidden!important;
          border-right:0!important;
          border-bottom:1px solid #dce3eb!important;
          background:#f8fafb!important;
        }
        .decision-app > .product-nav > .product-nav-head {
          width:196px!important;
          min-height:52px!important;
          flex:0 0 196px!important;
          padding:0 12px!important;
          border-right:1px solid #dce3eb!important;
          border-bottom:0!important;
        }
        .decision-app > .product-nav > .product-nav-head small { display:none!important; }
        .decision-app > .product-nav > .product-nav-list {
          min-width:0!important;
          flex:1!important;
          padding:6px 10px!important;
          display:flex!important;
          flex-direction:row!important;
          align-items:center!important;
          gap:5px!important;
          overflow-x:auto!important;
          overflow-y:hidden!important;
        }
        .decision-app > .product-nav .product-nav-label,
        .decision-app > .product-nav > .product-nav-foot { display:none!important; }
        .decision-app > .product-nav .product-nav-item {
          width:auto!important;
          min-width:max-content!important;
          min-height:38px!important;
          height:38px!important;
          padding:0 12px!important;
          border-radius:5px!important;
        }
        .decision-app > .app-workspace {
          grid-column:1!important;
          grid-row:2!important;
        }
        .decision-app > .app-workspace > .app-topbar { display:none!important; }
      }
    `;
    return `${common}${adapters[kind] || ""}${horizontalSubnav}`;
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
        const targetModuleId = mapped[2];
        const targetDoc = frame.contentDocument;
        const targetScroller = targetDoc?.querySelector(".main, .screen-stage, .page-shell, .workspace-main, [data-scroll-container]");
        STORE.saveFramePosition(targetModuleId, {
          scenarioId: activeScenario().id,
          href: frame.contentWindow.location.pathname + frame.contentWindow.location.search + frame.contentWindow.location.hash,
          windowY: frame.contentWindow.scrollY || 0,
          containerY: targetScroller?.scrollTop || 0,
          savedAt: Date.now()
        });
        navigate(mapped[1], { skipFrameCapture: true });
        return;
      }
      deliverScenarioContextToFrame(frame, module);
      const doc = frame.contentDocument;
      const frameView = doc?.defaultView;
      const body = doc?.body;
      if (!body) return;
      doc.title = `${module.name} · ${DATA.brand.zh}`;
      installFrameAdapter(doc, module.id);
      syncFrameBreadcrumb(frame, module);
      const saved = STORE.get().framePositions[module.id];
      if (saved) {
        window.setTimeout(() => {
          try {
            const currentUrl = new URL(frame.contentWindow.location.href);
            const savedUrl = new URL(saved.href, window.location.href);
            const sameView = currentUrl.pathname === savedUrl.pathname && currentUrl.hash === savedUrl.hash;
            frame.contentWindow.scrollTo(0, sameView ? saved.windowY || 0 : 0);
            const scroller = doc.querySelector(".main, .screen-stage, .page-shell, .workspace-main, [data-scroll-container]");
            if (scroller) scroller.scrollTop = sameView ? saved.containerY || 0 : 0;
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
      const editableInput = (node) => node && (node.matches?.("input, textarea, select") || node.isContentEditable);
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
          if (editableInput(parent)) return;
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
        [0, 120, 360, 720].forEach((delay) => window.setTimeout(() => {
          try {
            if (doc.body?.isConnected) scrubNode(doc.body);
            syncFrameBreadcrumb(frame, module);
          } catch (_) {}
        }, delay));
        window.clearTimeout(frameSaveTimer);
        frameSaveTimer = window.setTimeout(() => { captureFramePosition(); refreshSourceState(false); }, 220);
      }, true);
      frameView?.addEventListener("hashchange", () => {
        [0, 120, 360].forEach((delay) => window.setTimeout(() => syncFrameBreadcrumb(frame, module), delay));
      });
      doc.addEventListener("scroll", () => {
        window.clearTimeout(frameSaveTimer);
        frameSaveTimer = window.setTimeout(captureFramePosition, 180);
      }, true);
      refreshSourceState(false);
    } catch (_) {
      showToast("模块页面已打开", "当前页面仍可使用统一导航和返回。", "warning");
    }
  }

  document.addEventListener("click", (event) => {
    const routeButton = event.target.closest("[data-route]");
    if (routeButton) {
      if (routeButton.dataset.primaryNav === "true") {
        const targetModule = routeButton.dataset.route.match(/^#module\/(.+)$/)?.[1];
        if (targetModule) resetModuleRoutes.add(targetModule);
        if (routeButton.dataset.route === "#dashboard") resetModuleRoutes.add("dashboard");
      }
      navigate(routeButton.dataset.route);
      return;
    }
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
      window.clearTimeout(frameSaveTimer);
      window.clearTimeout(homeScrollSaveTimer);
      frameSaveTimer = null;
      homeScrollSaveTimer = null;
      resetModuleRoutes = new Set([...DATA.modules.map((module) => module.id), "dashboard"]);
      closeModal();
      history.replaceState({ s001Shell: true, scenarioId: scenario.id, s001Depth: 0 }, "", "#home");
      renderedModuleId = null;
      STORE.resetBrowsingContext?.();
      STORE.saveNavigationContext?.({ lastRoute: "#home", returnRoute: null, moduleId: null, scenarioId: scenario.id, homeScrollTop: 0 });
      render();
      showToast("浏览位置已重置", "四个场景的运行档案和业务记录保持不变。", "success");
    }
    if (action === "refresh-source") refreshSourceState(true);
    if (action === "focus-module") focusModule();
    if (action === "inspect-step") openModal("step", { stepId });
    if (action === "go-flow-step") { closeModal(); navigate(`#module/${DATA.stepById[stepId].module}`); }
    if (action === "return-context") returnToPrevious();
    if (action === "toggle-navigation") STORE.toggleNavigation();
    if (action === "module-root") {
      const frame = document.getElementById("module-frame");
      const moduleId = actionButton.dataset.moduleId || renderedModuleId;
      const rootHash = MODULE_ROOT_HASH[moduleId] || "";
      if (frame && rootHash) {
        try {
          frame.contentWindow.location.hash = rootHash;
          frame.contentWindow.scrollTo(0, 0);
          window.setTimeout(() => syncFrameBreadcrumb(frame, moduleId === "dashboard" ? { id: "dashboard", name: "仪表盘" } : DATA.moduleById[moduleId]), 80);
        } catch (_) {}
      }
    }
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
    history.replaceState({ s001Shell: true, scenarioId: nextScenario.id, s001Depth: 0 }, "", "#home");
    closeModal();
    render();
  });

  window.addEventListener("popstate", (event) => {
    captureFramePosition();
    const targetScenarioId = event.state?.scenarioId;
    if (targetScenarioId && targetScenarioId !== STORE.get().activeScenarioId) STORE.setActiveScenario?.(targetScenarioId);
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
    if (event.key === IQ_STATE_KEY || event.key === C008_PROJECTION_KEY) scheduleOntologyContractReconcile();
  });
  window.addEventListener("s001:state", () => {
    if (suppressHomeDomainStateRender && parseRoute().type === "home") return;
    render();
    if (modalState && ["flow", "step"].includes(modalState.kind)) renderModal();
  });
  window.addEventListener("s001:scenario-context", () => {
    const frame = document.getElementById("module-frame");
    const module = renderedModuleId === "dashboard"
      ? { ...DATA.moduleById.report, id: "dashboard" }
      : DATA.moduleById[renderedModuleId];
    if (frame && module) deliverScenarioContextToFrame(frame, module);
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && modalState) closeModal(); });

  window.addEventListener("resize", () => {
    if (window.innerWidth <= 760 && !STORE.get().navCollapsed) STORE.toggleNavigation();
  });

  if (!window.location.hash) history.replaceState({ s001Shell: true, scenarioId: activeScenario().id, s001Depth: 0 }, "", "#home");
  else if (!history.state?.s001Shell) history.replaceState({ ...(history.state || {}), s001Shell: true, scenarioId: activeScenario().id, s001Depth: 0 }, "", window.location.href);
  if (window.innerWidth <= 760 && !STORE.get().navCollapsed) STORE.toggleNavigation();
  STORE.refreshProjection?.();
  scheduleOntologyContractReconcile();
  render();
})();
