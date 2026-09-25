const clone = value => structuredClone(value);
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value)) && new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
export function newTask({
  title,
  owner,
  dueDate,
  objectIds,
  evidence,
  plan,
  existing = [],
  type = "风险复核",
}) {
  if (!title.trim() || !owner.trim() || !validDate(dueDate))
    throw new Error("请填写事项名称、负责人和有效到期日期");
  if (dueDate < new Date().toISOString().slice(0, 10))
    throw new Error("到期日期不能早于今天");
  if (!objectIds.length || !evidence?.dataVersion || !evidence?.dataDigest)
    throw new Error("缺少对象或固定依据");
  const ids = [...new Set(objectIds)].sort();
  if (
    JSON.stringify(ids) !==
    JSON.stringify([...new Set(evidence.objectIds || [])].sort())
  )
    throw new Error("事项对象与分析依据范围不一致");
  if ((plan?.id || null) !== (evidence.planId || null))
    throw new Error("事项方案与分析依据不一致");
  const dedupe = JSON.stringify([
    title.trim(),
    ids,
    evidence.dataDigest,
    plan?.id || null,
    evidence.modelRunId || null,
  ]);
  if (
    existing.some(
      (task) =>
        task.dedupe === dedupe &&
        !["COMPLETED", "CANCELLED"].includes(task.status),
    )
  )
    throw new Error("同一范围和依据下已存在未结束的同名事项");
  const at = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: title.trim(),
    owner: owner.trim(),
    dueDate,
    objectIds: ids,
    evidence: clone(evidence),
    plan: plan ? clone(plan) : null,
    type,
    status: "OPEN",
    decisionFlow: {stage:'REVIEW',approval:null,execution:[],effect:null,log:[]},
    createdAt: at,
    updatedAt: at,
    dedupe,
    externalSideEffects: 0,
    history: [{ from: null, to: "OPEN", at, note: "用户确认创建本地事项" }],
  };
}
