#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const queryServiceApi = require("../domain/query-service.js");

const root = path.resolve(__dirname, "..");
const OLD_RUN = "S003-RUN-20260815133000000-c03503000001";
const NEW_RUN = "S003-RUN-20260817163000000-c02200000001";
const FORMED_AT = "2026-08-17T16:30:00.000Z";
const DISPLAY_TIME = "2026-08-17 16:30:00";
const LEGACY_FACTOR_ACTION = "S003_FACTOR_EMERGENCY";
const CONTRACTS_ONLY = process.argv.includes("--contracts-only");

function readJson(ref) {
  return JSON.parse(fs.readFileSync(path.join(root, ref), "utf8"));
}

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function writeJson(ref, value) {
  const target = path.join(root, ref);
  const content = serialize(value);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  fs.writeFileSync(`${target}.sha256`, `${sha256(content)}  ${path.basename(ref)}\n`);
  return sha256(content);
}

function replaceText(value) {
  return String(value)
    .replaceAll(OLD_RUN, NEW_RUN)
    .replaceAll("resources/m01/model-package.v1.json", "resources/m01/model-package.v2.json")
    .replaceAll("resources/m01/published-pointer.v1.json", "resources/m01/published-pointer.v2.json")
    .replaceAll("resources/m01/evaluation-run.v1.json", "resources/m01/evaluation-run.v2.json")
    .replaceAll("resources/m01/c035-risk-results.v1.json", "resources/m01/c035-risk-results.v2.json")
    .replaceAll("resources/m01/published-risk-facts.v1.json", "resources/m01/published-risk-facts.v2.json")
    .replaceAll("resources/m01/runtime-export.v1.json", "resources/m01/runtime-export.v2.json")
    .replaceAll("resources/m01/action-type-catalog.v1.json", "resources/m01/action-type-catalog.v2.json")
    .replaceAll("resources/m03/query-runtime.v1.json", "resources/m03/query-runtime.v2.json")
    .replaceAll("resources/m03/query-results.v1.json", "resources/m03/query-results.v2.json")
    .replaceAll("resources/m03/query-catalog.v2.json", "resources/m03/query-catalog.v3.json")
    .replaceAll("resources/m04/decision-binding.v1.json", "resources/m04/decision-binding.v2.json")
    .replaceAll("resources/m04/decision-runtime.v1.json", "resources/m04/decision-runtime.v2.json")
    .replaceAll("resources/m04/decision-inbox.v2.json", "resources/m04/decision-inbox.v3.json")
    .replaceAll("resources/m04/decision-results.v2.json", "resources/m04/decision-results.v3.json")
    .replaceAll("resources/m06/report-contents.v7.json", "resources/m06/report-contents.v8.json")
    .replaceAll("resources/m06/report-artifacts.v7.json", "resources/m06/report-artifacts.v8.json")
    .replaceAll("resources/m06/report-manifest.v7.json", "resources/m06/report-manifest.v8.json")
    .replaceAll("resources/m06/report-history-index.v2.json", "resources/m06/report-history-index.v3.json")
    .replaceAll("resources/m05/agent-position.v5.json", "resources/m05/agent-position.v6.json")
    .replaceAll("集团债务风险管理人员人工确认是否推动通用负责人待办", "对应成员单位接口人核实确认后再分办负责人待办")
    .replaceAll("由集团债务风险管理人员人工确认", "由对应成员单位接口人确认")
    .replaceAll("集团债务风险管理负责人", "成员单位待办负责人")
    .replaceAll("重大因子管理升级（评分分档不变）", "重大因子补充诊断（不单独形成预警）")
    .replaceAll("重大因子应急核查", "亮灯预警核实")
    .replaceAll("管理关注升级不改变评分或分档，需由风险管理人员人工判断是否提交标准行动申请。", "重大因子用于补充风险诊断，不单独形成行动；黄灯、红灯、黑灯按当前亮灯直接形成一条预警入口。")
    .replaceAll("该信号不修改已形成的评分结果；请由风险管理人员核实事实后，决定是否提交标准行动申请。", "该信号不修改评分或分档，也不单独形成行动；成员单位接口人应在亮灯预警中一并核实。")
    .replaceAll("风险行动候选", "亮灯预警行动")
    .replaceAll("处置候选", "亮灯预警")
    .replaceAll("候选", "预警");
}

function transform(value) {
  if (typeof value === "string") return replaceText(value);
  if (Array.isArray(value)) {
    return value
      .filter((item) => !(item && typeof item === "object" && item.actionTypeId === LEGACY_FACTOR_ACTION))
      .map(transform);
  }
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) result[key] = transform(item);
  return result;
}

function scenarioContext() {
  return {
    scenarioId: "S003",
    scenarioVersion: "S003-v1",
    scenarioRunId: NEW_RUN,
    formedAt: FORMED_AT,
    status: "active"
  };
}

function enterpriseRoutes() {
  const source = readJson("resources/m01/c035-risk-results.v1.json");
  return {
    schemaVersion: "ofw.s003.m04.enterprise-contact-routing.v1",
    moduleId: "M04",
    moduleOwner: "决策中心",
    businessOwner: "财务公司",
    routingId: "S003-M04-ENTERPRISE-CONTACT-ROUTING",
    routingVersion: "1.0.0",
    status: "active",
    immutable: true,
    formedAt: FORMED_AT,
    scenarioIdentity: scenarioContext(),
    missingRoutePolicy: "FAIL_CLOSED",
    permissionBoundary: "routing-metadata-only-no-multi-user-permission-system",
    routes: source.results.map((item, index) => {
      const sequence = String(index + 1).padStart(3, "0");
      return {
        enterpriseId: item.enterprise.enterpriseId,
        enterpriseName: item.enterprise.name,
        memberUnitId: `S003-UNIT-${sequence}`,
        memberUnitName: item.enterprise.name,
        decisionRecipient: {
          recipientId: `S003-CONTACT-${sequence}`,
          recipientName: `${item.enterprise.name}债务风险接口人`,
          role: "成员单位债务风险接口人"
        }
      };
    }),
    invariants: [
      "每个企业稳定 enterpriseId 只能映射一个当前成员单位接口人。",
      "缺少映射时行动申请必须拒绝提交，不得回退到集团债务风险管理员。",
      "decisionRecipient 只表示决策收件与确认人；owner 只在接口人确认分办后表示负责人待办承接人。",
      "一期仅提供确定性路由配置，不新增多用户权限、多级审批或专属处置页面。"
    ]
  };
}

function routeMap(routing) {
  return new Map(routing.routes.map((item) => [item.enterpriseId, item]));
}

function buildDecisionBinding() {
  return {
    schemaVersion: "ofw.s003.m04.decision-binding.v2",
    moduleId: "M04",
    moduleOwner: "决策中心",
    bindingId: "S003-M04-GENERIC-DECISION-BINDING",
    bindingVersion: "1.1.0",
    status: "active",
    supersedes: "resources/m04/decision-binding.v1.json",
    formedAt: FORMED_AT,
    scenarioIdentity: scenarioContext(),
    uiMode: "reuse-generic-decision-center-no-dedicated-page",
    entry: "Action Request",
    candidatePolicy: "YELLOW_RED_BLACK_ONE_ALERT_PER_ENTERPRISE",
    requiresHumanConfirmation: true,
    confirmationActor: "成员单位债务风险接口人",
    todoTarget: "负责人待办",
    todoCreatedOnlyAfterRecipientConfirmation: true,
    multiLevelApproval: false,
    multiUserPermissionModel: false,
    automaticCreation: false,
    candidateRules: [
      { when: "YELLOW", actionTypeId: "S003_RISK_FOLLOW_UP" },
      { when: "RED", actionTypeId: "S003_SPECIAL_DISPOSAL" },
      { when: "BLACK", actionTypeId: "S003_EMERGENCY_RESPONSE" }
    ],
    routing: {
      resourceRef: "resources/m04/enterprise-contact-routing.v1.json",
      required: true,
      missingRoutePolicy: "FAIL_CLOSED",
      target: "对应成员单位接口人的通用决策中心",
      fallbackToGroupAdministrator: false
    },
    idempotencyKey: ["scenarioRunId", "enterpriseId", "actionTypeId", "assessmentAt", "resultVersion"],
    historicalReplayAllowed: false,
    contracts: ["C011", "C017", "C019", "C033", "C035"]
  };
}

function riskTierCandidate(result) {
  const source = (result.dispositionCandidates || []).find((item) => item.trigger?.type === "RISK_TIER");
  if (!source) return null;
  const resultVersion = "1.1.0";
  const idempotencyKey = [NEW_RUN, result.enterprise.enterpriseId, source.actionTypeId, result.assessmentAt, resultVersion].join("|");
  return {
    ...transform(source),
    candidateId: `S003-CAND-${NEW_RUN}-${result.enterprise.enterpriseId}-${source.actionTypeId}-${result.assessmentAt}-${resultVersion}`,
    idempotencyKey,
    trigger: {
      type: "RISK_TIER",
      tierId: result.riskTier.tierId,
      tierName: result.riskTier.name
    },
    actionRequestId: null,
    todoId: null
  };
}

function buildModelPackage() {
  const model = transform(readJson("resources/m01/model-package.v1.json"));
  model.schemaVersion = "ofw.s003.m01.atomic-model-package.v2";
  model.packageVersion = "1.0.2";
  model.actionTypes = model.actionTypes.filter((item) => item.actionTypeId !== LEGACY_FACTOR_ACTION);
  model.provenance = {
    ...model.provenance,
    userClarification: "2026-08-17：黄灯、红灯、黑灯均按亮灯一企一预警；重大因子只作诊断证据，不单独形成行动。"
  };
  return model;
}

function buildPublishedPointer(model) {
  const previous = readJson("resources/m01/published-pointer.v1.json");
  const pointer = transform(previous);
  pointer.pointerVersion = "1.1.0";
  pointer.switchedAt = FORMED_AT;
  pointer.scenarioIdentity = scenarioContext();
  pointer.previousTarget = {
    packageId: previous.activeTarget.packageId,
    packageVersion: previous.activeTarget.packageVersion,
    lifecycleStatus: previous.activeTarget.lifecycleStatus,
    resourceRef: "resources/m01/published-pointer.v1.json#/activeTarget",
    sha256: sha256(serialize(previous.activeTarget.publishedSnapshot))
  };
  pointer.activeTarget = {
    ...transform(previous.activeTarget),
    packageVersion: model.packageVersion,
    lifecycleStatus: "published",
    snapshotSha256: sha256(serialize(model)),
    publishedSnapshot: model
  };
  pointer.switchMode = "validated-action-routing-clarification";
  pointer.sourceDraft = {
    draftId: "S003-MODEL-DRAFT-CP22-001",
    basedOnVersion: previous.activeTarget.packageVersion,
    proposedVersion: model.packageVersion,
    validationStatus: "passed",
    validatedAt: "2026-08-17T16:28:00.000Z",
    publishedAt: "2026-08-17T16:29:00.000Z"
  };
  return pointer;
}

function buildC017Projection(pointer) {
  const projection = transform(readJson("resources/m02/c017-decision-projection.v1.json"));
  projection.projectionId = "S003-M02-C017-DECISION-PROJECTION-20260817-002";
  projection.projectionVersion = "1.1.0";
  projection.formedAt = "2026-08-17T16:32:00.000Z";
  projection.supersedes = "resources/m02/c017-decision-projection.v1.json";
  projection.scenarioContext = scenarioContext();
  projection.sourceRefs = {
    ...projection.sourceRefs,
    dataAsset: "resources/m02/formal-candidate-data-asset.v1.json",
    qualityResult: "resources/m02/quality-result.v1.json",
    humanInputSnapshot: "resources/m02/human-input-snapshot.v1.json",
    publishedPointer: "resources/m01/published-pointer.v2.json"
  };
  projection.projections = projection.projections.map((item) => {
    const summary = {
      ...item.currentStateSummary,
      id: "C017-S003-T007-FORMAL-CANDIDATE-20251231-v1-CURRENT-2",
      version: "current-2",
      formedAt: projection.formedAt,
      qualityStatus: "允许推进",
      hardQualityFailure: false,
      detectedAt: "不适用",
      impactScope: "无硬质量失败影响",
      businessFieldCategories: "财务来源、企业当期因子输入版本",
      reason: `正式 T007 质量检查通过，T053 输入版本完整，且已由 Published ${pointer.activeTarget.packageVersion} 指针正式采用。`,
      recovery: "无需恢复",
      evidenceLocator: "resources/m02/c017-decision-projection.v2.json#/projections/0/currentStateSummary"
    };
    const gates = Object.fromEntries(Object.entries(item.gates || {}).map(([gate, value]) => [gate, {
      ...value,
      currentStateSummary: { id: summary.id, version: summary.version, formedAt: summary.formedAt },
      qualityStatus: summary.qualityStatus,
      hardQualityFailure: summary.hardQualityFailure,
      detectedAt: summary.detectedAt,
      impactScope: summary.impactScope,
      businessFieldCategories: summary.businessFieldCategories,
      reason: "当前摘要未标记该精确数据资产版本存在版本级或范围级硬质量失败。",
      recovery: summary.recovery,
      evidenceLocator: `resources/m02/c017-decision-projection.v2.json#/projections/0/gates/${gate}`
    }]));
    return {
      ...item,
      scenarioContext: scenarioContext(),
      currentStateSummary: summary,
      qualityStatus: summary.qualityStatus,
      hardQualityFailure: summary.hardQualityFailure,
      detectedAt: summary.detectedAt,
      impactScope: summary.impactScope,
      businessFieldCategories: summary.businessFieldCategories,
      reason: summary.reason,
      recovery: summary.recovery,
      evidenceLocator: "resources/m02/c017-decision-projection.v2.json#/projections/0",
      gates
    };
  });
  return projection;
}

const C017_GATE_LABELS = Object.freeze({
  request_receipt: "行动申请接收前",
  confirmation_submit: "人工确认提交前",
  task_formation: "负责人待办形成前"
});

function c017SafetyRead(c017, gate, readAt) {
  const projection = c017.projections[0];
  const gateProjection = projection.gates[gate];
  const summary = gateProjection.currentStateSummary;
  return {
    gate,
    gateLabel: C017_GATE_LABELS[gate],
    t007: projection.dataVersion,
    summaryId: summary.id,
    summaryVersion: summary.version,
    summaryFormedAt: summary.formedAt,
    readAt,
    qualityStatus: gateProjection.qualityStatus,
    hardFailure: gateProjection.hardQualityFailure ? "是" : "否",
    detectedAt: gateProjection.detectedAt,
    impactScope: gateProjection.impactScope,
    businessFieldCategories: gateProjection.businessFieldCategories,
    reason: gateProjection.reason,
    recovery: gateProjection.recovery,
    evidenceLocator: gateProjection.evidenceLocator,
    outcome: gateProjection.hardQualityFailure === false ? "allowed" : "rejected"
  };
}

function buildCatalog(model) {
  const catalog = transform(readJson("resources/m01/action-type-catalog.v1.json"));
  catalog.schemaVersion = "ofw.s003.m01.action-type-catalog.v2";
  catalog.catalogVersion = "1.1.0";
  catalog.scenarioIdentity = scenarioContext();
  catalog.publishedModelBinding.packageVersion = model.packageVersion;
  catalog.publishedModelBinding.semanticVersionId = `${model.packageId}@${model.packageVersion}`;
  catalog.publishedModelBinding.pointerVersion = "1.1.0";
  catalog.actionTypes = catalog.actionTypes.filter((item) => item.actionTypeId !== LEGACY_FACTOR_ACTION).map((item) => ({
    ...item,
    description: item.actionTypeId === "S003_RISK_FOLLOW_UP"
      ? "黄灯企业按亮灯直接形成预警入口，由集团债务风险管理人员显式提交后送达对应成员单位接口人。"
      : item.actionTypeId === "S003_SPECIAL_DISPOSAL"
        ? "红灯企业按亮灯直接形成专项预警入口，由对应成员单位接口人核实后分办。"
        : "黑灯企业按亮灯直接形成应急预警入口，由对应成员单位接口人优先核实后分办。",
    triggerSummary: `${item.triggerSummary?.replace("时形成候选", "即形成一企一预警") || "按当前亮灯形成一企一预警"}`
  }));
  return catalog;
}

function buildRiskResults(model, pointer) {
  const resultSet = transform(readJson("resources/m01/c035-risk-results.v1.json"));
  resultSet.schemaVersion = "ofw.s003.c035.risk-result-set.v2";
  resultSet.resultSetId = "S003-C035-RISK-RESULTS-20251231-v2";
  resultSet.resultSetVersion = "1.1.0";
  resultSet.formedAt = FORMED_AT;
  resultSet.scenarioIdentity = scenarioContext();
  resultSet.modelPointer = {
    pointerId: pointer.pointerId,
    pointerVersion: pointer.pointerVersion,
    pointerRef: "resources/m01/published-pointer.v2.json",
    pointerSha256: sha256(serialize(pointer))
  };
  resultSet.results = resultSet.results.map((result) => {
    const next = transform(result);
    next.resultId = `S003-C035-${NEW_RUN}-${next.enterprise.enterpriseId}`;
    next.resultVersion = "1.1.0";
    next.scenarioIdentity = scenarioContext();
    next.modelIdentity = {
      ...next.modelIdentity,
      packageVersion: model.packageVersion,
      publishedVersion: model.packageVersion,
      lifecycleStatus: "published"
    };
    next.dispositionCandidates = ["YELLOW", "RED", "BLACK"].includes(next.riskTier.tierId)
      ? [riskTierCandidate(next)].filter(Boolean)
      : [];
    if (next.reportData) {
      next.reportData.scenarioIdentity = scenarioContext();
      next.reportData.modelVersion = model.packageVersion;
      next.reportData.publishedVersion = model.packageVersion;
    }
    return next;
  });
  const counts = resultSet.results.reduce((acc, item) => {
    acc[item.riskTier.tierId] = (acc[item.riskTier.tierId] || 0) + 1;
    return acc;
  }, { GREEN: 0, YELLOW: 0, RED: 0, BLACK: 0 });
  resultSet.summary = {
    ...resultSet.summary,
    riskTierCounts: counts,
    dispositionCandidateCount: resultSet.results.reduce((sum, item) => sum + item.dispositionCandidates.length, 0),
    alertEnterpriseCount: resultSet.results.filter((item) => ["YELLOW", "RED", "BLACK"].includes(item.riskTier.tierId)).length,
    alertPolicy: "YELLOW_RED_BLACK_ONE_ALERT_PER_ENTERPRISE"
  };
  return resultSet;
}

function buildEvaluationRun(riskResults, model) {
  const run = transform(readJson("resources/m01/evaluation-run.v1.json"));
  run.evaluationRunId = "S003-M01-EVALUATION-RUN-20260817-002";
  run.evaluationRunVersion = "1.1.0";
  run.startedAt = "2026-08-17T16:29:30.000Z";
  run.completedAt = FORMED_AT;
  run.scenarioIdentity = scenarioContext();
  run.sourceScenarioRunId = OLD_RUN;
  run.newScenarioRunCreated = true;
  run.idempotencyKey = `${NEW_RUN}|${model.packageVersion}|${run.assessmentAt}|S003-T053-INPUT-20251231-v1`;
  if (run.inputs?.model) run.inputs.model.packageVersion = model.packageVersion;
  if (run.outputs) {
    run.outputs.resultSetId = riskResults.resultSetId;
    run.outputs.resultSetVersion = riskResults.resultSetVersion;
    run.outputs.resultSetRef = "resources/m01/c035-risk-results.v2.json";
  }
  run.counts = {
    enterprisesEvaluated: riskResults.results.length,
    c035Results: riskResults.results.length,
    publishedFacts: riskResults.results.length,
    dispositionCandidates: riskResults.summary.dispositionCandidateCount,
    actionRequestsCreated: 0,
    todosCreated: 0,
    notificationsDispatched: 0,
    reportsGenerated: 0
  };
  return run;
}

function buildFacts(riskResults, model) {
  const facts = transform(readJson("resources/m01/published-risk-facts.v1.json"));
  facts.schemaVersion = "ofw.s003.published-risk-fact-set.v2";
  facts.factSetId = "S003-PUBLISHED-RISK-FACTS-20251231-v2";
  facts.factSetVersion = "1.1.0";
  facts.formedAt = FORMED_AT;
  facts.scenarioIdentity = scenarioContext();
  facts.sourceResultSet = {
    ...(facts.sourceResultSet || {}),
    resultSetId: riskResults.resultSetId,
    resultSetVersion: riskResults.resultSetVersion,
    ref: "resources/m01/c035-risk-results.v2.json"
  };
  const byEnterprise = new Map(riskResults.results.map((item) => [item.enterprise.enterpriseId, item]));
  facts.facts = facts.facts.map((fact) => {
    const enterpriseId = fact.subjectId || fact.enterprise?.enterpriseId;
    const result = byEnterprise.get(enterpriseId);
    if (!result) throw new Error(`Published 风险事实无法定位企业结果：${enterpriseId || "UNKNOWN"}`);
    const next = transform(fact);
    next.factId = `S003-FACT-${NEW_RUN}-${enterpriseId}`;
    next.factVersion = "1.1.0";
    next.scenarioIdentity = scenarioContext();
    next.sourceResultId = result.resultId;
    next.sourceResultVersion = result.resultVersion;
    next.object = {
      ...next.object,
      rawScore: result.rawScore,
      factorSum: result.factorSum,
      finalScore: result.finalScore,
      riskTierId: result.riskTier.tierId,
      riskTierName: result.riskTier.name,
      alertActionTypeId: result.dispositionCandidates[0]?.actionTypeId || null,
      alertCandidateId: result.dispositionCandidates[0]?.candidateId || null
    };
    return next;
  });
  return facts;
}

function buildRuntimeExport(riskResults, model, pointer, evaluationRun, facts) {
  const runtime = transform(readJson("resources/m01/runtime-export.v1.json"));
  runtime.schemaVersion = "ofw.s003.m01.runtime-export.v2";
  runtime.runtimeExportId = "S003-M01-RUNTIME-EXPORT-20260817-002";
  runtime.runtimeExportVersion = "1.1.0";
  runtime.formedAt = FORMED_AT;
  runtime.scenarioIdentity = scenarioContext();
  runtime.authority = {
    ...(runtime.authority || {}),
    publishedPointer: {
      ref: "resources/m01/published-pointer.v2.json",
      sha256: sha256(serialize(pointer))
    },
    evaluationRun: {
      ref: "resources/m01/evaluation-run.v2.json",
      sha256: sha256(serialize(evaluationRun))
    },
    c035Results: {
      ref: "resources/m01/c035-risk-results.v2.json",
      sha256: sha256(serialize(riskResults))
    },
    publishedFacts: {
      ref: "resources/m01/published-risk-facts.v2.json",
      sha256: sha256(serialize(facts))
    },
    publishedModelVersion: model.packageVersion,
    publishedPointerRef: "resources/m01/published-pointer.v2.json",
    resultSetId: riskResults.resultSetId,
    resultSetVersion: riskResults.resultSetVersion
  };
  if (runtime.workbenchProjection) {
    const byEnterprise = new Map(riskResults.results.map((item) => [item.enterprise.enterpriseId, item]));
    const sourceRows = Array.isArray(runtime.workbenchProjection.enterpriseRows)
      ? runtime.workbenchProjection.enterpriseRows
      : Array.isArray(runtime.workbenchProjection.enterpriseResults)
        ? runtime.workbenchProjection.enterpriseResults
        : [];
    runtime.workbenchProjection.enterpriseRows = sourceRows.map((item) => {
      const source = byEnterprise.get(item.enterpriseId);
      const candidateActions = source?.dispositionCandidates || [];
      return {
        ...transform(item),
        dispositionCandidateIds: candidateActions.map((candidate) => candidate.candidateId),
        c035ResultId: source?.resultId || item.c035ResultId
      };
    });
    delete runtime.workbenchProjection.enterpriseResults;
    runtime.workbenchProjection.dispositionCandidates = riskResults.results.flatMap((item) => item.dispositionCandidates || []);
    runtime.workbenchProjection.summary = {
      ...(runtime.workbenchProjection.summary || {}),
      riskTierCounts: { ...(riskResults.summary?.riskTierCounts || {}) },
      averageFinalScore: riskResults.summary?.averageFinalScore
    };
  }
  return runtime;
}

function buildQueryCatalog() {
  const catalog = transform(readJson("resources/m03/query-catalog.v2.json"));
  catalog.schemaVersion = "ofw.s003.m03.query-catalog.v3";
  catalog.catalogId = "S003-M03-QUERY-CATALOG-V3";
  catalog.catalogVersion = "1.2.0";
  catalog.supersedes = "resources/m03/query-catalog.v2.json";
  catalog.formedAt = "2026-08-17T16:33:00.000Z";
  catalog.queries = queryServiceApi.QUERY_DEFINITIONS.map((item) => ({ ...item }));
  return catalog;
}

function buildQueryAssets(riskResults, facts, catalog) {
  const runtime = transform(readJson("resources/m03/query-runtime.v1.json"));
  runtime.schemaVersion = "ofw.s003.m03.query-runtime.v2";
  runtime.runtimeVersion = "1.1.0";
  runtime.status = "implemented-readonly-current-published-run";
  runtime.queryCatalogRef = "resources/m03/query-catalog.v3.json";
  runtime.queryCatalogId = catalog.catalogId;
  runtime.queryCatalogVersion = catalog.catalogVersion;
  runtime.queries = queryServiceApi.QUERY_DEFINITIONS.map((item) => ({ ...item }));
  const results = transform(readJson("resources/m03/query-results.v1.json"));
  results.schemaVersion = "ofw.s003.m03.query-results.v2";
  results.resultSetId = "S003-M03-QUERY-RESULTS-20260817-002";
  results.resultSetVersion = "1.1.0";
  results.runtimeVersion = runtime.runtimeVersion;
  results.formedAt = "2026-08-17T16:34:00.000Z";
  results.scenarioIdentity = scenarioContext();
  results.source = {
    ...(results.source || {}),
    resultSetId: riskResults.resultSetId,
    resultSetVersion: riskResults.resultSetVersion,
    resultSetRef: "resources/m01/c035-risk-results.v2.json"
  };
  results.queryCatalog = {
    catalogId: catalog.catalogId,
    catalogVersion: catalog.catalogVersion,
    catalogRef: "resources/m03/query-catalog.v3.json"
  };
  const service = queryServiceApi.createQueryService({
    scenarioContext: scenarioContext(),
    c035Results: riskResults,
    publishedFacts: facts
  });
  const parametersByQueryId = {
    "S003-QRY-003": { enterpriseId: "S003-ENT-001" },
    "S003-QRY-004": { enterpriseId: "S003-ENT-001" }
  };
  results.executions = queryServiceApi.QUERY_DEFINITIONS.map((definition) => {
    const parameters = parametersByQueryId[definition.queryId] || {};
    return { parameters, output: service.execute(definition.queryId, parameters) };
  });
  results.summary = {
    queryCount: results.executions.length,
    readOnlyCount: results.executions.filter((item) => item.output.readOnly === true).length,
    actionRequestsCreated: 0,
    todosCreated: 0,
    notificationsDispatched: 0,
    publishedFactsMutated: 0
  };
  return { runtime, results };
}

function actionMeta(catalog, actionTypeId) {
  return catalog.actionTypes.find((item) => item.actionTypeId === actionTypeId);
}

function decisionRecipient(route) {
  return {
    enterpriseId: route.enterpriseId,
    memberUnitId: route.memberUnitId,
    memberUnitName: route.memberUnitName,
    recipientId: route.decisionRecipient.recipientId,
    recipientName: route.decisionRecipient.recipientName,
    role: route.decisionRecipient.role
  };
}

function buildPendingRequest(candidate, result, route, catalog, c017, riskResults, template) {
  const meta = actionMeta(catalog, candidate.actionTypeId);
  const requestId = `AR-${candidate.candidateId}`;
  const payload = transform(template || {});
  // 模板只提供通用展示结构；幂等身份必须始终由当前企业候选重新生成。
  // 显式移除模板企业的键，避免复制 ENT-007 模板时污染其他成员单位请求。
  delete payload.idempotencyKey;
  const receiptRead = c017SafetyRead(c017, "request_receipt", "2026-08-17T16:36:00.000Z");
  return {
    ...payload,
    id: requestId,
    requestId,
    reminderId: requestId.replace(/^AR-/, "DR-"),
    subjectId: result.enterprise.enterpriseId,
    subjectName: result.enterprise.name,
    scenario: "债务风险监测",
    scenarioContext: scenarioContext(),
    sourceType: "report",
    sourceRef: `债务风险驾驶舱 · ${result.resultId}`,
    requester: "集团债务风险管理人员",
    submittedBy: "集团债务风险管理人员",
    decisionRecipient: decisionRecipient(route),
    routingTarget: {
      type: "member-unit-decision-center",
      organizationId: route.memberUnitId,
      organizationName: route.memberUnitName
    },
    recipientRole: route.decisionRecipient.role,
    recommendedTaskOwner: `${route.memberUnitName}债务风险责任人`,
    recommendedTaskOwnerId: `${result.enterprise.enterpriseId}-DEBT-RISK-OWNER`,
    owner: null,
    ownerId: null,
    actionType: {
      id: candidate.actionTypeId,
      name: meta.displayName,
      description: meta.description,
      version: catalog.publishedModelBinding.packageVersion,
      status: "已发布"
    },
    rule: null,
    ruleApplicability: "不适用；本次按黄灯、红灯或黑灯当前亮灯形成一企一预警",
    metric: {
      id: "MET-S003-FINAL-RISK-SCORE",
      name: "企业最终风险评分",
      value: `${result.finalScore.toFixed(2)} 分`,
      explanation: `本次评估为${result.riskTier.name}，已按当前亮灯形成预警并送达${route.memberUnitName}接口人。`,
      evaluatedAt: result.assessmentAt,
      scope: `${result.enterprise.name} · ${result.enterprise.category}`
    },
    evidence: {
      ...(payload.evidence || {}),
      semanticVersion: `${catalog.publishedModelBinding.packageId} ${catalog.publishedModelBinding.packageVersion}`,
      dataVersion: riskResults.inputIdentity.dataAssetVersion,
      dataAssetId: riskResults.inputIdentity.dataAssetId,
      resultVersion: result.resultVersion,
      cutoff: result.assessmentAt,
      quality: receiptRead.qualityStatus,
      qualitySource: {
        contractCode: "C017",
        consumer: "决策中心",
        gate: receiptRead.gate,
        summaryId: receiptRead.summaryId,
        summaryVersion: receiptRead.summaryVersion,
        summaryFormedAt: receiptRead.summaryFormedAt,
        evidenceLocator: receiptRead.evidenceLocator
      },
      availability: "完整可用",
      ready: "C017 接收安全门通过",
      snapshotId: result.resultId,
      freshness: "固定运行证据"
    },
    recommendation: `${meta.description} ${result.majorFactorHits?.length ? `补充关注：${result.majorFactorHits.join("、")}。` : ""}`,
    sourceCandidateId: candidate.candidateId,
    candidateId: candidate.candidateId,
    idempotencyKey: candidate.idempotencyKey,
    sourceResultId: result.resultId,
    sourceResultVersion: result.resultVersion,
    requestTime: DISPLAY_TIME,
    generatedTime: DISPLAY_TIME,
    status: "awaiting",
    automatic: false,
    actionRequestImmutable: false,
    confirmationEligibility: {
      allowed: true,
      requiresAcknowledgement: false,
      reason: `已送达${route.decisionRecipient.recipientName}，待成员单位接口人核实确认后分办`
    },
    requestGate: {
      status: "accepted",
      checkedAt: "2026-08-17 16:36:00",
      reason: "C011 标准行动申请已接收，当前 C017 安全门允许推进",
      reminderCreated: true
    },
    formation: {
      requestGateStatus: "accepted",
      requestGateCheckedAt: "2026-08-17 16:36:00",
      requestGateReason: "C011 标准行动申请已接收",
      reminderCreated: true,
      confirmationGateStatus: "not_reached",
      confirmationGateReason: `等待${route.decisionRecipient.recipientName}核实确认并选择实际负责人`
    },
    c017ReceiptRead: receiptRead,
    c017SafetyReads: [receiptRead],
    c017ReadAttempts: { request_receipt: 1, confirmation_submit: 0, task_formation: 0 },
    sourceEvents: [{
      type: "驾驶舱人工提交",
      time: "2026-08-17 16:36:00",
      reason: `集团债务风险管理人员从仪表盘提交标准 Action Request，并送达${route.decisionRecipient.recipientName}`
    }],
    decision: null,
    taskId: null,
    taskCreating: false
  };
}

function buildDecisionAssets(riskResults, catalog, routing, c017, decisionBinding) {
  const routes = routeMap(routing);
  const candidates = riskResults.results.flatMap((item) => item.dispositionCandidates.map((candidate) => ({
    ...candidate,
    enterpriseId: item.enterprise.enterpriseId,
    enterpriseName: item.enterprise.name,
    category: item.enterprise.category,
    riskTier: item.riskTier.tierId,
    riskTierName: item.riskTier.name,
    finalScore: item.finalScore,
    assessmentAt: item.assessmentAt,
    sourceResultId: item.resultId,
    sourceResultVersion: item.resultVersion,
    scenarioIdentity: scenarioContext()
  })));
  const candidateByEnterprise = new Map(candidates.map((item) => [item.enterpriseId, item]));
  const oldInbox = readJson("resources/m04/decision-inbox.v2.json");
  const inbox = transform(oldInbox);
  inbox.schemaVersion = "ofw.s003.m04.manual-action-inbox.v2";
  inbox.inboxId = "S003-M04-MANUAL-ACTION-INBOX-20260817-003";
  inbox.inboxVersion = "1.2.0";
  inbox.formedAt = "2026-08-17T16:36:00.000Z";
  inbox.scenarioIdentity = scenarioContext();
  inbox.supersedes = "resources/m04/decision-inbox.v2.json";
  inbox.submissionPolicy = {
    ...inbox.submissionPolicy,
    manualOnly: true,
    automaticCreation: false,
    requiresHumanConfirmation: true,
    recipientRoutingRequired: true,
    recipientRole: "成员单位债务风险接口人",
    todoCreatedOnlyAfterRecipientConfirmation: true,
    multiLevelApproval: false,
    externalDispatch: false
  };
  const template = oldInbox.requests[0];
  inbox.requests = ["S003-ENT-007", "S003-ENT-017", "S003-ENT-018"].map((enterpriseId) => {
    const result = riskResults.results.find((item) => item.enterprise.enterpriseId === enterpriseId);
    const candidate = candidateByEnterprise.get(enterpriseId);
    const route = routes.get(enterpriseId);
    return buildPendingRequest(candidate, result, route, catalog, c017, riskResults, template);
  });

  const oldResults = readJson("resources/m04/decision-results.v2.json");
  const results = transform(oldResults);
  results.schemaVersion = "ofw.s003.m04.decision-results.v3";
  results.resultSetId = "S003-M04-DECISION-RESULTS-20260817-003";
  results.resultSetVersion = "1.2.0";
  results.formedAt = "2026-08-17T16:38:00.000Z";
  results.scenarioIdentity = scenarioContext();
  results.supersedes = "resources/m04/decision-results.v2.json";
  results.candidatesBeforeConfirmation = candidates;
  const confirmedCandidate = candidateByEnterprise.get("S003-ENT-020");
  const confirmedResult = riskResults.results.find((item) => item.enterprise.enterpriseId === "S003-ENT-020");
  const confirmedRoute = routes.get("S003-ENT-020");
  const confirmed = transform(oldResults.confirmedDecision);
  const receiptRead = c017SafetyRead(c017, "request_receipt", "2026-08-17T16:36:00.000Z");
  const confirmationRead = c017SafetyRead(c017, "confirmation_submit", "2026-08-17T16:37:00.000Z");
  const taskRead = c017SafetyRead(c017, "task_formation", "2026-08-17T16:37:30.000Z");
  const actionRequestId = `AR-${confirmedCandidate.candidateId}`;
  const todoId = `TODO-${confirmedCandidate.candidateId}`;
  const owner = `${confirmedResult.enterprise.name}债务风险处置负责人`;
  confirmed.scenarioIdentity = scenarioContext();
  confirmed.candidateId = confirmedCandidate.candidateId;
  confirmed.idempotencyKey = confirmedCandidate.idempotencyKey;
  confirmed.sideEffects = { actionRequestCreated: false, todoCreated: true, notificationSent: false, externalDispatch: false };
  confirmed.actionRequest = {
    ...confirmed.actionRequest,
    actionRequestId,
    status: "confirmed-to-owner-todo",
    scenarioIdentity: scenarioContext(),
    enterpriseId: confirmedResult.enterprise.enterpriseId,
    enterpriseName: confirmedResult.enterprise.name,
    category: confirmedResult.enterprise.category,
    riskTier: confirmedResult.riskTier.tierId,
    riskTierName: confirmedResult.riskTier.name,
    finalScore: confirmedResult.finalScore,
    actionTypeId: confirmedCandidate.actionTypeId,
    candidateId: confirmedCandidate.candidateId,
    sourceCandidateId: confirmedCandidate.candidateId,
    sourceResultId: confirmedResult.resultId,
    resultVersion: confirmedResult.resultVersion,
    idempotencyKey: confirmedCandidate.idempotencyKey,
    requester: "集团债务风险管理人员",
    submittedBy: "集团债务风险管理人员",
    routingTarget: {
      type: "member-unit-decision-center",
      organizationId: confirmedRoute.memberUnitId,
      organizationName: confirmedRoute.memberUnitName
    },
    decisionRecipient: decisionRecipient(confirmedRoute),
    recipientRole: confirmedRoute.decisionRecipient.role,
    recommendedTaskOwner: `${confirmedRoute.memberUnitName}债务风险责任人`,
    recommendedTaskOwnerId: `${confirmedResult.enterprise.enterpriseId}-DEBT-RISK-OWNER`,
    owner,
    note: "成员单位接口人已核实红灯预警，按通用决策中心框架分办专项处置任务。",
    confirmed: true,
    confirmedAt: "2026-08-17T16:37:00.000Z",
    confirmedBy: confirmedRoute.decisionRecipient.recipientName,
    todoId,
    requiresHumanConfirmation: false
  };
  confirmed.actionRequest.c017ReceiptRead = receiptRead;
  confirmed.actionRequest.c017ConfirmationRead = confirmationRead;
  confirmed.actionRequest.c017SafetyReads = [receiptRead, confirmationRead];
  confirmed.actionRequest.c017ReadAttempts = { request_receipt: 1, confirmation_submit: 1, task_formation: 0 };
  confirmed.todo = {
    ...confirmed.todo,
    todoId,
    actionRequestId,
    scenarioIdentity: scenarioContext(),
    enterpriseId: confirmedResult.enterprise.enterpriseId,
    enterpriseName: confirmedResult.enterprise.name,
    actionTypeId: confirmedCandidate.actionTypeId,
    candidateId: confirmedCandidate.candidateId,
    sourceResultId: confirmedResult.resultId,
    resultVersion: confirmedResult.resultVersion,
    idempotencyKey: confirmedCandidate.idempotencyKey,
    owner,
    note: confirmed.actionRequest.note,
    createdAt: "2026-08-17T16:37:30.000Z"
  };
  confirmed.todo.c017SafetyRead = taskRead;
  confirmed.c017SafetyReads = [receiptRead, confirmationRead, taskRead];
  confirmed.c017ReadAttempts = { request_receipt: 1, confirmation_submit: 1, task_formation: 1 };
  confirmed.decisionRecipient = decisionRecipient(confirmedRoute);
  confirmed.decision = {
    type: "confirm",
    reason: confirmed.actionRequest.note,
    operator: confirmedRoute.decisionRecipient.recipientName,
    time: "2026-08-17 16:37:00",
    scenarioContext: scenarioContext(),
    owner,
    dueDate: "2026-09-17",
    instructions: "核实到期债务、资金缺口与应急资金安排，形成处置进展记录。",
    banks: []
  };
  results.confirmedDecision = confirmed;
  results.confirmations = [confirmed];
  results.candidateSummary = {
    total: candidates.length,
    awaitingHumanConfirmation: candidates.length - 1,
    confirmed: 1,
    actionRequestsCreated: inbox.requests.length + 1,
    todosCreated: 1,
    notificationsDispatched: 0,
    approvalsStarted: 0,
    alertEnterpriseCount: candidates.length,
    oneAlertPerEnterprise: true
  };
  results.policy = {
    ...results.policy,
    alertPolicy: "YELLOW_RED_BLACK_ONE_ALERT_PER_ENTERPRISE",
    decisionRecipient: "成员单位债务风险接口人",
    ownerAssignedAfterRecipientConfirmation: true
  };
  results.sideEffects = {
    automaticActionRequest: false,
    dashboardSubmissionCreatesActionRequest: true,
    automaticTodo: false,
    todoCreatedOnlyAfterRecipientConfirmation: true,
    notificationsDispatched: false,
    approvalsStarted: false,
    externalDispatch: false
  };
  results.source = {
    ...(results.source || {}),
    c017SafetyProjection: {
      contractCode: "C017",
      consumer: "决策中心",
      projectionId: c017.projectionId,
      projectionVersion: c017.projectionVersion,
      projectionRef: "resources/m02/c017-decision-projection.v2.json",
      summaryId: c017.projections[0].currentStateSummary.id,
      summaryVersion: c017.projections[0].currentStateSummary.version,
      dataAssetId: c017.projections[0].dataVersion,
      owner: "数据工程",
      readOnlyReceipt: true
    }
  };

  const runtime = transform(readJson("resources/m04/decision-runtime.v1.json"));
  runtime.schemaVersion = "ofw.s003.m04.decision-runtime.v2";
  runtime.runtimeVersion = "1.1.0";
  runtime.formedAt = "2026-08-17T16:35:00.000Z";
  runtime.scenarioIdentity = scenarioContext();
  runtime.source = {
    ...runtime.source,
    resultSetId: riskResults.resultSetId,
    resultSetVersion: riskResults.resultSetVersion,
    ref: "resources/m01/c035-risk-results.v2.json",
    sha256: sha256(serialize(riskResults)),
    schemaVersion: riskResults.schemaVersion,
    status: riskResults.status,
    c035ResultCount: riskResults.enterpriseCount,
    candidateCount: candidates.length
  };
  runtime.binding = {
    ref: "resources/m04/decision-binding.v2.json",
    sha256: sha256(serialize(decisionBinding)),
    bindingId: decisionBinding.bindingId,
    bindingVersion: decisionBinding.bindingVersion
  };
  runtime.candidateSummary = {
    total: candidates.length,
    byActionType: candidates.reduce((acc, item) => ({ ...acc, [item.actionTypeId]: (acc[item.actionTypeId] || 0) + 1 }), {}),
    alertPolicy: "YELLOW_RED_BLACK_ONE_ALERT_PER_ENTERPRISE"
  };
  runtime.confirmation = {
    ...runtime.confirmation,
    decisionRecipientRole: "成员单位债务风险接口人",
    actionRequestCreatedAtDashboardSubmission: true,
    todoCreatedOnlyAfterRecipientConfirmation: true
  };
  runtime.sideEffects = {
    automaticCandidateCreation: false,
    actionRequestRequiresHumanSubmission: true,
    actionRequestCreatedAtDashboardSubmission: true,
    actionRequestCreatedOnlyAfterConfirmation: false,
    todoCreatedOnlyAfterConfirmation: true,
    notificationsSent: false,
    externalDispatch: false,
    historicalReplayAllowed: false,
    regressionReplayAllowed: false
  };
  return { runtime, inbox, results };
}

function reportCandidateForEnterprise(decisionResults, enterpriseId) {
  return decisionResults.candidatesBeforeConfirmation.find((item) => item.enterpriseId === enterpriseId) || null;
}

function buildReportAssets(riskResults, decisionResults, model) {
  const contents = transform(readJson("resources/m06/report-contents.v7.json"));
  contents.schemaVersion = "ofw.s003.m06.report-content-set.v8";
  contents.contentSetId = "S003-M06-REPORT-CONTENTS-20260817-007";
  contents.contentSetVersion = "1.6.0";
  contents.formedAt = "2026-08-17T16:45:00.000Z";
  contents.scenarioIdentity = scenarioContext();
  contents.supersedes = "resources/m06/report-contents.v7.json";
  const resultByEnterprise = new Map(riskResults.results.map((item) => [item.enterprise.enterpriseId, item]));
  contents.reports = contents.reports.map((entry) => {
    const content = transform(entry.content);
    const enterpriseId = content.enterprise.enterpriseId;
    const result = resultByEnterprise.get(enterpriseId);
    const candidate = reportCandidateForEnterprise(decisionResults, enterpriseId);
    content.reportId = `S003-RPT-${NEW_RUN}-${enterpriseId}`;
    content.reportVersion = "1.6.0";
    content.contentVersion = "1.6.0";
    content.artifactVersion = "html-print-capability-v8";
    content.generatedAt = contents.formedAt;
    content.scenarioIdentity = scenarioContext();
    content.deepLink = `?scenarioId=S003&scenarioVersion=S003-v1&scenarioRunId=${NEW_RUN}#/reports/view?enterpriseId=${enterpriseId}&reportId=${content.reportId}`;
    content.assessment = { ...content.assessment, riskTier: result.riskTier, rawScore: result.rawScore, factorSum: result.factorSum, finalScore: result.finalScore };
    const dispositionCandidates = candidate ? [{
      candidateId: candidate.candidateId,
      actionTypeId: candidate.actionTypeId,
      trigger: candidate.trigger,
      requiresHumanConfirmation: true,
      status: enterpriseId === "S003-ENT-020" ? "CONFIRMED_TO_OWNER_TODO"
        : ["S003-ENT-007", "S003-ENT-017", "S003-ENT-018"].includes(enterpriseId) ? "ACTION_REQUEST_SUBMITTED"
          : "CANDIDATE_AWAITING_HUMAN_CONFIRMATION",
      actionRequestId: enterpriseId === "S003-ENT-020" ? decisionResults.confirmedDecision.actionRequest.actionRequestId
        : ["S003-ENT-007", "S003-ENT-017", "S003-ENT-018"].includes(enterpriseId) ? `AR-${candidate.candidateId}` : null,
      todoId: enterpriseId === "S003-ENT-020" ? decisionResults.confirmedDecision.todo.todoId : null,
      owner: enterpriseId === "S003-ENT-020" ? decisionResults.confirmedDecision.todo.owner : null,
      confirmedAt: enterpriseId === "S003-ENT-020" ? decisionResults.confirmedDecision.actionRequest.confirmedAt : null,
      approvalRequired: false,
      multiLevelApproval: false,
      notificationSent: false
    }] : [];
    content.disposition = { ...content.disposition, candidateCount: dispositionCandidates.length, candidates: dispositionCandidates };
    content.managementEscalation = {
      ...(content.managementEscalation || {}),
      actionCandidateCreated: false,
      candidateIds: [],
      guidance: content.managementEscalation?.triggered
        ? "重大因子仅补充风险诊断，不单独形成行动；当前亮灯预警已覆盖成员单位核实入口。"
        : "本轮未命中重大因子；如命中也仅补充诊断，不单独形成行动。"
    };
    content.evidenceReferences = (content.evidenceReferences || []).map((item) => ({
      ...item,
      evidenceVersion: item.evidenceType === "C035_RESULT" || item.evidenceType === "PUBLISHED_RISK_FACT" ? "1.1.0" : item.evidenceVersion,
      evidenceId: replaceText(item.evidenceId),
      ref: replaceText(item.ref)
    }));
    content.verificationResults = (content.verificationResults || []).map((item) => {
      if (item.checkId === "structured-trigger") return { ...item, evidence: `${dispositionCandidates.length} 条亮灯预警含预警标识、Action Type 与结构化亮灯依据` };
      if (item.checkId === "decision-status-alignment") return { ...item, evidence: `S003-M04-DECISION-RESULTS-20260817-003；${dispositionCandidates.length} 条亮灯预警与 C011/C019 状态一致` };
      return item;
    });
    const nextEntry = { ...entry, reportId: content.reportId, contentVersion: content.contentVersion, content };
    nextEntry.contentSha256 = sha256(serialize(content));
    return nextEntry;
  });

  const artifacts = transform(readJson("resources/m06/report-artifacts.v7.json"));
  artifacts.schemaVersion = "ofw.s003.m06.report-artifact-set.v8";
  artifacts.artifactSetId = "S003-M06-REPORT-ARTIFACTS-20260817-007";
  artifacts.artifactSetVersion = "1.6.0";
  artifacts.formedAt = contents.formedAt;
  artifacts.scenarioIdentity = scenarioContext();
  artifacts.supersedes = "resources/m06/report-artifacts.v7.json";
  const contentByEnterprise = new Map(contents.reports.map((item) => [item.content.enterprise.enterpriseId, item]));
  artifacts.artifacts = artifacts.artifacts.map((artifact) => {
    const enterpriseId = String(artifact.reportId).match(/S003-ENT-\d{3}$/)?.[0];
    const contentEntry = contentByEnterprise.get(enterpriseId);
    let html = replaceText(artifact.html)
      .replace(/<tr>[^<]*(?:<[^>]+>[^<]*)*重大因子应急核查(?:[^<]*(?:<[^>]+>[^<]*)*)*<\/tr>/g, "")
      .replaceAll("重大因子管理升级（评分分档不变）", "重大因子补充诊断（不单独形成预警）")
      .replaceAll("管理关注升级不改变评分或分档，需由风险管理人员人工判断是否提交标准行动申请。", "重大因子用于补充诊断，不单独形成行动；黄灯、红灯、黑灯按当前亮灯形成一企一预警。")
      .replaceAll("模型 / 内容版本</span><strong>1.0.1 / 1.5.0", `模型 / 内容版本</span><strong>${model.packageVersion} / 1.6.0`)
      .replaceAll("html-print-capability-v7", "html-print-capability-v8")
      .replaceAll("内容版本 1.5.0", "内容版本 1.6.0")
      .replaceAll("2 条亮灯预警", "1 条亮灯预警");
    const reportId = contentEntry.content.reportId;
    html = html.replace(/<meta name="scenarioRunId" content="[^"]+">/, `<meta name="scenarioRunId" content="${NEW_RUN}">`);
    const next = {
      ...artifact,
      artifactId: `S003-ART-${NEW_RUN}-${enterpriseId}`,
      reportId,
      artifactVersion: "html-print-capability-v8",
      contentVersion: "1.6.0",
      contentSha256: contentEntry.contentSha256,
      deepLink: {
        href: contentEntry.content.deepLink,
        parameters: {
          scenarioId: "S003",
          scenarioVersion: "S003-v1",
          scenarioRunId: NEW_RUN,
          prototypeVersion: "1.1.0",
          enterpriseId,
          reportId
        },
        exactScenarioRunBinding: true,
        historicalViewReadOnly: true
      },
      html
    };
    next.artifactSha256 = sha256(html);
    return next;
  });

  const manifest = transform(readJson("resources/m06/report-manifest.v7.json"));
  manifest.schemaVersion = "ofw.s003.m06.report-manifest.v8";
  manifest.manifestId = "S003-M06-REPORT-MANIFEST-20260817-007";
  manifest.manifestVersion = "1.6.0";
  manifest.supersedes = "resources/m06/report-manifest.v7.json";
  manifest.formedAt = contents.formedAt;
  manifest.scenarioIdentity = scenarioContext();
  manifest.modelIdentity = { ...manifest.modelIdentity, packageVersion: model.packageVersion };
  manifest.source = {
    ...manifest.source,
    c035Results: { ...(manifest.source?.c035Results || {}), ref: "resources/m01/c035-risk-results.v2.json", resultSetId: riskResults.resultSetId, resultSetVersion: riskResults.resultSetVersion },
    decisionResults: { ...(manifest.source?.decisionResults || {}), ref: "resources/m04/decision-results.v3.json", resultSetId: decisionResults.resultSetId, resultSetVersion: decisionResults.resultSetVersion }
  };
  const artifactByReport = new Map(artifacts.artifacts.map((item) => [item.reportId, item]));
  manifest.reports = contents.reports.map((entry) => {
    const artifact = artifactByReport.get(entry.reportId);
    return {
      ...(manifest.reports.find((item) => item.enterpriseId === entry.content.enterprise.enterpriseId) || {}),
      reportId: entry.reportId,
      reportVersion: "1.6.0",
      contentVersion: "1.6.0",
      contentSha256: entry.contentSha256,
      artifactId: artifact.artifactId,
      artifactVersion: artifact.artifactVersion,
      artifactSha256: artifact.artifactSha256,
      enterpriseId: entry.content.enterprise.enterpriseId,
      enterpriseName: entry.content.enterprise.name,
      finalScore: entry.content.assessment.finalScore,
      riskTierId: entry.content.assessment.riskTier.tierId,
      scenarioIdentity: scenarioContext(),
      prototypeVersion: "1.1.0",
      deepLink: entry.content.deepLink
    };
  });
  manifest.summary = {
    ...manifest.summary,
    riskTierCounts: riskResults.summary.riskTierCounts,
    alertEnterpriseCount: riskResults.summary.alertEnterpriseCount,
    alertCount: riskResults.summary.dispositionCandidateCount
  };

  const history = transform(readJson("resources/m06/report-history-index.v2.json"));
  history.schemaVersion = "ofw.s003.m06.report-history-index.v3";
  history.historyId = "S003-M06-REPORT-HISTORY-20260817-003";
  history.historyVersion = "1.2.0";
  history.formedAt = contents.formedAt;
  history.scenarioIdentity = scenarioContext();
  history.currentManifestRef = "resources/m06/report-manifest.v8.json";
  history.versions = history.versions.map((item) => ({ ...item, status: "historical", supersededBy: item.sequence === 7 ? "resources/m06/report-manifest.v8.json" : item.supersededBy }));
  history.versions.push({
    sequence: 8,
    manifestId: manifest.manifestId,
    manifestVersion: manifest.manifestVersion,
    manifestRef: "resources/m06/report-manifest.v8.json",
    formedAt: contents.formedAt,
    reportCount: manifest.reportCount,
    status: "current",
    supersedes: "resources/m06/report-manifest.v7.json",
    supersededBy: null,
    immutable: true
  });
  history.versionCount = history.versions.length;
  return { contents, artifacts, manifest, history };
}

function buildAgentPosition(model, pointer, reports) {
  const profile = transform(readJson("resources/m05/agent-position.v5.json"));
  const reportManifest = reports.manifest;
  const reportContents = reports.contents;
  const reportArtifacts = reports.artifacts;
  const manifestReport = reportManifest.reports[0];
  const contentEntry = reportContents.reports.find((item) => item.reportId === manifestReport.reportId);
  const artifact = reportArtifacts.artifacts.find((item) => item.reportId === manifestReport.reportId);
  if (!contentEntry?.content || !artifact) throw new Error("M05 场景配置无法绑定 v8 正式报告资源");
  const content = contentEntry.content;
  profile.schemaVersion = "ofw.s003.m05.agent-position.v6";
  profile.exportVersion = "1.6.0";
  profile.supersedes = "resources/m05/agent-position.v5.json";
  profile.scenarioIdentity = { ...scenarioContext(), sourceScenarioRunId: NEW_RUN };
  profile.scenarioProfile = {
    ...profile.scenarioProfile,
    derivedReleaseVersion: "1.4",
    prompt: {
      ...profile.scenarioProfile.prompt,
      version: "1.3",
      validatedAt: DISPLAY_TIME,
      change: "绑定 S003 v8 正式企业债务风险报告、Published 1.0.2 模型、13 项确定性核验摘要和稳定证据引用。"
    }
  };
  profile.publishedModel = {
    ...profile.publishedModel,
    pointerVersion: pointer.pointerVersion,
    pointerRef: "resources/m01/published-pointer.v2.json",
    pointerSha256: sha256(serialize(pointer)),
    packageVersion: model.packageVersion,
    semanticVersionId: `${model.packageId}@${model.packageVersion}`,
    displayName: `债务风险评估模型 · Published ${model.packageVersion}`
  };
  profile.reportBinding = {
    ...profile.reportBinding,
    manifestId: reportManifest.manifestId,
    manifestVersion: reportManifest.manifestVersion,
    manifestRef: "resources/m06/report-manifest.v8.json",
    manifestSha256: sha256(serialize(reportManifest)),
    contentSetId: reportContents.contentSetId,
    contentSetVersion: reportContents.contentSetVersion,
    contentRef: "resources/m06/report-contents.v8.json",
    contentSetSha256: sha256(serialize(reportContents)),
    reportId: manifestReport.reportId,
    reportVersion: manifestReport.reportVersion,
    contentVersion: manifestReport.contentVersion,
    contentSha256: manifestReport.contentSha256,
    artifactSetId: reportArtifacts.artifactSetId,
    artifactSetVersion: reportArtifacts.artifactSetVersion,
    artifactRef: "resources/m06/report-artifacts.v8.json",
    artifactSetSha256: sha256(serialize(reportArtifacts)),
    artifactId: artifact.artifactId,
    artifactVersion: artifact.artifactVersion,
    artifactSha256: artifact.artifactSha256,
    verificationRef: `resources/m06/report-contents.v8.json#/reports/0/content/verificationSummary`,
    verificationSummary: content.verificationSummary,
    enterprise: content.enterprise,
    assessment: {
      finalScore: content.assessment.finalScore,
      riskTierId: content.assessment.riskTier.tierId,
      riskTierName: content.assessment.riskTier.name,
      factorSum: content.assessment.factorSum,
      lowestIndicators: (content.indicatorDetails || []).slice().sort((a, b) => Number(a.score || 0) - Number(b.score || 0)).slice(0, 3).map((item) => item.name),
      negativeFactors: (content.adjustmentFactors || []).filter((item) => Number(item.coefficient || 0) < 0).map((item) => `${item.name} ${Number(item.coefficient).toFixed(2)}`)
    },
    deepLink: content.deepLink
  };
  return profile;
}

function main() {
  const routing = enterpriseRoutes();
  const decisionBinding = buildDecisionBinding();
  const model = buildModelPackage();
  const pointer = buildPublishedPointer(model);
  const c017 = buildC017Projection(pointer);
  const catalog = buildCatalog(model);
  const riskResults = buildRiskResults(model, pointer);
  const evaluationRun = buildEvaluationRun(riskResults, model);
  const facts = buildFacts(riskResults, model);
  const runtimeExport = buildRuntimeExport(riskResults, model, pointer, evaluationRun, facts);
  const queryCatalog = buildQueryCatalog();
  const query = buildQueryAssets(riskResults, facts, queryCatalog);
  const decision = buildDecisionAssets(riskResults, catalog, routing, c017, decisionBinding);
  const reports = buildReportAssets(riskResults, decision.results, model);
  const agentPosition = buildAgentPosition(model, pointer, reports);

  const outputs = [
    ["resources/m04/decision-binding.v2.json", decisionBinding],
    ["resources/m04/enterprise-contact-routing.v1.json", routing],
    ["resources/m02/c017-decision-projection.v2.json", c017],
    ["resources/m01/model-package.v2.json", model],
    ["resources/m01/published-pointer.v2.json", pointer],
    ["resources/m01/action-type-catalog.v2.json", catalog],
    ["resources/m01/c035-risk-results.v2.json", riskResults],
    ["resources/m01/evaluation-run.v2.json", evaluationRun],
    ["resources/m01/published-risk-facts.v2.json", facts],
    ["resources/m01/runtime-export.v2.json", runtimeExport],
    ["resources/m03/query-catalog.v3.json", queryCatalog],
    ["resources/m03/query-runtime.v2.json", query.runtime],
    ["resources/m03/query-results.v2.json", query.results],
    ["resources/m04/decision-runtime.v2.json", decision.runtime],
    ["resources/m04/decision-inbox.v3.json", decision.inbox],
    ["resources/m04/decision-results.v3.json", decision.results],
    ["resources/m06/report-contents.v8.json", reports.contents],
    ["resources/m06/report-artifacts.v8.json", reports.artifacts],
    ["resources/m06/report-manifest.v8.json", reports.manifest],
    ["resources/m06/report-history-index.v3.json", reports.history],
    ["resources/m05/agent-position.v6.json", agentPosition]
  ];
  const contractRefs = new Set([
    "resources/m04/decision-binding.v2.json",
    "resources/m04/enterprise-contact-routing.v1.json",
    "resources/m02/c017-decision-projection.v2.json",
    "resources/m01/model-package.v2.json",
    "resources/m01/published-pointer.v2.json",
    "resources/m01/action-type-catalog.v2.json",
    "resources/m01/c035-risk-results.v2.json",
    "resources/m01/runtime-export.v2.json",
    "resources/m04/decision-runtime.v2.json",
    "resources/m04/decision-inbox.v3.json",
    "resources/m04/decision-results.v3.json"
  ]);
  const selectedOutputs = CONTRACTS_ONLY ? outputs.filter(([ref]) => contractRefs.has(ref)) : outputs;
  selectedOutputs.forEach(([ref, value]) => writeJson(ref, value));
  process.stdout.write(`${JSON.stringify({
    scenarioRunId: NEW_RUN,
    modelVersion: model.packageVersion,
    enterpriseCount: riskResults.enterpriseCount,
    riskTierCounts: riskResults.summary.riskTierCounts,
    alertCount: riskResults.summary.dispositionCandidateCount,
    routedEnterpriseCount: routing.routes.length,
    pendingRequests: decision.inbox.requests.length,
    confirmedTodos: decision.results.candidateSummary.todosCreated,
    reportCount: reports.manifest.reportCount,
    mode: CONTRACTS_ONLY ? "contracts-only" : "full",
    outputs: selectedOutputs.map(([ref]) => ref)
  }, null, 2)}\n`);
}

main();
