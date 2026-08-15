(function () {
  "use strict";

  const FOUNDATION = window.OFWScenarioFoundation;
  const DATA = window.S004_DATA;
  const VALIDATORS = window.S004Validators;
  const PROJECTIONS = window.S004Projections;

  if (!FOUNDATION || !DATA || !VALIDATORS || !PROJECTIONS) {
    throw new Error("S004 初始化依赖缺失，已阻止创建场景状态。");
  }

  const POINTER_KEY = "ofw:v1.1.0:S004:active-context";
  const HISTORY_KEY = "ofw:v1.1.0:S004:run-history";
  const EVENT_NAME = "s004:state";
  const STATE_KEY = "state/current";

  const stepResults = Object.freeze({
    configure: "已固定业务主体、借款人、申请编号、报告编号、人民币/万元口径与调查时点。",
    registerSources: "已按 official-public 与 synthetic-demo 分层登记资料来源；年报已有事实未重复造数。",
    qualityGate: "主体、申请、时点、期间、币种、单位、缺失、冲突和过期状态已完成检查。",
    publishAsset: "贷前调查数据资产版本已形成，等待 M01 按 C003 接收并绑定。",
    mapOntology: "借款人、贷款申请、财务报表、融资、征信、调查资料和报告语义映射已形成。",
    publishSemantics: "Published 语义版本与 T019/C008 权威消费指针已锁定到当前场景轮次。",
    freezeEvidence: "报告证据包已固定当前申请、数据资产、Published 语义和数据质量摘要。",
    generateDraft: "报告 Agent 已基于固定证据包生成六部分结构化草稿；没有重算正式指标。",
    bindAnchors: "章节、内容项、事实、语义资源、来源证据和核验规则已绑定稳定锚点。",
    verifyFacts: "确定性核验已检查稳定键、数据口径、事实引用、证据定位与同源发布条件。",
    publishReport: "正式 HTML 与同源 PDF 已按同一报告编号、内容版本和证据链发布。",
    companionRun: "报告伴读已建立只读 Session/Run，仅解释已发布报告与固定证据。"
  });

  function readJson(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch (_) {
      return null;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function loadContext() {
    const saved = readJson(POINTER_KEY);
    try {
      if (saved) return VALIDATORS.assertScenarioContext(saved);
    } catch (_) {}
    const initial = VALIDATORS.assertScenarioContext(DATA.initialScenarioContext);
    writeJson(POINTER_KEY, initial);
    return initial;
  }

  let context = loadContext();
  let namespacedStorage = FOUNDATION.createNamespacedStorage({
    storage: localStorage,
    context: context,
    scope: "shell"
  });

  function initialSteps() {
    return Object.fromEntries(DATA.workflow.map(function (step) {
      return [step.id, {
        status: step.initialStatus || "pending",
        updatedAt: step.initialStatus === "not_applicable" ? context.formedAt : null,
        detail: step.summary,
        evidenceRef: null
      }];
    }));
  }

  function createInitialState() {
    return {
      schemaVersion: 1,
      scenarioContext: context,
      steps: initialSteps(),
      humanDecision: {
        status: "pending",
        reviewer: "",
        role: "有权审批人",
        decision: "",
        amount: "",
        rate: "",
        note: "",
        confirmedAt: null
      },
      activity: [{
        id: "ACT-S004-INIT",
        type: "context",
        title: "S004 场景轮次已建立",
        detail: context.scenarioRunId,
        at: context.formedAt
      }],
      checkpointCandidates: [],
      external: {
        status: "not-loaded",
        artifacts: null,
        moduleExports: null,
        checkpoints: null,
        evidence: null,
        loadedAt: null
      },
      ui: {
        navCollapsed: false,
        mobileNavInitialized: false,
        lastRoute: "#home",
        selectedReportSection: "SEC-01"
      },
      savedAt: context.formedAt
    };
  }

  function hydrate(saved) {
    const initial = createInitialState();
    if (!saved || saved.schemaVersion !== 1) return initial;
    try {
      FOUNDATION.assertScenarioContextMatch(context, saved.scenarioContext);
    } catch (_) {
      return initial;
    }
    const steps = { ...initial.steps };
    Object.keys(steps).forEach(function (stepId) {
      const candidate = saved.steps && saved.steps[stepId];
      if (!candidate || !VALIDATORS.validateStepStatus(candidate.status)) return;
      steps[stepId] = {
        ...steps[stepId],
        ...candidate
      };
    });
    return {
      ...initial,
      ...saved,
      scenarioContext: context,
      steps: steps,
      humanDecision: { ...initial.humanDecision, ...(saved.humanDecision || {}) },
      activity: Array.isArray(saved.activity) ? saved.activity.slice(0, 80) : initial.activity,
      checkpointCandidates: Array.isArray(saved.checkpointCandidates) ? saved.checkpointCandidates.slice(0, 20) : [],
      external: { ...initial.external, ...(saved.external || {}) },
      ui: { ...initial.ui, ...(saved.ui || {}) }
    };
  }

  let state = hydrate(namespacedStorage.get(STATE_KEY));

  function snapshot() {
    return VALIDATORS.clone(state);
  }

  function persist(notify) {
    state.savedAt = new Date().toISOString();
    namespacedStorage.set(STATE_KEY, state);
    if (notify !== false) {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: snapshot() }));
    }
    return state;
  }

  function projection() {
    return PROJECTIONS.buildProjection(state, DATA);
  }

  function stepSatisfied(stepId) {
    const status = state.steps[stepId] && state.steps[stepId].status;
    return status === "verified" || status === "not_applicable";
  }

  function assertCanRun(stepId) {
    const step = DATA.stepById[stepId];
    if (!step) throw new Error("未知的 S004 场景步骤。");
    if (step.initialStatus === "not_applicable") throw new Error("该步骤属于已确认的不适用边界，不执行运行操作。");
    if (step.prerequisite && !stepSatisfied(step.prerequisite)) {
      throw new Error("请先完成上游步骤“" + DATA.stepById[step.prerequisite].title + "”。");
    }
    if (stepId === "humanReview") throw new Error("人工复核必须通过专用人工确认表单完成。");
    if (stepId === "publishReport" && state.humanDecision.status !== "confirmed") {
      throw new Error("最终授信结论尚未由有权审批人确认，不能发布正式报告。");
    }
    return step;
  }

  function activity(type, title, detail, at) {
    const record = {
      id: "ACT-S004-" + String(Date.now()) + "-" + String(Math.random()).slice(2, 7),
      type: type,
      title: title,
      detail: detail || "",
      at: at || new Date().toISOString()
    };
    state.activity = [record].concat(state.activity || []).slice(0, 80);
    return record;
  }

  function registerCheckpointCandidate(step, at) {
    if (!step.checkpointNode) return;
    if (state.checkpointCandidates.some(function (item) { return item.node === step.checkpointNode; })) return;
    state.checkpointCandidates.push({
      node: step.checkpointNode,
      sourceStepId: step.id,
      scenarioRunId: context.scenarioRunId,
      formedAt: at,
      status: "awaiting-owner-manifest",
      note: "浏览器只记录候选节点；正式快照以 C034 不可变清单为准。"
    });
  }

  function setStep(stepId, patch) {
    const step = DATA.stepById[stepId];
    if (!step) throw new Error("未知的 S004 场景步骤。");
    const nextStatus = patch.status || state.steps[stepId].status;
    if (!VALIDATORS.validateStepStatus(nextStatus)) throw new Error("步骤状态不合法。");
    state.steps[stepId] = {
      ...state.steps[stepId],
      ...patch,
      status: nextStatus
    };
    persist(true);
    return state.steps[stepId];
  }

  function runStep(stepId) {
    const step = assertCanRun(stepId);
    if (state.steps[stepId].status === "verified") return Promise.resolve(state.steps[stepId]);
    const startedAt = new Date().toISOString();
    setStep(stepId, {
      status: "running",
      updatedAt: startedAt,
      detail: "正在执行：" + step.action
    });
    return new Promise(function (resolve) {
      window.setTimeout(function () {
        const finishedAt = new Date().toISOString();
        const detail = stepResults[stepId] || step.summary;
        const evidenceRef = "scenario://S004/" + context.scenarioRunId + "/steps/" + stepId;
        state.steps[stepId] = {
          status: "verified",
          updatedAt: finishedAt,
          detail: detail,
          evidenceRef: evidenceRef
        };
        activity("step", step.title, detail, finishedAt);
        registerCheckpointCandidate(step, finishedAt);
        persist(true);
        resolve(state.steps[stepId]);
      }, 520);
    });
  }

  function confirmHumanDecision(input) {
    const step = DATA.stepById.humanReview;
    if (!stepSatisfied(step.prerequisite)) throw new Error("请先完成确定性核验。");
    const reviewer = String(input.reviewer || "").trim();
    const decision = String(input.decision || "").trim();
    const note = String(input.note || "").trim();
    if (!reviewer) throw new Error("请填写有权审批人或演示复核人。");
    if (!["confirm", "return"].includes(decision)) throw new Error("请选择人工确认或退回补充。");
    if (!note) throw new Error("请填写人工复核意见。");
    const confirmedAt = new Date().toISOString();
    state.humanDecision = {
      status: decision === "confirm" ? "confirmed" : "returned",
      reviewer: reviewer,
      role: "有权审批人",
      decision: decision,
      amount: String(input.amount || "").trim(),
      rate: String(input.rate || "").trim(),
      note: note,
      confirmedAt: confirmedAt
    };
    state.steps.humanReview = {
      status: decision === "confirm" ? "verified" : "blocked",
      updatedAt: confirmedAt,
      detail: decision === "confirm"
        ? "最终授信结论已由人工确认；报告仍须由报告复核与发布岗执行正式发布。"
        : "人工复核已退回补充资料，正式报告发布门保持关闭。",
      evidenceRef: "scenario://S004/" + context.scenarioRunId + "/human-review"
    };
    activity(
      "human",
      decision === "confirm" ? "人工授信结论已确认" : "人工复核已退回",
      reviewer + " · " + note,
      confirmedAt
    );
    persist(true);
    return state.humanDecision;
  }

  function setExternal(external) {
    state.external = {
      ...state.external,
      ...external,
      status: "loaded",
      loadedAt: new Date().toISOString()
    };
    persist(true);
    return state.external;
  }

  function setUi(patch) {
    state.ui = { ...state.ui, ...patch };
    persist(true);
    return state.ui;
  }

  function archiveContext(reason) {
    const history = readJson(HISTORY_KEY);
    const records = Array.isArray(history) ? history : [];
    records.unshift({
      scenarioContext: context,
      archivedAt: new Date().toISOString(),
      reason: reason || "场景定向重置"
    });
    writeJson(HISTORY_KEY, records.slice(0, 30));
  }

  function resetCurrentScenario() {
    archiveContext("用户在 S004 场景壳执行定向重置");
    const result = FOUNDATION.directionalReset({
      storage: localStorage,
      currentContext: context
    }, {
      now: new Date()
    });
    context = VALIDATORS.assertScenarioContext(result.context);
    writeJson(POINTER_KEY, context);
    namespacedStorage = FOUNDATION.createNamespacedStorage({
      storage: localStorage,
      context: context,
      scope: "shell"
    });
    state = createInitialState();
    persist(true);
    return snapshot();
  }

  function getRunHistory() {
    const value = readJson(HISTORY_KEY);
    return Array.isArray(value) ? VALIDATORS.clone(value) : [];
  }

  persist(false);

  window.S004_STORE = Object.freeze({
    POINTER_KEY: POINTER_KEY,
    EVENT_NAME: EVENT_NAME,
    get: snapshot,
    getContext: function () { return VALIDATORS.clone(context); },
    getProjection: projection,
    getRunHistory: getRunHistory,
    runStep: runStep,
    confirmHumanDecision: confirmHumanDecision,
    setExternal: setExternal,
    setUi: setUi,
    resetCurrentScenario: resetCurrentScenario
  });
})();
