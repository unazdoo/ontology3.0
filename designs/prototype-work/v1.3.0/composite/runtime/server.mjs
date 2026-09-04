import http from "node:http";
import { pathToFileURL } from "node:url";
import { createServer as createParentModelingServer } from "../../../v1.2.0/composite/modules/modeling/validation/src/server.mjs";
import {
  findCompatibleObjectives as findParentCompatibleObjectives,
  getObjective as getParentObjective,
  listObjectives as listParentObjectives,
  projectObjectiveForConsumer as projectParentObjectiveForConsumer,
  validateObjectiveBinding as validateParentObjectiveBinding
} from "../../../v1.2.0/composite/modules/modeling/validation/src/objective-registry.mjs";
import { createModelPortfolioRuntime } from "./model-portfolio-engine.mjs";
import { createModelRepositoryService } from "./model-repository-service.mjs";
import { S003_REGISTRATION } from "./s003-registration.mjs";
import {
  getScenarioModelRegistration,
  listScenarioModelRegistrations,
  SCENARIO_MODEL_REGISTRATIONS
} from "./scenario-model-registrations.mjs";
import {
  DEFAULT_SCENARIO_CONTEXT,
  OBJECTIVE_ID,
  legacyBindingValidation,
  legacyObjectiveCatalog,
  legacyObjectiveDetail,
  legacyResultEnvelope,
  legacyWorkspace
} from "./legacy-adapter.mjs";

const MAX_BODY_BYTES = 128 * 1024;

function json(response, status, body) {
  const payload = JSON.stringify(body, null, 2);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "x-ofw-namespace": "ofw.modeling.continuous-optimization.v1"
  });
  response.end(payload);
}

async function readJsonBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      const error = new Error("Request body exceeds 128 KiB.");
      error.code = "REQUEST_TOO_LARGE";
      throw error;
    }
  }
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.code = "INVALID_JSON";
    throw error;
  }
}

function defaultRuntimeRegistry(s003Runtime = null) {
  return new Map(Object.entries(SCENARIO_MODEL_REGISTRATIONS).map(([scenarioId, registration]) => {
    const runtime = scenarioId === "S003" && s003Runtime ? s003Runtime : createModelPortfolioRuntime(registration);
    for (const action of registration.seedActions || []) runtime.action(action);
    return [scenarioId, runtime];
  }));
}

function runtimeFor(registry, scenarioId) {
  const id = String(scenarioId || "").toUpperCase();
  const runtime = registry.get(id);
  if (!runtime) throw Object.assign(new Error(`Unknown model-management scenario: ${id || "missing"}`), { code: "SCENARIO_NOT_REGISTERED" });
  return { scenarioId: id, runtime, registration: getScenarioModelRegistration(id) };
}

function fallbackMetricCards(benchmark) {
  const labels = {
    recallAtFixedCapacity: "固定复核量召回率",
    precisionAtFixedCapacity: "固定复核量准确率",
    prAuc: "高风险识别效果",
    brierScore: "概率校准误差",
    calibrationError: "概率校准误差",
    coverage: "数据覆盖率",
    primaryMetric: "主要评测指标",
    stability: "结果稳定性",
    drift: "数据漂移"
  };
  return Object.entries(benchmark?.metrics || {}).filter(([, value]) => Number.isFinite(Number(value))).slice(0, 4).map(([key, value]) => ({
    id: key,
    label: labels[key] || key,
    value,
    format: ["coverage", "recallAtFixedCapacity", "precisionAtFixedCapacity"].includes(key) ? "percent" : "decimal",
    direction: ["calibrationError", "brierScore", "drift"].includes(key) ? "lower" : "higher",
    note: "当前评测运行的固定口径。"
  }));
}

function modelManagementContext(registration, runtime) {
  const state = runtime.state();
  const objectives = legacyObjectiveCatalog(listParentObjectives()).filter((item) => item.scenarioIds?.includes(registration.scenario.scenarioId));
  const benchmark = state.benchmarks.at(-1) || null;
  const capabilities = { currentCycleReset: false, nextCycleStart: false, pressureSimulation: true, rollback: true, ...(registration.capabilities || {}) };
  const nextAction = state.nextAction?.id === "start-next-cycle" && !capabilities.nextCycleStart
    ? null
    : state.nextAction;
  const bridge = registration.scenario.scenarioId === "S003"
    ? {
        workspaceMessageEnabled: true,
        workspaceMessageType: "OFW_M08_WORKSPACE_STATE",
        objectiveId: OBJECTIVE_ID,
        workspace: legacyWorkspace(state),
        factWriteAllowed: false,
        actionWriteAllowed: false,
        actionSourceAllowed: false
      }
    : { workspaceMessageEnabled: false };
  return {
    schemaVersion: "ofw.model-management.context.v1",
    module: { moduleId: "M08", name: "模型优化中心", navigationMode: "VERTICAL_TASK_FLOW" },
    scenario: state.scenario,
    ui: registration.ui || { moduleName: "模型优化中心", domain: state.scenario.domain || "业务模型", businessName: state.scenario.businessName, subjectLabel: "业务对象", consumerLabel: "业务驾驶舱" },
    objectives,
    state: { ...state, nextAction },
    benchmarkCards: benchmark?.metricCards || fallbackMetricCards(benchmark),
    capabilities,
    lifecycle: [
      { id: "data-contract", label: "数据与语义", complete: Boolean(state.data?.immutable && state.semanticContract) },
      { id: "benchmark", label: "统一评测", complete: Boolean(state.modelRuns.length) },
      { id: "review", label: "洞察审查", complete: state.insightReview?.decision === "APPROVED" },
      { id: "candidate", label: "候选版本", complete: Boolean(state.candidates.length) },
      { id: "shadow", label: "影子试运行", complete: Boolean(state.shadowTrial) },
      { id: "release", label: "发布与应用", complete: state.consumerBinding?.status === "APPLIED" }
    ],
    bridge,
    boundaries: state.boundaries,
    acceptanceReady: false
  };
}

export function createServer({ runtime = null, runtimes = null } = {}) {
  const runtimeRegistry = runtimes || defaultRuntimeRegistry(runtime);
  const s003Runtime = runtimeRegistry.get("S003");
  const repositoryService = createModelRepositoryService({
    getScenarioState(scenarioId) {
      return runtimeFor(runtimeRegistry, scenarioId).runtime.state();
    }
  });
  const parentServer = createParentModelingServer();
  return http.createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    try {
      if (request.method === "OPTIONS") {
        response.writeHead(204, {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "content-type",
          "cache-control": "no-store"
        });
        response.end();
        return;
      }
      if (request.method === "GET" && url.pathname === "/v1/objectives") {
        json(response, 200, {
          namespace: "ofw.m08.research.v1",
          resourceKind: "ModelingObjectiveCatalog",
          objectives: legacyObjectiveCatalog(listParentObjectives())
        });
        return;
      }
      if (request.method === "GET" && url.pathname === "/v1/model-management/scenarios") {
        json(response, 200, {
          schemaVersion: "ofw.model-management.scenario-catalog.v1",
          moduleName: "模型优化中心",
          scenarios: listScenarioModelRegistrations(),
          acceptanceReady: false
        });
        return;
      }
      if (request.method === "GET" && url.pathname === "/v1/model-management/context") {
        const { runtime: selectedRuntime, registration } = runtimeFor(runtimeRegistry, url.searchParams.get("scenarioId"));
        json(response, 200, modelManagementContext(registration, selectedRuntime));
        return;
      }
      if (request.method === "GET" && url.pathname === "/v1/model-management/repositories") {
        json(response, 200, repositoryService.list(url.searchParams.get("scenarioId")));
        return;
      }
      const repositoryMatch = url.pathname.match(/^\/v1\/model-management\/repositories\/([^/]+)$/);
      if (request.method === "GET" && repositoryMatch) {
        json(response, 200, repositoryService.detail(
          url.searchParams.get("scenarioId"),
          decodeURIComponent(repositoryMatch[1]),
          { branch: url.searchParams.get("branch") || undefined, commitId: url.searchParams.get("commitId") || undefined }
        ));
        return;
      }
      const repositoryActionMatch = url.pathname.match(/^\/v1\/model-management\/repositories\/([^/]+)\/(run|test|branches|commits|tags|release-candidates)$/);
      if (request.method === "POST" && repositoryActionMatch) {
        const body = await readJsonBody(request);
        const modelId = decodeURIComponent(repositoryActionMatch[1]);
        const operation = repositoryActionMatch[2];
        const scenarioId = body.scenarioId || url.searchParams.get("scenarioId");
        const payload = body.payload || body;
        const result = operation === "run"
          ? await repositoryService.runRepository(scenarioId, modelId, payload)
          : operation === "test"
            ? await repositoryService.testRepository(scenarioId, modelId, payload)
            : operation === "branches"
              ? repositoryService.createBranch(scenarioId, modelId, payload)
              : operation === "commits"
                ? repositoryService.commit(scenarioId, modelId, payload)
                : operation === "tags"
                  ? repositoryService.tag(scenarioId, modelId, payload)
                  : repositoryService.releaseCandidate(scenarioId, modelId, payload);
        json(response, 200, result);
        return;
      }
      const managementActionMatch = url.pathname.match(/^\/v1\/model-management\/actions\/([a-z0-9-]+)$/);
      if (request.method === "POST" && managementActionMatch) {
        const body = await readJsonBody(request);
        const { runtime: selectedRuntime, registration } = runtimeFor(runtimeRegistry, body.scenarioId);
        const action = managementActionMatch[1];
        if (action === "reset-current-cycle" && registration.capabilities?.currentCycleReset !== true) throw Object.assign(new Error("当前场景由既有数据与语义版本继续运营，不在此处重置数据周期。"), { code: "CYCLE_RESET_NOT_AVAILABLE" });
        if (action === "start-next-cycle" && registration.capabilities?.nextCycleStart !== true) throw Object.assign(new Error("当前场景的新数据周期由数据工程入口发起。"), { code: "NEXT_CYCLE_START_NOT_AVAILABLE" });
        selectedRuntime.action(action, body.payload || {});
        json(response, 200, modelManagementContext(registration, selectedRuntime));
        return;
      }
      if (request.method === "POST" && url.pathname === "/v1/model-management/guard") {
        const body = await readJsonBody(request);
        const { runtime: selectedRuntime } = runtimeFor(runtimeRegistry, body.scenarioId);
        json(response, 200, selectedRuntime.guard(body.resultKind));
        return;
      }
      if (request.method === "GET" && url.pathname === "/v1/objectives/compatible") {
        const scenarioId = url.searchParams.get("scenarioId");
        const objectTypeRef = url.searchParams.get("objectTypeRef");
        const useKind = url.searchParams.get("useKind") || null;
        const parent = findParentCompatibleObjectives({ objectTypeRef, useKind, scenarioId });
        const supplements = scenarioId === "S003" && ["Enterprise", "EnterpriseAssessmentContext"].includes(String(objectTypeRef || "").split("@")[0])
          ? legacyObjectiveCatalog([])
          : [];
        json(response, 200, { namespace: "ofw.m08.research.v1", resourceKind: "CompatibleObjectiveSet", objectTypeRef, useKind, objectives: [...parent, ...supplements] });
        return;
      }
      const objectiveMatch = url.pathname.match(/^\/v1\/objectives\/([^/]+)$/);
      if (request.method === "GET" && objectiveMatch) {
        const objectiveId = decodeURIComponent(objectiveMatch[1]);
        let parentDetail = null;
        try { parentDetail = getParentObjective(objectiveId); } catch (_) {}
        const supplement = S003_REGISTRATION.objectives.some((item) => item.objectiveId === objectiveId && objectiveId !== "MO-S003-FORMAL-DEBT-RISK-SCORE-v1");
        if (!parentDetail && !supplement) throw Object.assign(new Error(`Unknown modeling objective: ${objectiveId}`), { code: "OBJECTIVE_NOT_FOUND" });
        json(response, 200, legacyObjectiveDetail(objectiveId, parentDetail));
        return;
      }
      const objectiveBindingMatch = url.pathname.match(/^\/v1\/objectives\/([^/]+)\/binding\/validate$/);
      if (request.method === "POST" && objectiveBindingMatch) {
        const objectiveId = decodeURIComponent(objectiveBindingMatch[1]);
        const body = await readJsonBody(request);
        const supplemental = S003_REGISTRATION.objectives.some((item) => item.objectiveId === objectiveId && objectiveId !== "MO-S003-FORMAL-DEBT-RISK-SCORE-v1");
        const result = supplemental
          ? { ...(body.binding || legacyObjectiveDetail(objectiveId, null).bindingDraft), status: "SCHEMA_VALIDATED_RELEASE_REQUIRED", compatibility: "VALIDATED", activationStatus: "BLOCKED_RELEASE_NOT_APPROVED", concreteEndpointExposed: false, t019WriteAllowed: false }
          : validateParentObjectiveBinding({ objectiveId, binding: body.binding || null });
        json(response, 200, result);
        return;
      }
      const objectiveConsumerMatch = url.pathname.match(/^\/v1\/objectives\/([^/]+)\/consumer-projection$/);
      if (request.method === "GET" && objectiveConsumerMatch) {
        const objectiveId = decodeURIComponent(objectiveConsumerMatch[1]);
        const consumerId = url.searchParams.get("consumerId");
        const supplemental = S003_REGISTRATION.objectives.some((item) => item.objectiveId === objectiveId && objectiveId !== "MO-S003-FORMAL-DEBT-RISK-SCORE-v1");
        if (!supplemental) {
          json(response, 200, projectParentObjectiveForConsumer({ objectiveId, consumerId }));
          return;
        }
        const detail = legacyObjectiveDetail(objectiveId, null);
        const consumer = detail.consumers.find((item) => item.consumerId === consumerId);
        if (!consumer?.allowed) {
          json(response, 200, { objectiveId, consumerId, status: "BLOCKED", code: "NON_FACT_SOURCE_REJECTED", reason: "非正式结果不能作为行动来源", resultKindAccepted: false, factWriteAllowed: false, actionWriteAllowed: false, actionSourceAllowed: false, sideEffectsEmitted: 0 });
          return;
        }
        json(response, 200, { objectiveId, objectiveRevisionId: detail.revisionId, consumerId, consumerName: consumer.name, status: "COMPATIBLE_RESEARCH_PREVIEW", permissionScope: "prediction.read", displayMode: consumer.displayMode, bindingRef: { bindingId: detail.binding.bindingId, revision: detail.binding.revision }, releaseSelector: detail.release, outputContract: detail.outputContract, result: detail.sampleResult, factWriteAllowed: false, actionWriteAllowed: false, actionSourceAllowed: false, sideEffectsEmitted: 0 });
        return;
      }
      if (request.method === "GET" && url.pathname === "/v1/s003/workspace") {
        json(response, 200, legacyWorkspace(s003Runtime.state()));
        return;
      }
      if (request.method === "POST" && url.pathname === "/v1/s003/reset") {
        await readJsonBody(request);
        json(response, 200, legacyWorkspace(s003Runtime.action("reset-current-cycle")));
        return;
      }
      if (request.method === "POST" && url.pathname === "/v1/s003/benchmark/run") {
        await readJsonBody(request);
        let state = s003Runtime.state();
        if (!state.benchmarks.some((item) => item.scope === "BASELINE_VALIDATION")) state = s003Runtime.action("benchmark-baseline");
        if (!state.modelRuns.length) state = s003Runtime.action("run-models");
        else if (state.shadowTrial?.status === "MATURED" && !state.benchmarks.some((item) => item.scope === "MATURED_SHADOW_LABELS")) state = s003Runtime.action("rebenchmark");
        json(response, 200, legacyWorkspace(state));
        return;
      }
      if (request.method === "POST" && url.pathname === "/v1/s003/insights/generate") {
        await readJsonBody(request);
        let state = s003Runtime.state();
        if (!state.modelRuns.length) state = s003Runtime.action("run-models");
        if (!state.insights.length || state.insightReview?.decision === "REJECTED") state = s003Runtime.action("generate-insights");
        json(response, 200, legacyWorkspace(state));
        return;
      }
      if (request.method === "POST" && url.pathname === "/v1/s003/insights/review") {
        const body = await readJsonBody(request);
        const state = s003Runtime.action("review-insights", { decision: body.decision, reviewedBy: body.reviewedBy, comment: body.comment });
        json(response, 200, legacyWorkspace(state));
        return;
      }
      if (request.method === "POST" && ["/v1/s003/candidates/generate", "/v1/s003/candidates/evaluate"].includes(url.pathname)) {
        await readJsonBody(request);
        let state = s003Runtime.state();
        if (!state.candidates.length) state = s003Runtime.action("create-candidate");
        json(response, 200, legacyWorkspace(state));
        return;
      }
      if (request.method === "POST" && url.pathname === "/v1/s003/shadow/start") {
        const body = await readJsonBody(request);
        let state = s003Runtime.state();
        if (!state.shadowTrial) state = s003Runtime.action("start-shadow", body);
        json(response, 200, legacyWorkspace(state));
        return;
      }
      if (request.method === "POST" && url.pathname === "/v1/s003/shadow/advance") {
        await readJsonBody(request);
        let state = s003Runtime.state();
        if (state.shadowTrial?.status === "ACTIVE") state = s003Runtime.action("advance-shadow");
        json(response, 200, legacyWorkspace(state));
        return;
      }
      if (request.method === "POST" && url.pathname === "/v1/s003/release-candidates/form") {
        await readJsonBody(request);
        let state = s003Runtime.state();
        if (!state.releaseCandidate) state = s003Runtime.action("form-release");
        json(response, 200, legacyWorkspace(state));
        return;
      }
      if (request.method === "POST" && url.pathname === "/v1/s003/bindings/validate") {
        await readJsonBody(request);
        let state = s003Runtime.state();
        if (!state.consumerBinding || state.consumerBinding.validationStatus !== "VALID") state = s003Runtime.action("validate-binding");
        json(response, 200, legacyWorkspace(state));
        return;
      }
      if (request.method === "POST" && url.pathname === "/v1/s003/bindings/apply-default") {
        const body = await readJsonBody(request);
        let state = s003Runtime.state();
        if (state.consumerBinding?.status !== "APPLIED") state = s003Runtime.action("apply-binding", { confirmed: body.confirmed === true, confirmedBy: body.confirmedBy });
        json(response, 200, legacyWorkspace(state));
        return;
      }
      if (request.method === "POST" && url.pathname === "/v1/s003/results/recalculate") {
        const body = await readJsonBody(request);
        const state = s003Runtime.state();
        const scenarioContext = body.scenarioContext || { ...DEFAULT_SCENARIO_CONTEXT, ...Object.fromEntries(["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"].map((field) => [field, body[field] || DEFAULT_SCENARIO_CONTEXT[field]])) };
        const requestedKind = body.resultKind === "SIMULATION" || body.useKind === "STRESS" ? "SIMULATION" : body.usageIntent === "SHADOW" || body.useKind === "SHADOW" ? "SHADOW" : "PREDICTION";
        const resultEnvelope = legacyResultEnvelope(state, { resultKind: requestedKind, useKind: requestedKind === "SHADOW" ? "SHADOW" : "WHAT_IF", scenarioContext });
        json(response, 200, {
          workspace: legacyWorkspace(state),
          resultEnvelope,
          status: resultEnvelope ? "AVAILABLE" : "NOT_READY",
          missingReason: resultEnvelope ? null : "当前周期尚未形成所请求的模型结果。"
        });
        return;
      }
      if (request.method === "POST" && url.pathname === "/v1/s003/m04/guard") {
        const body = await readJsonBody(request);
        json(response, 200, s003Runtime.guard(body.resultEnvelope?.resultKind || body.resultKind));
        return;
      }
      if (request.method === "GET" && url.pathname === "/v1/continuous/health") {
        json(response, 200, {
          namespace: "ofw.modeling.continuous-optimization.v1",
          prototypeVersion: S003_REGISTRATION.prototypeVersion,
          scenarioId: S003_REGISTRATION.scenario.scenarioId,
          status: "ok",
          parentVersion: S003_REGISTRATION.parentReference.parentVersion,
          parentCommit: S003_REGISTRATION.parentReference.parentCommit,
          formalModelMutable: false,
          formalResultsMutable: false,
          automaticChampionSelectionAllowed: false,
          automaticReleaseAllowed: false,
          acceptanceReady: false
        });
        return;
      }
      if (request.method === "GET" && url.pathname === "/v1/continuous/state") {
        json(response, 200, s003Runtime.state());
        return;
      }
      if (request.method === "GET" && url.pathname === "/v1/continuous/formal-baseline") {
        json(response, 200, s003Runtime.formalBaseline());
        return;
      }
      const actionMatch = url.pathname.match(/^\/v1\/continuous\/actions\/([a-z0-9-]+)$/);
      if (request.method === "POST" && actionMatch) {
        const body = await readJsonBody(request);
        json(response, 200, s003Runtime.action(actionMatch[1], body));
        return;
      }
      const projectionMatch = url.pathname.match(/^\/v1\/continuous\/projections\/([A-Za-z0-9_-]+)$/);
      if (request.method === "GET" && projectionMatch) {
        json(response, 200, s003Runtime.consumerProjection(projectionMatch[1]));
        return;
      }
      if (request.method === "POST" && url.pathname === "/v1/continuous/guard") {
        const body = await readJsonBody(request);
        json(response, 200, s003Runtime.guard(body.resultKind));
        return;
      }
      if (url.pathname.startsWith("/v1/continuous/")) {
        json(response, 404, { code: "NOT_FOUND", message: "Continuous optimization route not found." });
        return;
      }
      parentServer.emit("request", request, response);
    } catch (error) {
      json(response, 422, {
        code: error.code || "CONTINUOUS_OPTIMIZATION_ERROR",
        message: error.message,
        acceptanceReady: false
      });
    }
  });
}

export async function listen({ port = 4359, host = "127.0.0.1" } = {}) {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  return server;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const server = await listen({ port: Number(process.env.M08_PORT || 4359) });
  process.stdout.write(`M08 continuous optimization service listening on http://127.0.0.1:${server.address().port}\n`);
}
