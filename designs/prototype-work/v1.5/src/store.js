import { clone, taskTransitions, validDate, comparePlan } from "./domain.js";
export const KEY = "ofw.v1.5.workbench.v1";
export const defaultFilters = () => ({
  search: "",
  industry: "",
  riskTier: "",
  bankId: "",
  highCost: false,
  gapOnly: false,
  objectIds: null,
  boxIds: null,
  sort: "view",
  premiumThreshold: 0,
  ruleId: null,
  ruleRef: null,
});
export function initialState() {
  return {
    version: 1,
    filters: defaultFilters(),
    horizon: 90,
    mode: "risk",
    selectedId: null,
    selectedBankId:null,
    relationTypes:['financing'],
    rightTab: "query",
    panelOpen:false,
    view: "map",
    plans: [],
    activePlanId: null,
    queries: [],
    tasks: [],
    reports: [],
    explorations: [],
    ontologyDrafts: [],
    camera: null,
    networkCamera: null,
    tableOpen: false,
    comparisonIds: [],
    relationships: false,
  };
}
export function load(storage = localStorage) {
  try {
    const value = JSON.parse(storage.getItem(KEY) || "null");
    if (value?.version !== 1) return initialState();
    return {
      ...initialState(),
      ...value,
      filters: { ...defaultFilters(), ...value.filters },
      ...Object.fromEntries(
        [
          "plans",
          "queries",
          "tasks",
          "reports",
          "explorations",
          "ontologyDrafts",
          "comparisonIds",
        ].map((key) => [key, Array.isArray(value[key]) ? value[key] : []]),
      ),
    };
  } catch {
    return initialState();
  }
}
export function createStore(storage = localStorage, onStorageError = () => {}) {
  let state = load(storage),
    history = [],
    persistent = true;
  function write(next) {
    const serialized = JSON.stringify(next);
    try {
      storage.setItem(KEY, serialized);
      persistent = true;
    } catch (error) {
      if (persistent) onStorageError(error);
      persistent = false;
    }
    state = next;
    return state;
  }
  function update(patch, { undoable = false } = {}) {
    const prior = clone(state);
    const result = write({ ...state, ...clone(patch) });
    if (undoable) {
      history.push({
        filters: prior.filters,
        horizon: prior.horizon,
        selectedId: prior.selectedId,
        selectedBankId:prior.selectedBankId,relationships:prior.relationships,relationTypes:clone(prior.relationTypes),
        activePlanId: prior.activePlanId,
      });
      history = history.slice(-30);
    }
    return result;
  }
  function undo() {
    const previous = history.at(-1);
    if (!previous) return state;
    const next = write({ ...state, ...clone(previous) });
    history.pop();
    return next;
  }
  return {
    get: () => state,
    update,
    undo,
    canUndo: () => history.length > 0,
    isPersistent: () => persistent,
  };
}

export {newTask} from '../composite/shared/task-record.js';

export function validateRestoredState(state, data) {
  const known = new Set(data.enterprises.map((item) => item.id));
  const copy = clone(state);
  if (copy.filters.objectIds !== null && !Array.isArray(copy.filters.objectIds))
    copy.filters.objectIds = [];
  if (copy.filters.objectIds)
    copy.filters.objectIds = copy.filters.objectIds.filter((id) =>
      known.has(id),
    );
  if (copy.filters.boxIds != null)
    copy.filters.boxIds = Array.isArray(copy.filters.boxIds)
      ? [...new Set(copy.filters.boxIds.filter((id) => known.has(id)))]
      : [];
  if (copy.selectedId && !known.has(copy.selectedId)) copy.selectedId = null;
  copy.relationTypes=Array.isArray(copy.relationTypes)?[...new Set(copy.relationTypes.filter(t=>['financing','credit','guarantee'].includes(t)))]:['financing'];
  if(copy.selectedBankId&&!data.banks.some(b=>b.id===copy.selectedBankId))copy.selectedBankId=null;
  if (!Number.isInteger(copy.horizon) || copy.horizon < 1 || copy.horizon > 3660) copy.horizon = 90;
  if (!["risk", "cost", "maturity", "exposure"].includes(copy.mode))
    copy.mode = "risk";
  if (!["query", "object", "scenario", "models"].includes(copy.rightTab))
    copy.rightTab = "query";
  if (!["map", "network", "matrix", "list"].includes(copy.view)) copy.view = "map";
  const validPlans = copy.plans.filter((plan) => {
    try {
      comparePlan(data, plan);
      return true;
    } catch {
      return false;
    }
  });
  if (!validPlans.some((plan) => plan.id === copy.activePlanId))
    copy.activePlanId = null;
  copy.comparisonIds = copy.comparisonIds
    .filter((id) => validPlans.some((plan) => plan.id === id))
    .slice(0, 2);
  copy.tasks = copy.tasks.filter(
    (task) =>
      task.id &&
      taskTransitions[task.status] &&
      Array.isArray(task.history) &&
      Array.isArray(task.objectIds) &&
      task.evidence,
  );
  copy.queries = copy.queries.filter(
    (answer) =>
      answer.status !== "success" ||
      (answer.snapshot?.rows && answer.evidence?.objectIds && answer.filters),
  );
  copy.reports = copy.reports.filter(
    (report) => report.evidence && Array.isArray(report.rows) && report.totals,
  );
  if (
    copy.camera &&
    (!Array.isArray(copy.camera.center) ||
      copy.camera.center.length !== 2 ||
      !copy.camera.center.every(Number.isFinite) ||
      !Number.isFinite(copy.camera.zoom))
  )
    copy.camera = null;
  return copy;
}

export function reassignTask(task, owner, dueDate, note) {
  if (["COMPLETED", "CANCELLED"].includes(task.status))
    throw new Error("请先重开事项再调整负责人");
  if (!owner.trim() || !validDate(dueDate) || !note.trim())
    throw new Error("请填写负责人、有效日期与调整原因");
  if (dueDate < new Date().toISOString().slice(0, 10))
    throw new Error("调整后的日期不能早于今天");
  const at = new Date().toISOString();
  return {
    ...clone(task),
    owner: owner.trim(),
    dueDate,
    updatedAt: at,
    history: [
      ...task.history,
      {
        from: task.status,
        to: task.status,
        kind: "ASSIGNMENT",
        at,
        note: `负责人 ${task.owner} → ${owner.trim()}；截止 ${task.dueDate} → ${dueDate}；${note.trim()}`,
      },
    ],
  };
}

export function reportSnapshot(
  result,
  {
    title = "企业融资与风险分析报告",
    notes = "",
    plan = null,
    evidence = null,
  } = {},
) {
  if ((result.planId || null) !== (plan?.id || null))
    throw new Error("报告结果与方案身份不一致");
  if (
    plan &&
    (plan.dataDigest !== result.dataDigest ||
      plan.ontologyVersion !== result.ontologyVersion)
  )
    throw new Error("报告与方案输入版本不一致");
  if (
    evidence &&
    (evidence.dataDigest !== result.dataDigest ||
      evidence.ontologyVersion !== result.ontologyVersion ||
      evidence.horizon !== result.horizon ||
      (evidence.planId || null) !== (result.planId || null) ||
      JSON.stringify([...(evidence.objectIds || [])].sort()) !==
        JSON.stringify(result.rows.map((row) => row.id).sort()))
  )
    throw new Error("报告对象或口径与固定依据不一致");
  return {
    id: crypto.randomUUID(),
    status: "DRAFT",
    version: 1,
    title,
    notes,
    createdAt: new Date().toISOString(),
    rows: clone(result.rows),
    loans: clone(result.loans),
    totals: clone(result.totals),
    evidence: clone(
      evidence || {
        dataVersion: result.dataVersion,
        dataDigest: result.dataDigest,
        ontologyVersion: result.ontologyVersion,
        asOf: result.asOf,
        horizon: result.horizon,
        objectIds: result.rows.map((row) => row.id),
        resultKind: result.resultKind,
        planId: result.planId,
      },
    ),
    plan: plan ? clone(plan) : null,
  };
}
