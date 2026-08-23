(function () {
  "use strict";

  const STORAGE_KEY = "ofw.composite.runtime.v2";
  const BASELINE = "BSL-S001-V103-DE0119608E26";
  const STEP_LABELS = [
    "数据接入", "管道运行", "数据资产发布", "本体映射", "Published 发布",
    "智能问数", "Rule 命中", "Action Request", "人工确认", "负责人待办",
    "报告生成", "确定性核验", "HTML/PDF 发布", "报告伴读", "当前数据比较"
  ];
  const SCENARIOS = [
    {
      id: "S001", version: "S001-v1", name: "集团融资成本与债务结构优化", domain: "融资管理",
      total: 15, asOf: "2025-12-31", source: "融资一览表_一期演示数据.xlsx",
      runRef: "S001-RUN-20260816081748567-705ac89fb83a", color: "blue",
      asset: "FIN-ASSET-20251231-v02", ontology: "semantic-MSVJM48O-VJC6 / V1",
      report: "RPT-20260816-092626-010 / 2.0", evidence: "EP-20260816-092248-003",
      highlights: ["21,613.387 亿元融资余额", "2.372231% 加权融资成本", "3 条 Rule / 3 条 Action Request"],
      query: "集团、单位组合融资成本与银行协商优先级",
      actionSummary: "3 条请求；1 条已确认并形成待办；2 条待决策"
    },
    {
      id: "S002", version: "S002-v1", name: "预算监督管理", domain: "预算管理",
      total: 13, asOf: "2025-12-31", source: "8 份预算工作簿 / 5 个逻辑数据源",
      runRef: "S002-RUN-20260815080000000-03862da8e71a", color: "violet",
      asset: "S002-BUDGET-EXEC-v1 / S002-PROJECT-OCC-v1", ontology: "T019-S002-v1",
      report: "预算专题报告草稿 / Dashboard Version", evidence: "426 项检查 / 58 项事实",
      highlights: ["5 个逻辑数据源", "2 条独立管道", "6 个预算监督专题"],
      query: "预算执行率、项目余额、采购占用与供应商人月成本",
      actionSummary: "当前范围保持 0 条 Action Request / 0 条待办"
    },
    {
      id: "S003", version: "S003-v1", name: "债务风险监测", domain: "风险管理",
      total: 15, asOf: "2025-12-31", source: "财务数据 + 调节因子",
      runRef: "S003-RUN-20260817163000000-c02200000001", color: "amber",
      asset: "S003-T007-FORMAL-CANDIDATE-20251231-v1", ontology: "S003-M01-DEBT-RISK-PKG 1.0.2",
      report: "21 份企业风险评估报告", evidence: "CP38 / C035 / 21 家企业",
      highlights: ["21 家企业评分", "黄/红/黑风险分档", "成员单位接口人两阶段分办"],
      query: "企业风险评分、弱项指标与风险行动候选",
      actionSummary: "风险候选进入人工确认；不自动重放历史行动"
    },
    {
      id: "S004", version: "S004-v2.1.0", name: "财务公司贷款贷前调查", domain: "授信管理",
      total: 15, asOf: "2026-08-15", source: "年度报告 + 贷前调查资料包",
      runRef: "S004-RUN-20260815233000000-7f3c8e42a1b6", color: "green",
      asset: "S004-T007-LOAN-PREFLIGHT-v2", ontology: "ONTO-S004-LOAN-PREFLIGHT-002 / 2.0.0",
      report: "S004-PLR-2026-0001 / HTML + PDF", evidence: "S004 固定事实包 / 18 项核验",
      highlights: ["财务公司主体", "借款人资格与成员关系", "人工确认后进入待发布"],
      query: "本场景不适用标准智能问数，报告伴读基于固定事实包",
      actionSummary: "M04 保持空 Action Request 队列；授信结论必须人工确认"
    }
  ];

  const modules = [
    { id: "data", name: "数据工程", icon: "database", desc: "所有场景的数据源、快照、管道、资产版本与质量。" },
    { id: "ontology", name: "本体管理", icon: "network", desc: "所有场景 Published 本体、对象、指标、规则和行动类型。" },
    { id: "query", name: "智能问数", icon: "sparkles", desc: "跨场景问数 Agent、固定问题、结果和证据引用。" },
    { id: "decision", name: "决策中心", icon: "target", desc: "跨场景 Action Request、人工确认、待办和运营摘要。" },
    { id: "agent", name: "Agent 应用", icon: "bot", desc: "报告伴读、异常分析、配置、Run、Result 和证据。" },
    { id: "report", name: "报告中心", icon: "file", desc: "跨场景报告定义、仪表盘、核验、HTML/PDF 和比较。" },
    { id: "dashboard", name: "仪表盘", icon: "chart", desc: "跨场景经营概览、场景对比与主题分析。" }
  ];
  const DETAIL_SOURCES = {
    S001: {
      data: "../data-engineering-prototype-review/review-v3/方案B2.html#/resources",
      ontology: "../ontology-management-review/canvas-first/index.html#modeling",
      query: "../intelligent-query-prototype/review-next/conversation-workspace/index.html#/ask",
      decision: "../decision-center-prototype/review-v2/action-portfolio.html#workbench",
      agent: "../agent-application/Agent应用.html#/agents",
      report: "../report-center/review-lifecycle/index.html#/lifecycle"
    },
    S002: {
      data: "../scenarios/s002/baseline-adapters/data-engineering-prototype-review/review-v3/方案B2.html#/resources",
      ontology: "../scenarios/s002/baseline-adapters/ontology-management-review/canvas-first/index.html#modeling",
      query: "../scenarios/s002/baseline-adapters/intelligent-query-prototype/review-next/conversation-workspace/index.html#/ask",
      decision: "../scenarios/s002/baseline-adapters/m04/decision-center-prototype/review-v2/action-portfolio.html#workbench",
      agent: "../scenarios/s002/baseline-adapters/m05/agent-application/Agent应用.html#/agents",
      report: "../scenarios/s002/baseline-adapters/m06/report-center/review-lifecycle/index.html#/lifecycle"
    },
    S003: {
      data: "../composition-sources/s003-cp38/data-engineering-prototype-review/review-v3/方案B2.html#/resources",
      ontology: "../composition-sources/s003-cp38/ontology-management-review/canvas-first/index.html#modeling",
      query: "../composition-sources/s003-cp38/intelligent-query-prototype/review-next/conversation-workspace/index.html#/ask",
      decision: "../composition-sources/s003-cp38/decision-center-prototype/review-v2/action-portfolio.html#workbench",
      agent: "../composition-sources/s003-cp38/agent-application/Agent应用.html#/agents",
      report: "../composition-sources/s003-cp38/report-center/review-lifecycle/index.html#/lifecycle"
    },
    S004: {
      data: "../scenarios/s004-runtime-v2.1.0/baseline-module-loader.html?moduleId=M02&source=./baseline-modules/m02-data-engineering.html",
      ontology: "../scenarios/s004-runtime-v2.1.0/baseline-module-loader.html?moduleId=M01&source=../../../../prototype-releases/v1.0.3/ontology-management-review/canvas-first/index.html",
      query: "../scenarios/s004-runtime-v2.1.0/baseline-module-loader.html?moduleId=M03&source=../../../../prototype-releases/v1.0.3/intelligent-query-prototype/review-next/conversation-workspace/index.html",
      decision: "../scenarios/s004-runtime-v2.1.0/baseline-module-loader.html?moduleId=M04&source=../../../../prototype-releases/v1.0.3/decision-center-prototype/review-v2/action-portfolio.html",
      agent: "../scenarios/s004-runtime-v2.1.0/baseline-module-loader.html?moduleId=M05&source=../../../../prototype-releases/v1.0.3/agent-application/Agent应用.html",
      report: "../scenarios/s004-runtime-v2.1.0/baseline-module-loader.html?moduleId=M06&source=../../../../prototype-releases/v1.0.3/report-center/review-lifecycle/index.html"
    }
  };

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function createRunId(id) {
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 17);
    const random = Math.random().toString(16).slice(2, 14).padEnd(12, "0").slice(0, 12);
    return `${id}-RUN-${stamp}-${random}`;
  }
  function initialScenario(scenario) {
    return {
      scenarioId: scenario.id,
      scenarioVersion: scenario.version,
      runStatus: "not-started",
      stepIndex: 0,
      scenarioRunId: null,
      startedAt: null,
      completedAt: null,
      currentStep: null,
      history: [],
      outputs: null
    };
  }
  function createInitialState() {
    return {
      schemaVersion: 2,
      baselineSnapshotId: BASELINE,
      activeModule: "home",
      scenarios: Object.fromEntries(SCENARIOS.map((scenario) => [scenario.id, initialScenario(scenario)])),
      activity: []
    };
  }
  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || saved.schemaVersion !== 2) return createInitialState();
      const initial = createInitialState();
      return {
        ...initial,
        ...saved,
        scenarios: Object.fromEntries(SCENARIOS.map((scenario) => [scenario.id, {
          ...initial.scenarios[scenario.id],
          ...(saved.scenarios?.[scenario.id] || {})
        }]))
      };
    } catch (_) { return createInitialState(); }
  }
  let state = loadState();
  const listeners = new Set();
  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    listeners.forEach((listener) => listener(state));
  }
  function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  function getScenario(id) { return SCENARIOS.find((scenario) => scenario.id === id); }
  function getState(id) { return state.scenarios[id]; }
  function statusLabel(record) {
    if (record.runStatus === "completed") return "已完成";
    if (record.runStatus === "running") return "运行中";
    if (record.runStatus === "failed") return "未通过";
    if (record.runStatus === "paused" || Number(record.stepIndex) > 0) return "已推进";
    return "未开始";
  }
  function completedCount() { return SCENARIOS.filter((scenario) => getState(scenario.id).runStatus === "completed").length; }
  function outputsFor(scenario, record) {
    if (record.runStatus !== "completed") return null;
    return {
      assetVersion: scenario.asset,
      publishedOntology: scenario.ontology,
      report: scenario.report,
      evidence: scenario.evidence,
      generatedAt: record.completedAt,
      actionSummary: scenario.actionSummary
    };
  }
  async function runScenario(id) {
    const scenario = getScenario(id); if (!scenario) return;
    const current = getState(id);
    if (current.runStatus === "running") return;
    const runId = createRunId(id);
    state = { ...state, scenarios: { ...state.scenarios, [id]: {
      ...current, runStatus: "running", stepIndex: 0, scenarioRunId: runId,
      startedAt: new Date().toISOString(), completedAt: null, currentStep: STEP_LABELS[0], outputs: null
    }}, activity: [{ id: `${runId}-start`, scenarioId: id, text: `${scenario.name} 开始运行`, at: new Date().toISOString() }, ...state.activity].slice(0, 30) };
    persist();
    for (let index = 0; index < scenario.total; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 180));
      const next = getState(id);
      state = { ...state, scenarios: { ...state.scenarios, [id]: {
        ...next, stepIndex: index + 1, currentStep: STEP_LABELS[index] || `步骤 ${index + 1}`
      }}};
      persist();
    }
    const completedAt = new Date().toISOString();
    const final = getState(id);
    state = { ...state, scenarios: { ...state.scenarios, [id]: {
      ...final, runStatus: "completed", stepIndex: scenario.total, currentStep: null, completedAt,
      outputs: outputsFor(scenario, { ...final, runStatus: "completed", completedAt })
    }}, activity: [{ id: `${runId}-done`, scenarioId: id, text: `${scenario.name} 完成 ${scenario.total}/${scenario.total} 步`, at: completedAt }, ...state.activity].slice(0, 30) };
    persist();
  }
  async function runToStep(id, targetIndex) {
    const scenario = getScenario(id); if (!scenario) return;
    const current = getState(id);
    if (current.runStatus === "running") return;
    const target = Math.max(0, Math.min(Number(targetIndex) || 0, scenario.total - 1));
    if (current.runStatus === "completed" || Number(current.stepIndex) > target) return;
    const runId = current.scenarioRunId || createRunId(id);
    const startedAt = current.startedAt || new Date().toISOString();
    state = { ...state, scenarios: { ...state.scenarios, [id]: {
      ...current, runStatus: "running", scenarioRunId: runId, startedAt,
      currentStep: STEP_LABELS[current.stepIndex] || STEP_LABELS[0]
    }}, activity: [{ id: `${runId}-step-${target}-start`, scenarioId: id, text: `${scenario.name} 开始处理${STEP_LABELS[target] || "当前步骤"}`, at: new Date().toISOString() }, ...state.activity].slice(0, 30) };
    persist();
    const start = Math.max(0, Number(current.stepIndex) || 0);
    for (let index = start; index <= target; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 240));
      const next = getState(id);
      state = { ...state, scenarios: { ...state.scenarios, [id]: {
        ...next, runStatus: "running", stepIndex: index + 1,
        currentStep: STEP_LABELS[index + 1] || null
      }}};
      persist();
    }
    const final = getState(id);
    const isComplete = final.stepIndex >= scenario.total;
    const completedAt = isComplete ? new Date().toISOString() : null;
    state = { ...state, scenarios: { ...state.scenarios, [id]: {
      ...final, runStatus: isComplete ? "completed" : "paused",
      currentStep: isComplete ? null : (STEP_LABELS[final.stepIndex] || "等待下一步"),
      completedAt, outputs: isComplete ? outputsFor(scenario, { ...final, runStatus: "completed", completedAt }) : final.outputs
    }}, activity: [{ id: `${runId}-step-${target}-done`, scenarioId: id, text: `${scenario.name} 已推进至 ${STEP_LABELS[target] || "当前步骤"}`, at: new Date().toISOString() }, ...state.activity].slice(0, 30) };
    persist();
  }
  async function runAll() {
    for (const scenario of SCENARIOS) await runScenario(scenario.id);
  }
  function resetScenario(id) {
    const scenario = getScenario(id); if (!scenario) return;
    state = { ...state, scenarios: { ...state.scenarios, [id]: initialScenario(scenario) }, activity: [{ id: `${id}-reset-${Date.now()}`, scenarioId: id, text: `${scenario.name} 已重置当前运行`, at: new Date().toISOString() }, ...state.activity].slice(0, 30) };
    persist();
  }
  function setModule(moduleId) {
    state = { ...state, activeModule: moduleId }; persist();
  }
  function getSnapshot() { return { state: clone(state), scenarios: clone(SCENARIOS), modules: clone(modules), stepLabels: clone(STEP_LABELS) }; }
  function detailSource(scenarioId, moduleId) { return DETAIL_SOURCES[scenarioId]?.[moduleId] || null; }
  window.COMPOSITE_RUNTIME = { BASELINE, SCENARIOS, modules, STEP_LABELS, DETAIL_SOURCES, detailSource, getState, getScenario, statusLabel, completedCount, loadState: getSnapshot, subscribe, runScenario, runToStep, runAll, resetScenario, setModule };
})();
