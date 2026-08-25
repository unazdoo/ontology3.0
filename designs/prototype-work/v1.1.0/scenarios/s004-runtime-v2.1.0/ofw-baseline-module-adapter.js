(function (root, factory) {
  "use strict";

  const api = factory(root && root.OFWScenarioFoundation);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.OFWBaselineModuleAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (FOUNDATION) {
  "use strict";

  if (!FOUNDATION) throw new Error("OFWScenarioFoundation 未加载，无法初始化基线模块适配器。");

  const MODULE_IDS = Object.freeze(["M01", "M02", "M03", "M04", "M05", "M06"]);
  // Keep the frozen S001 navigation order (data before ontology) while
  // retaining M01—M06 IDs for contracts, storage and Owner bookkeeping.
  const MODULE_DISPLAY_ORDER = Object.freeze(["M02", "M01", "M03", "M04", "M05", "M06"]);
  const MODULE_KEYS = Object.freeze({ M01: "ontology", M02: "data", M03: "query", M04: "decision", M05: "agent", M06: "report" });
  const HANDOFF_CHANNEL = "ontology3.0-s001-handoff-v1";
  const REGISTRY_EVENT = "ofw:scenario-registry";
  const EXTERNAL_BASELINE_PREFIX = "v";
  const LEGACY_KEYS = Object.freeze({
    M01: ["ontology-management-product-state-v1", "ontology3-canvas-first-review-v16", "ontology3-canvas-first-review-v17"],
    M02: ["ontology3.data-engineering.workspace.v5-handoff"],
    M03: ["ontology3.intelligent-query.workspace.v1", "ontology3.iq.review.conversation.v1", "ontology3.c017.intelligent-query.projection.v1"],
    M04: ["ontology3-decision-center-state-v1", "ontology3-decision-center-review-v2-portfolio-state-v6"],
    M05: ["ontology3.agent-application.catalog.v7", "ontology3.agent-application.catalog.v8", "ontology3.agent-application.owner-records.v1"],
    M06: ["ontology3.report-center.lifecycle-review.v1"]
  });

  function isPlainObject(value) {
    if (!value || typeof value !== "object") return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function freeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.keys(value).forEach((key) => freeze(value[key]));
    return Object.freeze(value);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function configuredNow(config, options) {
    const opts = options || {};
    const clock = config?.runtimeConfig?.demoClock;
    if (clock?.enabled === true && clock?.scenarioId === config.scenarioId && clock?.mode === "FIXED" && clock?.now) {
      return clock.now;
    }
    if (opts.now != null) return opts.now;
    return nowIso();
  }

  function createConfiguredClock(config, options) {
    const opts = options || {};
    const clock = config?.runtimeConfig?.demoClock;
    if (!(clock?.enabled === true && clock?.scenarioId === config.scenarioId && clock?.mode === "FIXED" && clock?.now)) {
      return () => opts.now != null ? opts.now : nowIso();
    }
    const anchor = Date.parse(clock.now);
    const realStartedAt = Date.now();
    const date = String(clock.date || clock.now).slice(0, 10);
    const lowerBound = Date.parse(`${date}T00:00:00.000Z`);
    const upperBound = Date.parse(`${date}T15:59:59.999Z`);
    return () => new Date(Math.min(upperBound, Math.max(lowerBound, anchor + (Date.now() - realStartedAt)))).toISOString();
  }

  function contextMatchesConfiguredClock(config, context) {
    const clock = config?.runtimeConfig?.demoClock;
    if (!clock?.enabled || clock.scenarioId !== config.scenarioId || clock.mode !== "FIXED") return true;
    const date = String(clock.date || clock.now || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const token = date.replaceAll("-", "");
    return String(context?.formedAt || "").startsWith(date)
      && String(context?.scenarioRunId || "").includes(`-RUN-${token}`);
  }

  // The frozen C034 foundation schema stores baseline versions without the
  // leading `v`; scenario configs use the platform-facing `v1.0.3` form.
  // Normalized locally so the shared foundation file stays untouched.
  function normalizeBaselineVersion(value) {
    if (typeof value !== "string") return null;
    const normalized = value.replace(/^v/i, "");
    return /^\d+\.\d+\.\d+$/.test(normalized) ? normalized : null;
  }

  function storageKey(scenarioId) {
    return `ofw:v1.1.0:scenario-registry:${scenarioId}:active-context`;
  }

  function readRaw(storage, key) {
    try {
      return JSON.parse(storage.getItem(key) || "null");
    } catch (_) {
      return null;
    }
  }

  function writeRaw(storage, key, value) {
    storage.setItem(key, JSON.stringify(value));
  }

  function validateScenarioConfig(input) {
    const errors = [];
    if (!isPlainObject(input)) return { ok: false, errors: [{ path: "$", message: "场景配置必须是普通对象" }] };
    if (typeof input.scenarioId !== "string" || !/^S\d{3}$/.test(input.scenarioId)) {
      errors.push({ path: "scenarioId", message: "必须使用 Sxxx 格式" });
    }
    if (typeof input.scenarioVersion !== "string" || !new RegExp(`^${input.scenarioId || "S000"}-v\\d+(?:\\.\\d+)*$`).test(input.scenarioVersion)) {
      errors.push({ path: "scenarioVersion", message: "必须使用与场景匹配的版本格式" });
    }
    if (typeof input.baselineVersion !== "string" || !/^v\d+\.\d+\.\d+$/.test(input.baselineVersion)) {
      errors.push({ path: "baselineVersion", message: "对外基线版本必须带 v 前缀" });
    }
    const foundationBaselineVersion = normalizeBaselineVersion(input.baselineVersion);
    if (!foundationBaselineVersion) {
      errors.push({ path: "baselineVersion", message: "必须是带 v 前缀的三段语义版本，例如 v1.0.3" });
    } else if (foundationBaselineVersion !== FOUNDATION.CURRENT_BASELINE_VERSION) {
      errors.push({ path: "baselineVersion", message: `必须绑定 ${FOUNDATION.CURRENT_BASELINE_VERSION} 对应的 v 前缀版本` });
    }
    if (input.baselineSnapshotId !== FOUNDATION.CURRENT_BASELINE_SNAPSHOT_ID) {
      errors.push({ path: "baselineSnapshotId", message: `必须绑定 ${FOUNDATION.CURRENT_BASELINE_SNAPSHOT_ID}` });
    }
    if (!isPlainObject(input.moduleSources)) {
      errors.push({ path: "moduleSources", message: "必须提供六个基线模块入口" });
    } else {
      MODULE_IDS.forEach((moduleId) => {
        if (typeof input.moduleSources[moduleId] !== "string" || !input.moduleSources[moduleId].trim()) {
          errors.push({ path: `moduleSources.${moduleId}`, message: "必须提供非空入口" });
        }
      });
    }
    return { ok: errors.length === 0, errors, foundationBaselineVersion };
  }

  function assertScenarioConfig(input) {
    const result = validateScenarioConfig(input);
    if (!result.ok) {
      const error = new Error("基线模块场景配置校验失败");
      error.code = "INVALID_BASELINE_MODULE_SCENARIO";
      error.details = result.errors;
      throw error;
    }
    return freeze({ ...clone(input), foundationBaselineVersion: result.foundationBaselineVersion });
  }

  function createContext(config, options) {
    const opts = options || {};
    const storage = opts.storage || (typeof localStorage !== "undefined" ? localStorage : null);
    const saved = storage ? readRaw(storage, storageKey(config.scenarioId)) : null;
    if (saved) {
      const validation = FOUNDATION.validateScenarioContext(saved);
      if (validation.ok && saved.scenarioId === config.scenarioId && saved.scenarioVersion === config.scenarioVersion && saved.status === "active"
        && contextMatchesConfiguredClock(config, saved)) {
        return FOUNDATION.assertScenarioContext(saved);
      }
    }
    const context = FOUNDATION.createScenarioContext({
      scenarioId: config.scenarioId,
      scenarioVersion: config.scenarioVersion,
      status: "active"
    }, { now: configuredNow(config, opts), randomBytes: opts.randomBytes });
    if (storage) writeRaw(storage, storageKey(config.scenarioId), context);
    return context;
  }

  function moduleDefinition(config, moduleId) {
    const key = MODULE_KEYS[moduleId];
    const source = config.moduleSources[moduleId];
    const sourceMeta = config.moduleMeta && config.moduleMeta[moduleId] || {};
    return {
      id: key,
      moduleId,
      name: sourceMeta.name || ({ data: "数据工程", ontology: "本体管理", query: "智能问数", decision: "决策中心", agent: "Agent 应用", report: "报告中心" }[key]),
      short: sourceMeta.short || ({ data: "数据", ontology: "本体", query: "问数", decision: "决策", agent: "Agent", report: "报告" }[key]),
      icon: sourceMeta.icon || ({ data: "database", ontology: "network", query: "sparkles", decision: "target", agent: "bot", report: "file" }[key]),
      color: sourceMeta.color || "blue",
      source: source,
      description: sourceMeta.description || "复用 v1.0.3 实际模块页面和内部路由。",
      steps: Object.freeze((config.workflow || []).filter((step) => step.moduleId === moduleId).map((step) => step.id))
    };
  }

  function createShellData(config, context) {
    const modules = MODULE_DISPLAY_ORDER.map((moduleId) => moduleDefinition(config, moduleId));
    const moduleById = Object.fromEntries(modules.map((module) => [module.id, module]));
    const workflow = (config.workflow || []).map((step, index) => ({
      id: step.id,
      module: MODULE_KEYS[step.moduleId],
      title: step.title,
      action: step.action || "查看模块",
      summary: step.summary || "",
      prerequisite: step.prerequisite || null,
      automatic: Boolean(step.automatic),
      index: index,
      initialStatus: step.initialStatus || "pending"
    }));
    const scenario = {
      id: config.scenarioId,
      scenarioVersion: config.scenarioVersion,
      status: "active",
      enabled: true,
      name: config.name,
      organization: config.organization,
      selectedEntities: (config.selectedEntities || []).slice(),
      focus: config.focus,
      dataAsOf: config.dataAsOf,
      sourceFile: config.sourceFile,
      sourceArtifactFile: config.sourceArtifactFile,
      sourceRows: config.sourceRows || null,
      dataVersion: config.dataVersion,
      ontologyVersion: config.ontologyVersion,
      trustedOntologyVersion: config.trustedOntologyVersion,
      baselineVersion: config.baselineVersion,
      foundationBaselineVersion: config.foundationBaselineVersion,
      baselineSnapshotId: config.baselineSnapshotId,
      moduleIds: modules.map((module) => module.id),
      scenarioContext: context
    };
    return {
      homepage: { source: modules.find((module) => module.id === "report")?.source || "", baseline: "S001 v1.0.3 实际六模块" },
      brand: { zh: "智财问策", en: "Ontology Financial World", full: "智财问策（Ontology Financial World）" },
      scenario,
      scenarioRegistry: [scenario],
      scenarioById: { [config.scenarioId]: scenario },
      modules,
      moduleById,
      workflow,
      stepById: Object.fromEntries(workflow.map((step) => [step.id, step])),
      nav: [
        { id: "home", name: "首页", icon: "home", route: "#home" },
        ...modules.map((module) => ({ id: module.id, name: module.name, icon: module.icon, route: `#module/${module.id}` })),
        { id: "dashboard", name: "仪表盘", icon: "chart", route: "#dashboard" }
      ],
      entities: config.entities || [],
      groupMetrics: config.groupMetrics || [],
      combinations: config.combinations || [],
      report: config.report || null
    };
  }

  function initialStepState(config, context) {
    return Object.fromEntries((config.workflow || []).map((step) => {
      const status = step.initialStatus || "pending";
      return [step.id, {
        status,
        complete: status === "complete" || status === "verified",
        detail: step.summary || "等待在对应 v1.0.3 模块中处理。",
        reason: step.summary || "等待在对应 v1.0.3 模块中处理。",
        at: status === "not_applicable" ? context.formedAt : null,
        evidence: status === "not_applicable" ? `scenario://${config.scenarioId}/${context.scenarioRunId}/boundary/${step.id}` : null
      }];
    }));
  }

  function createAdapter(input, options) {
    const config = assertScenarioConfig(input);
    const opts = options || {};
    const browserStorage = opts.storage || (typeof localStorage !== "undefined" ? localStorage : null);
    if (!browserStorage) throw new Error("基线模块适配器需要可用的 localStorage 或显式 storage。");
    const operationNow = createConfiguredClock(config, opts);
    const suppliedContext = opts.context ? FOUNDATION.assertScenarioContext(opts.context) : null;
    let context = suppliedContext && contextMatchesConfiguredClock(config, suppliedContext)
      ? suppliedContext
      : createContext(config, { ...opts, now: operationNow() });
    const foundationOperationOptions = () => ({ now: operationNow(), randomBytes: opts.randomBytes });
    let shellStorage = FOUNDATION.createNamespacedStorage({ storage: browserStorage, context, scope: "shell" });
    let state = null;

    function configuredFramePositions() {
      return Object.fromEntries(Object.entries(config.initialFramePositions || {}).map(([moduleId, href]) => [
        moduleId,
        { scenarioId: config.scenarioId, href, windowY: 0, containerY: 0, savedAt: context.formedAt }
      ]));
    }

    function buildInitialState() {
      return {
        schemaVersion: 4,
        activeScenarioId: config.scenarioId,
        navCollapsed: false,
        scenarios: {
          [config.scenarioId]: {
            scenarioId: config.scenarioId,
            scenarioContext: context,
            scenarioRunHistory: [],
            context: {
              organization: config.organization,
              selectedEntities: (config.selectedEntities || []).slice(),
              dataAsOf: config.dataAsOf
            },
            homeDomain: "foundation",
            homeOrbitTurn: 0,
            runtimeConfigVersion: config.runtimeConfig?.configVersion || config.scenarioVersion,
            framePositions: configuredFramePositions(),
            navigation: { lastRoute: "#home", returnRoute: null, homeScrollTop: 0, moduleContexts: {} },
            resetAt: context.formedAt,
            lastReadAt: null,
            steps: initialStepState(config, context)
          }
        }
      };
    }

    function loadState() {
      const saved = shellStorage.get("state");
      if (!saved || saved.schemaVersion !== 4 || saved.activeScenarioId !== config.scenarioId) return buildInitialState();
      if (!saved.scenarios || !saved.scenarios[config.scenarioId]) return buildInitialState();
      const configuredVersion = config.runtimeConfig?.configVersion || config.scenarioVersion;
      const savedScenario = saved.scenarios[config.scenarioId];
      if (savedScenario.runtimeConfigVersion !== configuredVersion) {
        const migrated = {
          ...saved,
          scenarios: {
            ...saved.scenarios,
            [config.scenarioId]: {
              ...savedScenario,
              runtimeConfigVersion: configuredVersion,
              framePositions: { ...(savedScenario.framePositions || {}), ...configuredFramePositions() }
            }
          }
        };
        shellStorage.set("state", migrated);
        return migrated;
      }
      try {
        FOUNDATION.assertScenarioContextMatch(context, saved.scenarios[config.scenarioId].scenarioContext);
      } catch (_) {
        return buildInitialState();
      }
      return { ...buildInitialState(), ...saved, scenarios: { [config.scenarioId]: { ...buildInitialState().scenarios[config.scenarioId], ...saved.scenarios[config.scenarioId] } } };
    }

    state = loadState();

    function activeState() {
      return state.scenarios[config.scenarioId];
    }

    function projection() {
      const scenarioState = activeState();
      const steps = Object.fromEntries((config.workflow || []).map((step) => {
        const record = scenarioState.steps?.[step.id] || {};
        const status = record.status || step.initialStatus || "pending";
        return [step.id, {
          ...record,
          status,
          complete: status === "complete" || status === "verified",
          module: MODULE_KEYS[step.moduleId],
          source: config.moduleMeta?.[step.moduleId]?.name || moduleDefinition(config, step.moduleId).name,
          detail: record.detail || step.summary || "等待在对应 v1.0.3 模块中处理。"
        }];
      }));
      const order = (config.workflow || []).map((step) => step.id);
      const firstIncompleteId = order.find((id) => !steps[id].complete && steps[id].status !== "not_applicable") || null;
      const completeCount = order.filter((id) => steps[id].complete).length;
      return {
        scenarioId: config.scenarioId,
        readAt: operationNow(),
        steps,
        byId: steps,
        order,
        completeCount,
        total: order.length,
        firstIncompleteId,
        sources: {},
        rawSources: {},
        sourceScope: {},
        meta: {
          dataAsOf: config.dataAsOf,
          dataVersion: config.dataVersion || null,
          semanticVersion: config.ontologyVersion || null,
          bindingId: config.bindingId || null,
          reportNo: config.report?.id || null,
          actualPdfFile: Boolean(config.report?.formats?.includes?.("PDF"))
        },
        chain: {
          dataAssetVersionId: config.dataVersion || null,
          ontologyBindingId: config.bindingId || null,
          queryRunIds: [],
          decisionTaskIds: [],
          reportNo: config.report?.id || null,
          companionRunId: config.companionRunId || null,
          comparisonRecordId: null
        },
        scenarioContext: context,
        baselineVersion: config.baselineVersion,
        foundationBaselineVersion: config.foundationBaselineVersion,
        baselineSnapshotId: config.baselineSnapshotId
      };
    }

    function persist(notify) {
      activeState().lastReadAt = operationNow();
      shellStorage.set("state", state, { now: activeState().lastReadAt });
      if (notify !== false && typeof window !== "undefined") {
        const detail = compatibleStateView();
        window.dispatchEvent(new CustomEvent("s001:state", { detail }));
        window.dispatchEvent(new CustomEvent(`${REGISTRY_EVENT}:${config.scenarioId}:state`, { detail }));
      }
      return state;
    }

    function compatibleStateView() {
      const current = activeState();
      return {
        ...current,
        schemaVersion: state.schemaVersion,
        activeScenarioId: state.activeScenarioId,
        navCollapsed: state.navCollapsed,
        scenarios: state.scenarios,
        context: current.context,
        framePositions: current.framePositions
      };
    }

    function contextEnvelope() {
      return {
        sourceModule: "平台公共层",
        contractCode: "C033",
        contextId: `C033-${context.scenarioId}-${context.scenarioRunId}`,
        deliveredAt: context.formedAt,
        evidenceLocator: `统一平台 / 场景工作区 / ${context.scenarioId} / ${context.scenarioRunId}`,
        scenarioContext: { ...context },
        baselineVersion: config.baselineVersion,
        foundationBaselineVersion: config.foundationBaselineVersion,
        baselineSnapshotId: config.baselineSnapshotId,
        runtimeConfig: config.runtimeConfig ? clone(config.runtimeConfig) : null
      };
    }

    function publishContext(notify) {
      if (browserStorage) writeRaw(browserStorage, storageKey(config.scenarioId), context);
      if (notify !== false && typeof window !== "undefined") {
        const detail = contextEnvelope();
        window.dispatchEvent(new CustomEvent("s001:scenario-context", { detail: { ...context } }));
        window.dispatchEvent(new CustomEvent(`${REGISTRY_EVENT}:${config.scenarioId}:context`, { detail }));
      }
      return { ...context };
    }

    function moduleProgress(moduleId) {
      const id = typeof moduleId === "string" ? moduleId : moduleId?.id;
      const module = MODULE_IDS.find((candidate) => MODULE_KEYS[candidate] === id || candidate === id);
      if (!module) return { done: 0, observed: 0, running: 0, failed: 0, total: 0, complete: false };
      const records = (config.workflow || []).filter((step) => step.moduleId === module).map((step) => activeState().steps[step.id] || {});
      const done = records.filter((record) => ["complete", "verified"].includes(record.status)).length;
      const observed = records.filter((record) => ["observed", "not_applicable"].includes(record.status)).length;
      const running = records.filter((record) => ["running", "processing"].includes(record.status)).length;
      const failed = records.filter((record) => ["failed", "blocked"].includes(record.status)).length;
      return { done, observed, running, failed, total: records.length, complete: done === records.length };
    }

    let moduleStorage = null;

    function refreshModuleStorage() {
      moduleStorage = Object.fromEntries(MODULE_IDS.map((moduleId) => [
        moduleId,
        FOUNDATION.createNamespacedStorage({ storage: browserStorage, context, scope: `module-${MODULE_KEYS[moduleId]}` })
      ]));
      return moduleStorage;
    }

    function resetCurrentScenario() {
      const previous = context;
      const receipt = FOUNDATION.directionalReset({ storage: browserStorage, currentContext: previous }, foundationOperationOptions());
      context = receipt.context;
      shellStorage = FOUNDATION.createNamespacedStorage({ storage: browserStorage, context, scope: "shell" });
      refreshModuleStorage();
      state = buildInitialState();
      persist(false);
      publishContext(false);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("s001:state", { detail: compatibleStateView() }));
        window.dispatchEvent(new CustomEvent(`${REGISTRY_EVENT}:${config.scenarioId}:reset`, { detail: receipt }));
      }
      return { ...state, resetReceipt: receipt };
    }

    refreshModuleStorage();

    const store = {
      FOUNDATION,
      BASELINE_SNAPSHOT_ID: config.baselineSnapshotId,
      BASELINE_VERSION: config.baselineVersion,
      FOUNDATION_BASELINE_VERSION: config.foundationBaselineVersion,
      HANDOFF_CHANNEL,
      MODULE_STORAGE_KEYS: Object.freeze(MODULE_IDS.flatMap((moduleId) => LEGACY_KEYS[moduleId] || [])),
      get: compatibleStateView,
      getRoot: () => state,
      getScenario: () => ({ ...activeState(), scenarioContext: { ...context } }),
      getScenarioContext: () => ({ ...context }),
      getScenarioContextEnvelope: contextEnvelope,
      publishScenarioContext: (_scenarioId, notify = true) => publishContext(notify),
      createScenarioStorage: (scope) => FOUNDATION.createNamespacedStorage({ storage: browserStorage, context, scope }),
      createModuleStorage: (moduleId) => moduleStorage[moduleId] || null,
      legacyKeyFor: (moduleId, legacyKey) => moduleStorage[moduleId]?.keyFor(`legacy/${legacyKey}`) || null,
      getLegacyKeyMap: () => clone(LEGACY_KEYS),
      setActiveScenario: (scenarioId) => {
        if (scenarioId !== config.scenarioId) throw new Error(`当前窗口只安装 ${config.scenarioId}，不能切换到 ${scenarioId}。`);
        return activeState();
      },
      getProjection: projection,
      refreshProjection: (notify = true) => {
        const value = projection();
        persist(notify);
        return value;
      },
      firstIncomplete: () => {
        const current = projection();
        const stepId = current.firstIncompleteId;
        return stepId ? { ...window.S001_DATA.stepById[stepId], ...current.steps[stepId] } : null;
      },
      isComplete: (stepId) => Boolean(projection().steps[stepId]?.complete),
      moduleProgress,
      saveFramePosition: (moduleId, position) => {
        activeState().framePositions[moduleId] = { ...clone(position), scenarioId: config.scenarioId };
        persist(false);
      },
      saveHomeDomain: (homeDomain, homeOrbitTurn) => {
        if (["foundation", "intelligence", "action"].includes(homeDomain)) activeState().homeDomain = homeDomain;
        if (Number.isFinite(Number(homeOrbitTurn))) activeState().homeOrbitTurn = Math.max(0, Math.trunc(Number(homeOrbitTurn)));
        persist(true);
        return activeState();
      },
      saveNavigationContext: (patch) => {
        activeState().navigation = { ...activeState().navigation, ...(patch || {}) };
        persist(false);
        return activeState().navigation;
      },
      toggleNavigation: () => {
        state.navCollapsed = !state.navCollapsed;
        persist(true);
      },
      resetCurrentScenario,
      resetAll: resetCurrentScenario
    };

    const shellData = createShellData(config, context);
    persist(false);
    publishContext(false);
    return Object.freeze({
      config,
      context: () => ({ ...context }),
      shellData: freeze(shellData),
      store: Object.freeze(store),
      moduleStorage,
      legacyKeys: LEGACY_KEYS,
      registryEvent: REGISTRY_EVENT
    });
  }

  function createRegistry(configs, options) {
    const registry = {};
    (Array.isArray(configs) ? configs : [configs]).filter(Boolean).forEach((config) => {
      const adapter = createAdapter(config, options);
      registry[config.scenarioId] = adapter;
    });
    return Object.freeze(registry);
  }

  function install(adapter, options) {
    if (!adapter || !adapter.config) throw new Error("必须提供已创建的场景适配器。");
    const target = options?.root || (typeof globalThis !== "undefined" ? globalThis : {});
    const registry = target.OFW_SCENARIOS && typeof target.OFW_SCENARIOS === "object" ? target.OFW_SCENARIOS : {};
    registry[adapter.config.scenarioId] = adapter;
    target.OFW_SCENARIOS = registry;
    target.OFW_ACTIVE_SCENARIO_ID = adapter.config.scenarioId;
    // Compatibility aliases are scoped to the current shell window only.
    // They are never used as the cross-scenario registry or persistence truth.
    target.S001_DATA = adapter.shellData;
    target.S001_STORE = adapter.store;
    target.OFW_ACTIVE_SCENARIO_ADAPTER = adapter;
    if (target.dispatchEvent && typeof target.CustomEvent === "function") {
      target.dispatchEvent(new target.CustomEvent(REGISTRY_EVENT, { detail: { activeScenarioId: adapter.config.scenarioId, scenarioIds: Object.keys(registry) } }));
    }
    return adapter;
  }

  return Object.freeze({
    MODULE_IDS,
    MODULE_KEYS,
    LEGACY_KEYS,
    HANDOFF_CHANNEL,
    validateScenarioConfig,
    assertScenarioConfig,
    createAdapter,
    createRegistry,
    install
  });
});
