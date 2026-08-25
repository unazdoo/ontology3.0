import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const runId = "S001-RUN-20260814062516042-e1fd5e6ab3f4";
const parentPath = path.resolve(directory, `../../../prototype-releases/v1.0.2/runtime-snapshots/${runId}.runtime.json`);
const outputPath = path.join(directory, `${runId}.runtime.json`);
const decisionKey = "ontology3-decision-center-review-v2-portfolio-state-v6";
const c019Key = "ontology3.decision-center.c019.projection.v1";
const integrationKey = "ontology.financial-world.s001.integration.v2";
const activeRequestId = "AR-RUN-MSST9EZK-014-UNIT-553";
const activeTaskId = "TD-6708422393";

const snapshot = JSON.parse(fs.readFileSync(parentPath, "utf8"));
const decision = JSON.parse(snapshot.localStorage[decisionKey]);
const originalRequests = structuredClone(decision.requests);
const originalTasks = structuredClone(decision.tasks);

decision.requests = decision.requests.map((request) => {
  if (request.id === activeRequestId) return request;
  const requestReceipt = (request.c017SafetyReads || []).filter((item) => item.gate === "request_receipt");
  return {
    ...request,
    status: "awaiting",
    decision: null,
    taskId: null,
    taskCreating: false,
    c017SafetyReads: requestReceipt,
    c017ReadAttempts: {
      request_receipt: requestReceipt.length || 1,
      confirmation_submit: 0,
      task_formation: 0
    },
    formation: {
      ...(request.formation || {}),
      confirmationGateStatus: "not_reached",
      confirmationGateReason: "等待用户提交正向人工确认时重新读取"
    },
    decisionAttempts: 0,
    taskCreateAttempts: 0,
    taskCreateFailureReason: null
  };
});
decision.tasks = decision.tasks.filter((task) => task.id === activeTaskId && task.requestId === activeRequestId);
decision.activity = (decision.activity || []).filter((event) => {
  if (event.requestId === activeRequestId) return true;
  return event.label === "行动请求接收并形成决策事项";
});
decision.auditHistory = [
  ...(decision.auditHistory || []),
  {
    archivedAt: "2026-08-15 00:00:00",
    reason: "父版本处理分布已保留为只读历史；当前工作分布按一条代表性闭环恢复",
    scenarioContext: decision.scenarioContext,
    counts: {
      requests: originalRequests.length,
      reminders: originalRequests.filter((item) => item.reminderId).length,
      confirmations: originalRequests.filter((item) => item.decision).length,
      tasks: originalTasks.length,
      activity: 0
    },
    records: { requests: originalRequests, tasks: originalTasks, receipts: [], activity: [] }
  }
];
decision.stateRevision = Number(decision.stateRevision || 0) + 1;
decision.pageStates = {
  ...(decision.pageStates || {}),
  workbench: {
    ...(decision.pageStates?.workbench || {}),
    restoreContext: { view: "reminders", search: "", source: "all", status: "awaiting", layout: "list", scrollTop: 0 }
  }
};

function targetRef(type, id, context, routeId = id) {
  if (!id) return null;
  const route = { request: "request", reminder: "reminder", task: "task", trace: "trace/request" }[type];
  const params = new URLSearchParams({
    scenarioId: context.scenarioId,
    scenarioVersion: context.scenarioVersion,
    scenarioRunId: context.scenarioRunId,
    scenarioStatus: context.status || "active"
  });
  return {
    targetType: type,
    targetId: id,
    stableDetailEntry: `/decision-center-prototype/index.html?${params}#${route}/${encodeURIComponent(routeId)}`
  };
}

const c019 = {
  contractCode: "C019",
  schemaVersion: 1,
  owner: "决策中心",
  consumer: "报告中心",
  scenarioContext: decision.scenarioContext,
  summaryAsOf: "2026-08-15 00:00:00",
  status: "可读取",
  records: decision.requests.map((request) => {
    const task = decision.tasks.find((item) => item.requestId === request.id) || null;
    return {
      scenarioContext: request.scenarioContext,
      requestStatus: request.status,
      reminderStatus: request.reminderId ? (request.decision ? "已处理" : "待决策") : null,
      decisionStatus: request.decision?.type || null,
      taskStatus: task?.status || null,
      businessSubject: { id: request.subjectId, name: request.subjectName },
      semanticVersion: request.evidence.semanticVersion,
      dataVersion: request.evidence.dataVersion,
      requestRef: targetRef("request", request.id, decision.scenarioContext),
      reminderRef: targetRef("reminder", request.reminderId, decision.scenarioContext),
      taskRef: targetRef("task", task?.id || null, decision.scenarioContext),
      traceRef: targetRef("trace", request.traceId || null, decision.scenarioContext, request.id),
      navigationContext: {
        sourceScene: request.scenario,
        businessSubject: request.subjectName,
        filter: null,
        returnRoute: null,
        returnPosition: null
      }
    };
  })
};

const integration = JSON.parse(snapshot.localStorage[integrationKey]);
const decisionPosition = integration.scenarios?.S001?.framePositions?.decision;
if (decisionPosition?.href) decisionPosition.href = decisionPosition.href.replace(/#.*$/, "#workbench");

snapshot.prototypeVersion = "1.0.3";
snapshot.derivedFrom = {
  prototypeVersion: "1.0.2",
  runtimeSha256: "565208eb3040d3de2eed1bdfac65a639d4653cc0f95912986e436d7a0eef8edb",
  transformation: "one representative decision and task remain active; four requests remain awaiting decision"
};
snapshot.localStorage[decisionKey] = JSON.stringify(decision);
snapshot.localStorage[c019Key] = JSON.stringify(c019);
snapshot.localStorage[integrationKey] = JSON.stringify(integration);
delete snapshot.sessionStorage["ontology3-decision-center-view-v2-portfolio"];

fs.writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
