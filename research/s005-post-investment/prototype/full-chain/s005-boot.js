(function (root) {
  "use strict";

  const config = root.S005_SCENARIO_CONFIG;
  const data = root.S005_FULL_CHAIN_DATA;
  const foundation = root.OFWScenarioFoundation;
  const adapterApi = root.OFWBaselineModuleAdapter;
  if (!config || !data || !foundation || !adapterApi) throw new Error("S005 基线运行时依赖未完整加载。");

  const randomBytes = (size) => {
    if (root.crypto?.getRandomValues) {
      const bytes = new Uint8Array(size);
      root.crypto.getRandomValues(bytes);
      return bytes;
    }
    return new Uint8Array(Array.from({ length: size }, (_, index) => (index * 67 + 19) % 256));
  };

  const adapter = adapterApi.createAdapter(config, { storage: root.localStorage, randomBytes });
  adapterApi.install(adapter);

  const stepById = Object.fromEntries(config.workflow.map((step) => [step.id, step]));
  const moduleFor = (stepId) => stepById[stepId]?.moduleId || "M02";
  const now = () => new Date().toISOString();
  const context = () => adapter.context();

  function researchState() {
    return adapter.store.getResearchState?.() || { status: "待运行", running: false, events: [], completedAt: null, category: "中长期纯债基金" };
  }

  function syncRegistry() {
    const projection = adapter.store.getProjection();
    const research = researchState();
    const registry = root.OFW_COMPOSITE_REGISTRY;
    if (!registry) return;
    registry.workflow.S005 = {
      completed: projection.completeCount,
      total: projection.total,
      completedAt: research.completedAt || null,
      evidence: `ofw:v1.1.0:S005:${context().scenarioRunId}:shell`,
      status: projection.completeCount === projection.total ? "completed" : research.running ? "running" : "pending"
    };
    if (registry.scenes?.[0]) {
      registry.scenes[0].scenarioRunId = context().scenarioRunId;
      registry.scenes[0].status = registry.workflow.S005.status;
    }
    registry.chain.S005 = Object.fromEntries(config.workflow.map((step) => [step.moduleId, {
      status: projection.steps[step.id]?.status || "pending",
      refs: projection.steps[step.id]?.evidence ? [projection.steps[step.id].evidence] : []
    }]));
  }

  function dispatch() {
    syncRegistry();
    root.dispatchEvent(new CustomEvent("s005:state", { detail: { projection: adapter.store.getProjection(), research: researchState(), context: context() } }));
  }

  function writeModuleSnapshot(stepId, status, message, evidence) {
    const moduleId = moduleFor(stepId);
    const moduleStorage = adapter.store.createModuleStorage(moduleId);
    moduleStorage?.set("s005/stage-snapshot", {
      scenarioContext: context(),
      stageId: stepId,
      moduleId,
      status,
      message,
      evidence,
      sourceData: { asOf: data.meta.asOf, formulaVersion: data.meta.formulaVersion, fixture: true },
      writtenAt: now()
    });
  }

  function appendEvent(stageId, status, message, evidence = "") {
    const research = researchState();
    const event = { sequence: research.events.length + 1, at: now(), stageId, status, message, evidence, scenarioRunId: context().scenarioRunId };
    const events = [...(research.events || []), event];
    adapter.store.setResearchState({ ...research, events });
    const shellStorage = adapter.store.createScenarioStorage("s005-research");
    shellStorage?.set(`events/${String(event.sequence).padStart(3, "0")}`, event);
    return event;
  }

  function setStep(stepId, status, message, evidence = "") {
    const complete = status === "complete" || status === "verified";
    adapter.store.setStep(stepId, { status, complete, detail: message, reason: message, evidence, at: now() });
    writeModuleSnapshot(stepId, status, message, evidence);
    appendEvent(stepId, status, message, evidence);
    dispatch();
  }

  const wait = (ms) => new Promise((resolve) => root.setTimeout(resolve, ms));
  let runPromise = null;

  async function runChain() {
    if (runPromise) return runPromise;
    runPromise = (async () => {
      const current = researchState();
      adapter.store.setResearchState({ ...current, status: "运行中", running: true, completedAt: null, startedAt: now() });
      appendEvent("S005", "开始", "以 v1.1.0 基线适配器启动 S005 研究闭环", `baseline=${config.baselineVersion}; snapshot=${config.baselineSnapshotId}`);
      dispatch();
      for (const step of config.workflow) {
        setStep(step.id, "running", `${step.title}正在读取当前轮次证据`, `${step.moduleId} / ${context().scenarioRunId}`);
        await wait(360);
        setStep(step.id, "complete", `${step.title}已形成确定性研究输出`, `stage://${context().scenarioRunId}/${step.id}`);
        await wait(120);
      }
      const finished = researchState();
      adapter.store.setResearchState({ ...finished, status: "研究草稿", running: false, completedAt: now() });
      appendEvent("M06", "研究草稿", "形成研究报告草稿，保留部分评价和研究夹具状态", `report://${context().scenarioRunId}/S005-RESEARCH-DRAFT`);
      dispatch();
      return adapter.store.getProjection();
    })().finally(() => { runPromise = null; });
    return runPromise;
  }

  function completeFromModule(stepId) {
    const projection = adapter.store.getProjection();
    const step = stepById[stepId];
    if (!step) return { ok: false, reason: "未登记阶段" };
    if (step.prerequisite && !projection.steps[step.prerequisite]?.complete) {
      const reason = `请先完成“${stepById[step.prerequisite].title}”。`;
      appendEvent(stepId, "blocked", reason, "prerequisite");
      dispatch();
      return { ok: false, reason };
    }
    setStep(stepId, "complete", `${step.title}由对应基线模块确认`, `manual://${context().scenarioRunId}/${stepId}`);
    return { ok: true };
  }

  function reset() {
    const result = adapter.store.resetCurrentScenario();
    root.OFW_ACTIVE_SCENARIO_ADAPTER = adapter;
    // Seed a fresh module manifest in the new run without touching history.
    config.workflow.forEach((step) => writeModuleSnapshot(step.id, "pending", step.summary, `stage://${adapter.context().scenarioRunId}/${step.id}`));
    adapter.store.setResearchState({ status: "待运行", running: false, events: [], completedAt: null, category: "中长期纯债基金", resetReceipt: result.resetReceipt || null });
    appendEvent("S005", "新轮次", "调用 v1.1.0 Foundation directionalReset，当前轮次已隔离重建", `removed=${result.resetReceipt?.removedStorageKeyCount || 0}`);
    dispatch();
    return result;
  }

  root.OFW_COMPOSITE_REGISTRY = {
    schemaVersion: "ofw.composite-resource-registry.v1",
    productBaseline: "v1.1.0",
    governanceBaseline: config.governanceBaselineVersion,
    baselineSnapshotId: config.baselineSnapshotId,
    scenes: [{ scenarioId: config.scenarioId, scenarioVersion: config.scenarioVersion, scenarioRunId: context().scenarioRunId, name: config.name, domain: "投后评价", dataAsOf: config.dataAsOf, status: "running" }],
    workflow: { S005: { completed: 0, total: config.workflow.length, completedAt: null, evidence: null, status: "pending" } },
    chain: { S005: {} },
    dashboards: [{ id: "s005", name: "投后评价研究驾驶舱", status: "research", dataAsOf: config.dataAsOf }]
  };
  syncRegistry();

  // The native seed is deliberately small and deterministic. It writes only
  // S005 module namespaces; no Published resource, report, action or todo is
  // created. Each module page reads the same snapshot through its adapter.
  config.workflow.forEach((step) => writeModuleSnapshot(step.id, "pending", step.summary, `stage://${context().scenarioRunId}/${step.id}`));

  root.OFW_S005_RUNNER = Object.freeze({ runChain, completeFromModule, reset, setStep, appendEvent, state: researchState, projection: () => adapter.store.getProjection(), context });
  root.S005_RUNNER = root.OFW_S005_RUNNER;

  const script = root.document.createElement("script");
  script.src = "./app.js?v=s005-v110-injected-5";
  root.document.body.appendChild(script);
})(typeof window !== "undefined" ? window : globalThis);
