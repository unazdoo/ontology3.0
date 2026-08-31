(function initS005EvaluationEngine(root, factory) {
  const adapter = root && root.OFWS005ScenarioAdapter
    ? root.OFWS005ScenarioAdapter
    : (typeof require === "function" ? require("./scenario-adapter.js") : null);
  const configApi = root && root.OFWS005ScenarioConfig
    ? root.OFWS005ScenarioConfig
    : (typeof require === "function" ? require("./scenario-config.js") : null);
  const api = factory(adapter, configApi);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.OFWS005EvaluationEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createS005EvaluationEngineApi(adapter, configApi) {
  "use strict";

  if (!adapter || !configApi || !configApi.workflow) throw new Error("S005 adapter and scenario config are required");

  const SCHEMA_VERSION = "ofw.s005.evaluation-engine.v2";
  const MODULE_OUTPUT_SCHEMA_VERSION = "ofw.s005.module-output.v2";
  const FORMULA_VERSION = "S005-EVAL-FORMULA-v1";
  const PARAMETER_VERSION = "S005-EVAL-PARAM-v1";
  const TERMINAL_STAGE_STATES = new Set(["complete", "verified", "not_applicable"]);
  const SCORED_METRIC_STATES = new Set(["available", "partial"]);
  const METRIC_STATES = new Set(["available", "partial", "observation_period_insufficient", "not_evaluable"]);

  const EVENT_TYPES = Object.freeze({
    SOURCE_DELIVERED: "M02_SOURCE_QUALITY_DELIVERED",
    SEMANTIC_DELIVERED: "M01_SEMANTIC_CANDIDATE_DELIVERED",
    COMPLIANCE_DELIVERED: "M03_COMPLIANCE_RESULT_DELIVERED",
    MARKET_PEER_DELIVERED: "M03_MARKET_PEER_RESULT_DELIVERED",
    SELECTION_SCOPE_CONFIRMED: "M04_SELECTION_SCOPE_CONFIRMED",
    RISK_DELIVERED: "M05_RISK_RESULT_DELIVERED",
    EXPLORATION_DELIVERED: "M07_EXPLORATION_RESULT_DELIVERED",
    MODEL_RESULT_DELIVERED: "M08_CANDIDATE_MODEL_RESULT_DELIVERED",
    SERIES_INPUT_UNAVAILABLE: "SERIES_INPUT_UNAVAILABLE",
    REPORT_DRAFT_DELIVERED: "M06_REPORT_DRAFT_DELIVERED"
  });

  const OPERATIONS = Object.freeze({
    SOURCE_DELIVERY: "source_delivery",
    SEMANTIC_CANDIDATE: "semantic_candidate",
    COMPLIANCE_EVALUATION: "compliance_evaluation",
    MARKET_PEER_EVALUATION: "market_peer_evaluation",
    SELECTION_READ_ONLY: "selection_read_only",
    RISK_EXPLANATION: "risk_explanation",
    EXPLORATION_RESULT: "exploration_result",
    MODEL_RESULT: "model_result",
    SERIES_INPUT_UNAVAILABLE: "series_input_unavailable",
    REPORT_DRAFT: "report_draft"
  });

  const OPERATION_EVENT_TYPES = Object.freeze({
    [OPERATIONS.SOURCE_DELIVERY]: EVENT_TYPES.SOURCE_DELIVERED,
    [OPERATIONS.SEMANTIC_CANDIDATE]: EVENT_TYPES.SEMANTIC_DELIVERED,
    [OPERATIONS.COMPLIANCE_EVALUATION]: EVENT_TYPES.COMPLIANCE_DELIVERED,
    [OPERATIONS.MARKET_PEER_EVALUATION]: EVENT_TYPES.MARKET_PEER_DELIVERED,
    [OPERATIONS.SELECTION_READ_ONLY]: EVENT_TYPES.SELECTION_SCOPE_CONFIRMED,
    [OPERATIONS.RISK_EXPLANATION]: EVENT_TYPES.RISK_DELIVERED,
    [OPERATIONS.EXPLORATION_RESULT]: EVENT_TYPES.EXPLORATION_DELIVERED,
    [OPERATIONS.MODEL_RESULT]: EVENT_TYPES.MODEL_RESULT_DELIVERED,
    [OPERATIONS.SERIES_INPUT_UNAVAILABLE]: EVENT_TYPES.SERIES_INPUT_UNAVAILABLE,
    [OPERATIONS.REPORT_DRAFT]: EVENT_TYPES.REPORT_DRAFT_DELIVERED,
    sourceBatch: EVENT_TYPES.SOURCE_DELIVERED,
    classification: EVENT_TYPES.SEMANTIC_DELIVERED,
    compliance: EVENT_TYPES.COMPLIANCE_DELIVERED,
    marketPeer: EVENT_TYPES.MARKET_PEER_DELIVERED,
    selection: EVENT_TYPES.SELECTION_SCOPE_CONFIRMED,
    tradingRisk: EVENT_TYPES.RISK_DELIVERED,
    exploration: EVENT_TYPES.EXPLORATION_DELIVERED,
    modeling: EVENT_TYPES.MODEL_RESULT_DELIVERED,
    seriesInputUnavailable: EVENT_TYPES.SERIES_INPUT_UNAVAILABLE,
    reportDraft: EVENT_TYPES.REPORT_DRAFT_DELIVERED
  });

  const EVENT_FLOW = Object.freeze([
    Object.freeze({ moduleId: "M02", eventType: EVENT_TYPES.SOURCE_DELIVERED, stageId: "sourceBatch", stageStatus: "complete" }),
    Object.freeze({ moduleId: "M01", eventType: EVENT_TYPES.SEMANTIC_DELIVERED, stageId: "classification", stageStatus: "complete" }),
    Object.freeze({ moduleId: "M03", eventType: EVENT_TYPES.COMPLIANCE_DELIVERED, stageId: "compliance", stageStatus: "complete" }),
    Object.freeze({ moduleId: "M03", eventType: EVENT_TYPES.MARKET_PEER_DELIVERED, stageId: "marketPeer", stageStatus: "complete" }),
    Object.freeze({ moduleId: "M04", eventType: EVENT_TYPES.SELECTION_SCOPE_CONFIRMED, stageId: "selection", stageStatus: "not_applicable" }),
    Object.freeze({ moduleId: "M05", eventType: EVENT_TYPES.RISK_DELIVERED, stageId: "tradingRisk", stageStatus: "running" }),
    Object.freeze({ moduleId: "M07", eventType: EVENT_TYPES.EXPLORATION_DELIVERED, stageId: "tradingRisk", stageStatus: "running" }),
    Object.freeze({ moduleId: "M08", eventType: EVENT_TYPES.MODEL_RESULT_DELIVERED, stageId: "tradingRisk", stageStatus: "complete" }),
    Object.freeze({ moduleId: "M06", eventType: EVENT_TYPES.REPORT_DRAFT_DELIVERED, stageId: "reportDraft", stageStatus: "complete" })
  ]);

  const SOURCE_AUDIT = Object.freeze({
    snapshotCount: 79,
    sheetInstanceCount: 393,
    candidateCount: 15,
    asOf: "2026-07-17",
    windBatchId: null
  });

  const METRIC_DEFINITIONS = Object.freeze({
    productPerformance: Object.freeze({
      title: "产品自身表现",
      metrics: Object.freeze([
        metricDefinition("twr", "TWR", "pct", "not_evaluable", "缺少完整估值区间和受治理 NAV 序列。"),
        metricDefinition("sharpe", "Sharpe", "ratio", "observation_period_insufficient", "当前周快照不能按日频口径计算 Sharpe。"),
        metricDefinition("sortino", "Sortino", "ratio", "observation_period_insufficient", "缺少足够频率和长度的下行收益序列。"),
        metricDefinition("calmar", "Calmar", "ratio", "observation_period_insufficient", "缺少足够观察期的收益与回撤序列。"),
        metricDefinition("informationRatio", "信息比率", "ratio", "observation_period_insufficient", "缺少同频产品和基准收益序列。"),
        metricDefinition("volatility", "波动率", "pct", "observation_period_insufficient", "缺少满足公式口径的收益序列。"),
        metricDefinition("maxDrawdown", "最大回撤", "pct", "not_evaluable", "缺少连续 NAV 序列。"),
        metricDefinition("drawdownRecovery", "回撤恢复", "days", "not_evaluable", "缺少最大回撤后的连续 NAV 序列。")
      ])
    }),
    actualInvestorResult: Object.freeze({
      title: "财务公司实际投资结果",
      metrics: Object.freeze([
        metricDefinition("actualTwr", "实际投资 TWR", "pct", "not_evaluable", "缺少完整估值区间、实际持仓和受治理 NAV 序列。"),
        metricDefinition("mwrXirr", "MWR / XIRR", "pct", "not_evaluable", "缺少完整且带日期的实际现金流。"),
        metricDefinition("realizedReturn", "已实现收益", "currency", "not_evaluable", "缺少完整赎回与结算流水。"),
        metricDefinition("unrealizedReturn", "未实现收益", "currency", "not_evaluable", "缺少评价日实际持仓与 NAV。"),
        metricDefinition("cashFlow", "现金流", "currency", "not_evaluable", "缺少申购、赎回、分红和费用现金流。"),
        metricDefinition("fees", "费用", "currency", "not_evaluable", "缺少实际费用明细。")
      ])
    }),
    fixedIncomeRisk: Object.freeze({
      title: "固定收益风险",
      metrics: Object.freeze([
        metricDefinition("duration", "久期", "years", "not_evaluable", "缺少穿透持仓和久期证据。"),
        metricDefinition("ratingMigration", "评级迁移", "state", "not_evaluable", "缺少连续评级与迁移事件。"),
        metricDefinition("concentration", "集中度", "pct", "not_evaluable", "缺少完整穿透持仓。"),
        metricDefinition("liquidity", "流动性", "state", "not_evaluable", "缺少证券级流动性和赎回约束证据。"),
        metricDefinition("carryAttribution", "Carry 归因", "pct", "not_evaluable", "缺少债券级持仓与收益分解。"),
        metricDefinition("rollDownAttribution", "Roll-down 归因", "pct", "not_evaluable", "缺少收益率曲线和持仓期限迁移。"),
        metricDefinition("curveAttribution", "曲线归因", "pct", "not_evaluable", "缺少同频曲线与敏感度。"),
        metricDefinition("creditAttribution", "信用归因", "pct", "not_evaluable", "缺少信用利差和评级暴露。")
      ])
    }),
    managementOperationsQuality: Object.freeze({
      title: "管理与运行质量",
      metrics: Object.freeze([
        metricDefinition("navPublicationTimeliness", "NAV 发布及时性", "state", "not_evaluable", "缺少 NAV 发布事件时间。"),
        metricDefinition("valuationExceptionCount", "估值异常", "count", "not_evaluable", "缺少估值异常事件。"),
        metricDefinition("operationIncidentCount", "运行事件", "count", "not_evaluable", "缺少运行事件台账。")
      ])
    }),
    continuingEligibilityCompliance: Object.freeze({
      title: "持续准入合规",
      metrics: Object.freeze([
        metricDefinition("continuingEligibility", "持续准入", "state", "not_evaluable", "持续准入证据尚未闭合。"),
        metricDefinition("complianceExceptions", "合规例外", "count", "not_evaluable", "缺少完整合规事件与处置证据。"),
        metricDefinition("classificationConfidence", "分类置信度", "ratio", "not_evaluable", "Wind fund_type 与候选分类口径尚未完成复核。")
      ])
    }),
    selectionExecution: Object.freeze({
      title: "选择与执行",
      metrics: Object.freeze([
        metricDefinition("selectionAttribution", "选择归因", "pct", "not_evaluable", "缺少可比投资池和受治理基准。"),
        metricDefinition("timingAttribution", "择时归因", "pct", "not_evaluable", "缺少决策时间、实际成交和同频 NAV。"),
        metricDefinition("nextAvailableNav", "下一可得 NAV", "nav", "not_evaluable", "缺少决策后下一可得 NAV。"),
        metricDefinition("actualNav", "实际 NAV", "nav", "not_evaluable", "缺少实际确认 NAV。"),
        metricDefinition("slippage", "滑点", "pct", "not_evaluable", "下一可得 NAV 与实际 NAV 尚不齐备。"),
        metricDefinition("settlementStatus", "结算状态", "state", "not_evaluable", "缺少结算流水。")
      ])
    })
  });

  function metricDefinition(metricId, label, unit, defaultStatus, missingReason) {
    return Object.freeze({ metricId, label, unit, defaultStatus, missingReason });
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
  }

  function immutable(value) {
    return deepFreeze(clone(value));
  }

  function stableStringify(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }

  function hash32(value, seed) {
    let hash = seed >>> 0;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  }

  function stableToken(value) {
    const input = typeof value === "string" ? value : stableStringify(value);
    return `${hash32(input, 2166136261)}${hash32(input.split("").reverse().join(""), 2246822519)}`;
  }

  function isoTimestamp(value, fieldName) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error(`${fieldName} must be an ISO timestamp`);
    return date.toISOString();
  }

  function assertDateOnly(value, fieldName) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "") || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) {
      throw new Error(`${fieldName} must be an ISO date`);
    }
    return value;
  }

  function nonEmptyString(value, fieldName) {
    if (typeof value !== "string" || !value.trim()) throw new Error(`${fieldName} is required`);
    return value.trim();
  }

  function evidenceRefs(value, fieldName) {
    if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || !item.trim())) {
      throw new Error(`${fieldName} must contain at least one evidence reference`);
    }
    return [...new Set(value.map((item) => item.trim()))];
  }

  function missingReasons(value, fieldName) {
    if (value == null) return [];
    const items = Array.isArray(value) ? value : [value];
    if (items.some((item) => typeof item !== "string" || !item.trim())) throw new Error(`${fieldName} must contain non-empty strings`);
    return [...new Set(items.map((item) => item.trim()))];
  }

  function assertSameScenarioContext(candidate, current) {
    const checked = adapter.assertScenarioContext(candidate);
    if (stableStringify(checked) !== stableStringify(current)) throw new Error("event scenarioContext does not match the current S005 run");
    return checked;
  }

  function initialStages() {
    return Object.fromEntries(configApi.workflow.map((step) => [step.id, {
      stageId: step.id,
      moduleId: step.moduleId,
      status: "pending",
      evidence: null,
      updatedAt: null
    }]));
  }

  function initialDomains() {
    return Object.fromEntries(Object.entries(METRIC_DEFINITIONS).map(([domainId, definition]) => [domainId, {
      domainId,
      title: definition.title,
      status: "not_evaluable",
      metrics: Object.fromEntries(definition.metrics.map((metric) => [metric.metricId, {
        metricId: metric.metricId,
        label: metric.label,
        value: null,
        unit: metric.unit,
        status: metric.defaultStatus,
        missingReason: metric.missingReason,
        evidenceRefs: [],
        observationFrequency: null,
        annualizationBasis: null
      }])),
      scoredCoverage: 0,
      conclusion: "无法评价：当前证据不足。",
      missingReasons: [...new Set(definition.metrics.map((metric) => metric.missingReason))],
      evidenceRefs: []
    }]));
  }

  function summarizeDomain(domain) {
    const metrics = Object.values(domain.metrics);
    const scored = metrics.filter((metric) => SCORED_METRIC_STATES.has(metric.status) && metric.value !== null).length;
    const coverage = metrics.length ? round4(scored / metrics.length) : 0;
    const missingReasons = [...new Set(metrics.filter((metric) => metric.missingReason).map((metric) => metric.missingReason))];
    const refs = [...new Set(metrics.flatMap((metric) => metric.evidenceRefs || []))];
    let status = "not_evaluable";
    let conclusion = "无法评价：当前证据不足。";
    if (scored === metrics.length && metrics.length) {
      status = "evaluated";
      conclusion = "现有证据已覆盖本评价域。";
    } else if (scored > 0) {
      status = "partial";
      conclusion = "部分评价：已展示可计算指标，未覆盖项保留缺失原因。";
    } else if (metrics.some((metric) => metric.status === "observation_period_insufficient")) {
      status = "observation_period_insufficient";
      conclusion = "观察期不足：不对缺失指标补零。";
    }
    return { ...domain, status, scoredCoverage: coverage, conclusion, missingReasons, evidenceRefs: refs };
  }

  function round4(value) {
    return Math.round(Number(value) * 10000) / 10000;
  }

  function confidenceForCoverage(coverage) {
    const score = round4(Math.min(0.95, coverage * 0.9));
    const level = coverage >= 0.75 ? "high" : coverage >= 0.5 ? "medium" : coverage >= 0.25 ? "low" : "very_low";
    return { score, level };
  }

  function normalizeMetric(metricId, current, patch, fallbackEvidenceRefs) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error(`metric update ${metricId} must be an object`);
    const status = patch.status || (patch.value !== null && patch.value !== undefined ? "available" : "not_evaluable");
    if (!METRIC_STATES.has(status)) throw new Error(`unsupported metric status for ${metricId}: ${status}`);
    const observationFrequency = patch.observationFrequency || current.observationFrequency || null;
    const annualizationBasis = patch.annualizationBasis || current.annualizationBasis || null;
    const refs = patch.evidenceRefs ? evidenceRefs(patch.evidenceRefs, `${metricId}.evidenceRefs`) : fallbackEvidenceRefs;
    if (patch.unit && patch.unit !== current.unit) throw new Error(`${metricId} unit must remain ${current.unit}`);

    if (metricId === "sharpe" && SCORED_METRIC_STATES.has(status)) {
      if (!patch.observationFrequency || !patch.annualizationBasis) throw new Error("scored Sharpe requires explicit observationFrequency and annualizationBasis");
      const supported = new Set(["daily", "weekly", "monthly"]);
      if (!supported.has(String(observationFrequency).toLowerCase()) || !supported.has(String(annualizationBasis).toLowerCase())) {
        throw new Error("scored Sharpe frequency and annualization basis are unsupported");
      }
    }

    if (metricId === "sharpe" && SCORED_METRIC_STATES.has(status) && String(observationFrequency).toLowerCase() !== String(annualizationBasis).toLowerCase()) {
      return {
        ...current,
        value: null,
        status: "observation_period_insufficient",
        missingReason: "周快照不得按日频口径计算 Sharpe。",
        evidenceRefs: refs,
        observationFrequency,
        annualizationBasis
      };
    }

    if (SCORED_METRIC_STATES.has(status)) {
      if (patch.value === null || patch.value === undefined || patch.value === "") throw new Error(`${metricId} ${status} requires an explicit value`);
      if (status === "partial" && !patch.missingReason) throw new Error(`${metricId} partial requires a missingReason`);
      return {
        ...current,
        value: clone(patch.value),
        unit: patch.unit || current.unit,
        status,
        missingReason: status === "partial" ? nonEmptyString(patch.missingReason, `${metricId}.missingReason`) : null,
        evidenceRefs: refs,
        observationFrequency,
        annualizationBasis
      };
    }

    if (patch.value !== null && patch.value !== undefined) throw new Error(`${metricId} ${status} must keep value null`);
    return {
      ...current,
      value: null,
      status,
      missingReason: nonEmptyString(patch.missingReason || current.missingReason, `${metricId}.missingReason`),
      evidenceRefs: refs,
      observationFrequency,
      annualizationBasis
    };
  }

  function applyMetricUpdates(domains, updates, fallbackEvidenceRefs) {
    if (updates == null) return domains;
    if (typeof updates !== "object" || Array.isArray(updates)) throw new Error("metricUpdates must be an object keyed by evaluation domain");
    const next = clone(domains);
    Object.entries(updates).forEach(([domainId, domainUpdates]) => {
      if (!next[domainId]) throw new Error(`unknown evaluation domain: ${domainId}`);
      if (!domainUpdates || typeof domainUpdates !== "object" || Array.isArray(domainUpdates)) throw new Error(`${domainId} metric updates must be an object`);
      Object.entries(domainUpdates).forEach(([metricId, patch]) => {
        if (!next[domainId].metrics[metricId]) throw new Error(`unknown metric ${domainId}.${metricId}`);
        next[domainId].metrics[metricId] = normalizeMetric(metricId, next[domainId].metrics[metricId], patch, fallbackEvidenceRefs);
      });
    });
    return Object.fromEntries(Object.entries(next).map(([domainId, domain]) => [domainId, summarizeDomain(domain)]));
  }

  function appliedMetricUpdates(domains, updates) {
    if (updates == null) return null;
    return Object.fromEntries(Object.entries(updates).map(([domainId, domainUpdates]) => [domainId,
      Object.fromEntries(Object.keys(domainUpdates).map((metricId) => [metricId, clone(domains[domainId].metrics[metricId])]))
    ]));
  }

  function progressForStages(stages) {
    const values = Object.values(stages);
    return {
      done: values.filter((stage) => TERMINAL_STAGE_STATES.has(stage.status)).length,
      total: values.length,
      active: values.filter((stage) => stage.status === "running").length,
      blocked: values.filter((stage) => stage.status === "blocked").length
    };
  }

  function overallAssessment(domains) {
    const metrics = Object.values(domains).flatMap((domain) => Object.values(domain.metrics));
    const scored = metrics.filter((metric) => SCORED_METRIC_STATES.has(metric.status) && metric.value !== null).length;
    const scoredCoverage = metrics.length ? round4(scored / metrics.length) : 0;
    const evaluationStatus = scored === 0 ? "not_evaluable" : scored === metrics.length ? "complete" : "partial";
    return {
      metricCount: metrics.length,
      scoredMetricCount: scored,
      scoredCoverage,
      confidence: confidenceForCoverage(scoredCoverage),
      evaluationStatus
    };
  }

  function runIdFor(context, formulaVersion, parameterVersion) {
    return `S005-EVAL-RUN-${stableToken({ scenarioRunId: context.scenarioRunId, formulaVersion, parameterVersion })}`;
  }

  function resultStageDigest(stages) {
    return Object.fromEntries(Object.entries(stages).map(([stageId, stage]) => [stageId, {
      status: stage.status,
      moduleOutputId: stage.evidence?.moduleOutputId || null,
      moduleId: stage.evidence?.moduleId || null,
      eventType: stage.evidence?.eventType || null,
      scenarioRunId: stage.evidence?.scenarioRunId || null,
      updatedAt: stage.updatedAt || null
    }]));
  }

  function resultIdFor(evaluationRunId, formulaVersion, parameterVersion, assessment, domains, runStatus, stages, factualModuleOutputRefs, modelingOutputs, updatedAt) {
    return `S005-EVAL-RESULT-${stableToken({
      evaluationRunId,
      formulaVersion,
      parameterVersion,
      scoredCoverage: assessment.scoredCoverage,
      confidence: assessment.confidence,
      domainDigest: stableToken(domains),
      runStatus,
      stageDigest: stableToken(resultStageDigest(stages)),
      factualOutputDigest: stableToken(factualModuleOutputRefs),
      modelingDigest: stableToken(modelingOutputs),
      updatedAt
    })}`;
  }

  function validateSourceAudit(payload) {
    const sourceAudit = payload.sourceAudit;
    if (!sourceAudit || typeof sourceAudit !== "object" || Array.isArray(sourceAudit)) throw new Error("M02 sourceAudit is required");
    ["snapshotCount", "sheetInstanceCount", "candidateCount", "asOf"].forEach((field) => {
      if (sourceAudit[field] !== SOURCE_AUDIT[field]) throw new Error(`M02 sourceAudit.${field} must equal ${SOURCE_AUDIT[field]}`);
    });
    if (sourceAudit.windBatchId !== null) throw new Error("M02 sourceAudit.windBatchId must be null until a real Wind batch exists");
    return {
      ...SOURCE_AUDIT,
      dataVersionId: nonEmptyString(sourceAudit.dataVersionId, "M02 sourceAudit.dataVersionId"),
      qualityStatus: sourceAudit.qualityStatus === "complete" ? "complete" : "partial",
      windBatchStatus: "missing",
      windBatchMissingReason: nonEmptyString(sourceAudit.windBatchMissingReason || "Wind 批次尚未交付。", "M02 sourceAudit.windBatchMissingReason")
    };
  }

  function assertNoPublishedArtifacts(payload) {
    const forbidden = ["publishedOntology", "publishedMetric", "publishedRule", "publishedT019"];
    forbidden.forEach((field) => {
      if (payload[field] === true || payload[field] === "published" || Number(payload[field]) > 0) {
        throw new Error(`${field} is outside the S005 research boundary`);
      }
    });
  }

  function requireCurrentResultRef(payload, current, moduleId) {
    const currentResultId = current.evaluationResult?.evaluationResultId;
    const supplied = [payload.consumerResultRef, payload.evaluationResultId].filter((value) => value !== undefined && value !== null);
    if (!currentResultId || !supplied.length || supplied.some((value) => value !== currentResultId)) {
      throw new Error(`${moduleId} must consume the current S005 evaluation result`);
    }
    return currentResultId;
  }

  function validateEventPayload(step, payload, refs, occurredAt, current, history) {
    assertNoPublishedArtifacts(payload);
    switch (step.eventType) {
      case EVENT_TYPES.SOURCE_DELIVERED:
        return {
          sourceAudit: validateSourceAudit(payload),
          evaluationDate: assertDateOnly(payload.evaluationDate || SOURCE_AUDIT.asOf, "M02 evaluationDate"),
          eventReadAt: isoTimestamp(payload.eventReadAt || occurredAt, "M02 eventReadAt")
        };
      case EVENT_TYPES.SEMANTIC_DELIVERED:
        if (payload.classificationStatus !== "candidate") throw new Error("M01 classificationStatus must be candidate");
        return {
          windFundType: payload.windFundType == null ? null : nonEmptyString(payload.windFundType, "M01 windFundType"),
          windFundTypeStatus: payload.windFundType == null ? "missing" : "candidate",
          windFundTypeMissingReason: payload.windFundType == null ? nonEmptyString(payload.windFundTypeMissingReason, "M01 windFundTypeMissingReason") : null,
          classificationStatus: "candidate",
          ontologyVersionId: nonEmptyString(payload.ontologyVersionId, "M01 ontologyVersionId"),
          publishedArtifacts: []
        };
      case EVENT_TYPES.COMPLIANCE_DELIVERED:
        if (payload.accessMode !== "read_only") throw new Error("M03 must consume the evaluation result in read_only mode");
        if (!new Set(["partial", "not_evaluable"]).has(payload.conclusionStatus)) throw new Error("M03 compliance conclusionStatus must be partial or not_evaluable");
        return {
          accessMode: "read_only",
          consumerResultRef: requireCurrentResultRef(payload, current, "M03"),
          complianceResultRef: nonEmptyString(payload.complianceResultRef, "M03 complianceResultRef"),
          conclusionStatus: payload.conclusionStatus
        };
      case EVENT_TYPES.MARKET_PEER_DELIVERED:
        if (payload.accessMode !== "read_only") throw new Error("M03 must consume the evaluation result in read_only mode");
        if (!new Set(["partial", "not_evaluable"]).has(payload.conclusionStatus)) throw new Error("M03 market peer conclusionStatus must be partial or not_evaluable");
        return {
          accessMode: "read_only",
          consumerResultRef: requireCurrentResultRef(payload, current, "M03"),
          marketPeerResultRef: nonEmptyString(payload.marketPeerResultRef, "M03 marketPeerResultRef"),
          conclusionStatus: payload.conclusionStatus
        };
      case EVENT_TYPES.SELECTION_SCOPE_CONFIRMED: {
        const consumerResultRef = requireCurrentResultRef(payload, current, "M04");
        if (payload.accessMode !== "read_only" || payload.applicability !== "not_applicable") {
          throw new Error("M04 must be read_only and not_applicable");
        }
        ["actions", "reminders", "approvals", "todos", "trades"].forEach((field) => {
          if (!Array.isArray(payload[field]) || payload[field].length !== 0) throw new Error(`M04 ${field} must be an empty array`);
        });
        return {
          accessMode: "read_only",
          applicability: "not_applicable",
          actions: [],
          reminders: [],
          approvals: [],
          todos: [],
          trades: [],
          consumerResultRef,
          externalSideEffects: 0
        };
      }
      case EVENT_TYPES.RISK_DELIVERED: {
        const consumerResultRef = requireCurrentResultRef(payload, current, "M05");
        if (payload.accessMode !== "read_only") throw new Error("M05 must explain trading and risk results in read_only mode");
        if (payload.externalSideEffects !== undefined && payload.externalSideEffects !== 0) throw new Error("M05 externalSideEffects must be 0");
        return { accessMode: "read_only", consumerResultRef, explanationRef: nonEmptyString(payload.explanationRef, "M05 explanationRef"), externalSideEffects: 0 };
      }
      case EVENT_TYPES.EXPLORATION_DELIVERED: {
        const objectRef = payload.objectRef;
        const lensRef = payload.lensRef;
        const timeRange = payload.timeRange;
        if (!objectRef?.id || !objectRef?.objectTypeRef) throw new Error("M07 objectRef is required");
        if (!lensRef?.moduleId || !lensRef?.lensId || !lensRef?.route) throw new Error("M07 lensRef is required");
        if (!timeRange?.start || !timeRange?.end) throw new Error("M07 timeRange is required");
        return {
          consumerResultRef: requireCurrentResultRef(payload, current, "M07"),
          explorationResultRef: nonEmptyString(payload.explorationResultRef, "M07 explorationResultRef"),
          objectRef: clone(objectRef),
          lensRef: clone(lensRef),
          seriesRef: payload.seriesRef ? clone(payload.seriesRef) : null,
          timeRange: clone(timeRange),
          dataVersionId: nonEmptyString(payload.dataVersionId, "M07 dataVersionId"),
          ontologyVersionId: nonEmptyString(payload.ontologyVersionId, "M07 ontologyVersionId"),
          bindingId: nonEmptyString(payload.bindingId, "M07 bindingId"),
          evidenceRefs: refs
        };
      }
      case EVENT_TYPES.MODEL_RESULT_DELIVERED: {
        const consumerResultRef = requireCurrentResultRef(payload, current, "M08");
        if (payload.inputMode !== "SYNTHETIC_CANDIDATE_SIMULATION") throw new Error("M08 S005 inputMode must remain SYNTHETIC_CANDIDATE_SIMULATION");
        if (!payload.objectRef?.id || !payload.objectRef?.objectTypeRef) throw new Error("M08 objectRef is required");
        if (!payload.lensRef?.moduleId || !payload.lensRef?.lensId || !payload.lensRef?.route) throw new Error("M08 lensRef is required");
        if (!payload.timeRange?.start || !payload.timeRange?.end) throw new Error("M08 timeRange is required");
        if (!new Set(["PREDICTION", "SIMULATION"]).has(payload.resultKind)) throw new Error("M08 resultKind must be PREDICTION or SIMULATION");
        if (payload.resultStatus !== "available") throw new Error("M08 resultStatus must be available");
        if (payload.truthClass !== "candidate" || payload.replacesFact !== false) {
          throw new Error("M08 output must remain a candidate and must not replace facts");
        }
        if (payload.inputClassification !== "SYNTHETIC_RESEARCH_ONLY") {
          throw new Error("M08 inputClassification must be SYNTHETIC_RESEARCH_ONLY");
        }
        const fixtureId = nonEmptyString(payload.fixtureId, "M08 fixtureId");
        if (payload.containsSourceBusinessValues !== false) throw new Error("M08 containsSourceBusinessValues must be false");
        if (payload.factWriteAllowed !== false) throw new Error("M08 factWriteAllowed must be false");
        if (payload.actionWriteAllowed !== false) throw new Error("M08 actionWriteAllowed must be false");
        if (payload.sideEffectsEmitted !== 0) throw new Error("M08 sideEffectsEmitted must be 0");
        if (payload.metricUpdates) throw new Error("M08 candidate outputs cannot update factual evaluation metrics");
        return {
          outputRef: nonEmptyString(payload.outputRef, "M08 outputRef"),
          consumerResultRef,
          inputMode: "SYNTHETIC_CANDIDATE_SIMULATION",
          objectiveId: nonEmptyString(payload.objectiveId, "M08 objectiveId"),
          objectiveRevisionId: nonEmptyString(payload.objectiveRevisionId, "M08 objectiveRevisionId"),
          bindingRevisionId: nonEmptyString(payload.bindingRevisionId, "M08 bindingRevisionId"),
          releaseId: nonEmptyString(payload.releaseId, "M08 releaseId"),
          modelVersionId: nonEmptyString(payload.modelVersionId, "M08 modelVersionId"),
          objectRef: clone(payload.objectRef),
          lensRef: clone(payload.lensRef),
          seriesRef: payload.seriesRef ? clone(payload.seriesRef) : null,
          timeRange: clone(payload.timeRange),
          dataVersionId: nonEmptyString(payload.dataVersionId, "M08 dataVersionId"),
          ontologyVersionId: nonEmptyString(payload.ontologyVersionId, "M08 ontologyVersionId"),
          bindingId: nonEmptyString(payload.bindingId, "M08 bindingId"),
          resultKind: payload.resultKind,
          resultStatus: "available",
          truthClass: "candidate",
          replacesFact: false,
          fixtureId,
          inputClassification: "SYNTHETIC_RESEARCH_ONLY",
          containsSourceBusinessValues: false,
          factWriteAllowed: false,
          actionWriteAllowed: false,
          sideEffectsEmitted: 0
        };
      }
      case EVENT_TYPES.REPORT_DRAFT_DELIVERED: {
        const consumerResultRef = requireCurrentResultRef(payload, current, "M06");
        if (payload.reportStatus !== "draft") throw new Error("M06 reportStatus must be draft");
        if (payload.reviewStatus !== "pending") throw new Error("M06 reviewStatus must remain pending until an actual review event exists");
        const reviewEvidenceRefs = evidenceRefs(payload.reviewEvidenceRefs, "M06 reviewEvidenceRefs");
        if (!new Set(["available", "not_applicable"]).has(payload.historyComparisonStatus)) throw new Error("M06 historyComparisonStatus is invalid");
        const previous = Array.isArray(history) ? history.at(-1) : null;
        if (payload.historyComparisonStatus === "available") {
          if (!previous?.evaluationResult || payload.previousScenarioRunId !== previous.scenarioContext?.scenarioRunId || payload.previousEvaluationResultId !== previous.evaluationResult.evaluationResultId) {
            throw new Error("M06 history comparison references do not match the latest retained run/result");
          }
        }
        if (payload.historyComparisonStatus === "not_applicable") {
          if (previous?.evaluationResult) throw new Error("M06 history comparison cannot be not_applicable when a retained result exists");
          if (!payload.historyComparisonMissingReason) throw new Error("M06 not_applicable history comparison requires a missing reason");
        }
        return {
          consumerResultRef,
          reportRef: nonEmptyString(payload.reportRef, "M06 reportRef"),
          reportStatus: "draft",
          reviewStatus: "pending",
          reviewEvidenceRefs,
          historyComparisonStatus: payload.historyComparisonStatus,
          previousScenarioRunId: payload.previousScenarioRunId || null,
          previousEvaluationResultId: payload.previousEvaluationResultId || null,
          historyComparisonMissingReason: payload.historyComparisonMissingReason || null,
          publicationStatus: "not_published",
          publishedArtifacts: []
        };
      }
      default:
        throw new Error(`unsupported actual module event: ${step.eventType}`);
    }
  }

  function createInitialCurrent(scenarioContext) {
    return {
      scenarioContext: adapter.assertScenarioContext(scenarioContext),
      stages: initialStages(),
      cursor: 0,
      evaluationRun: null,
      evaluationResult: null,
      domains: initialDomains(),
      sourceDelivery: null,
      moduleOutputs: [],
      modelingOutputs: []
    };
  }

  function createEvaluationRun(current, sourceMetadata, occurredAt, formulaVersion, parameterVersion) {
    return {
      schemaVersion: SCHEMA_VERSION,
      evaluationRunId: runIdFor(current.scenarioContext, formulaVersion, parameterVersion),
      scenarioContext: clone(current.scenarioContext),
      status: "running",
      evaluationStatus: "not_evaluable",
      startedAt: occurredAt,
      completedAt: null,
      evaluationDate: sourceMetadata.evaluationDate,
      eventReadAt: sourceMetadata.eventReadAt,
      sourceAudit: sourceMetadata.sourceAudit,
      formulaVersion,
      parameterVersion
    };
  }

  function buildEvaluationResult(current, updatedAt) {
    if (!current.evaluationRun) return null;
    const domains = Object.fromEntries(Object.entries(current.domains).map(([domainId, domain]) => [domainId, summarizeDomain(domain)]));
    const assessment = overallAssessment(domains);
    const run = current.evaluationRun;
    const factualModuleOutputRefs = current.moduleOutputs.filter((output) => output.moduleId !== "M08").map((output) => output.outputId);
    const evaluationResultId = resultIdFor(
      run.evaluationRunId,
      run.formulaVersion,
      run.parameterVersion,
      assessment,
      domains,
      run.status,
      current.stages,
      factualModuleOutputRefs,
      current.modelingOutputs,
      updatedAt
    );
    return {
      schemaVersion: SCHEMA_VERSION,
      evaluationResultId,
      evaluationRunId: run.evaluationRunId,
      scenarioContext: clone(current.scenarioContext),
      evaluationStatus: assessment.evaluationStatus,
      scoredCoverage: assessment.scoredCoverage,
      confidence: assessment.confidence,
      metricCount: assessment.metricCount,
      scoredMetricCount: assessment.scoredMetricCount,
      statusBar: {
        evaluationDate: run.evaluationDate,
        dataAsOf: run.sourceAudit.asOf,
        windBatchId: run.sourceAudit.windBatchId,
        windBatchStatus: run.sourceAudit.windBatchStatus,
        windBatchMissingReason: run.sourceAudit.windBatchMissingReason,
        eventReadAt: run.eventReadAt,
        formulaVersion: run.formulaVersion,
        parameterVersion: run.parameterVersion,
        scoredCoverage: assessment.scoredCoverage,
        confidence: assessment.confidence,
        evaluationStatus: assessment.evaluationStatus
      },
      sourceAudit: clone(run.sourceAudit),
      dataVersionId: run.sourceAudit.dataVersionId,
      ontologyVersionId: run.ontologyVersionId,
      formulaVersion: run.formulaVersion,
      parameterVersion: run.parameterVersion,
      domains,
      factualModuleOutputRefs,
      modelingOutputs: clone(current.modelingOutputs),
      updatedAt
    };
  }

  function makeModuleOutput(current, event, step, normalizedPayload, occurredAt, stageStatus, progressAdvanced, resultId) {
    const outputId = `S005-OUTPUT-${step.moduleId}-${stableToken({
      scenarioRunId: current.scenarioContext.scenarioRunId,
      eventType: event.eventType,
      sequence: current.moduleOutputs.length + 1,
      payload: normalizedPayload,
      occurredAt
    })}`;
    return {
      schemaVersion: SCHEMA_VERSION,
      outputSchemaVersion: MODULE_OUTPUT_SCHEMA_VERSION,
      outputId,
      outputKind: event.eventType,
      scenarioContext: clone(current.scenarioContext),
      evaluationRunId: current.evaluationRun ? current.evaluationRun.evaluationRunId : null,
      evaluationResultId: resultId,
      moduleId: step.moduleId,
      eventType: event.eventType,
      stageId: step.stageId,
      stageStatus,
      status: stageStatus,
      progressAdvanced,
      occurredAt,
      producedAt: occurredAt,
      evidenceRefs: clone(event.payload.evidenceRefs),
      missingReasons: clone(normalizedPayload.missingReasons || (normalizedPayload.missingReason ? [normalizedPayload.missingReason] : [])),
      boundary: {
        researchOnly: true,
        publishedArtifacts: [],
        factWriteAllowed: false,
        actionWriteAllowed: false,
        externalSideEffects: 0
      },
      payload: normalizedPayload,
      verification: {
        verifiable: true,
        payloadDigest: stableToken(normalizedPayload),
        evidenceRefs: clone(event.payload.evidenceRefs),
        previousOutputId: current.moduleOutputs.at(-1)?.outputId || null
      }
    };
  }

  function currentSnapshot(current) {
    return immutable({
      schemaVersion: SCHEMA_VERSION,
      scenarioContext: current.scenarioContext,
      stages: current.stages,
      progress: progressForStages(current.stages),
      expectedEvent: EVENT_FLOW[current.cursor] || null,
      evaluationRun: current.evaluationRun,
      evaluationResult: current.evaluationResult,
      moduleOutputs: current.moduleOutputs
    });
  }

  function createEngine(options) {
    const input = options || {};
    const restored = input.restoredState && typeof input.restoredState === "object" ? clone(input.restoredState) : null;
    if (restored && restored.schemaVersion !== SCHEMA_VERSION) throw new Error("unsupported restored evaluation state schemaVersion");
    const formulaVersion = nonEmptyString(input.formulaVersion || restored?.formulaVersion || FORMULA_VERSION, "formulaVersion");
    const parameterVersion = nonEmptyString(input.parameterVersion || restored?.parameterVersion || PARAMETER_VERSION, "parameterVersion");
    const updateS005Stage = typeof input.updateS005Stage === "function" ? input.updateS005Stage : function noOp() {};
    let current = restored ? clone(restored.current) : createInitialCurrent(input.scenarioContext);
    const history = restored && Array.isArray(restored.history) ? clone(restored.history) : [];
    if (!current || typeof current !== "object") throw new Error("restored evaluation state requires current state");
    adapter.assertScenarioContext(current.scenarioContext);
    if (input.scenarioContext) assertSameScenarioContext(input.scenarioContext, current.scenarioContext);
    if (!Number.isInteger(current.cursor) || current.cursor < 0 || current.cursor > EVENT_FLOW.length) throw new Error("restored evaluation cursor is invalid");
    if (!current.stages || !current.domains || !Array.isArray(current.moduleOutputs) || !Array.isArray(current.modelingOutputs)) {
      throw new Error("restored evaluation state is incomplete");
    }

    function applyStage(next, stageId, status, output, occurredAt, notify = true) {
      next.stages[stageId] = {
        ...next.stages[stageId],
        status,
        evidence: {
          moduleOutputId: output.outputId,
          moduleId: output.moduleId,
          eventType: output.eventType,
          evaluationRunId: output.evaluationRunId,
          evaluationResultId: output.evaluationResultId,
          scenarioRunId: output.scenarioContext.scenarioRunId
        },
        updatedAt: occurredAt
      };
      if (notify) updateS005Stage(stageId, status, clone(next.stages[stageId].evidence), clone(next.scenarioContext));
    }

    function recordUnavailable(event, occurredAt, refs) {
      const expected = EVENT_FLOW[current.cursor];
      if (!expected || expected.eventType !== EVENT_TYPES.MODEL_RESULT_DELIVERED || event.moduleId !== "M08") {
        throw new Error("SERIES_INPUT_UNAVAILABLE is only valid while the M08 candidate result is expected");
      }
      const next = clone(current);
      const normalizedPayload = {
        reasonCode: "SERIES_INPUT_UNAVAILABLE",
        missingReason: nonEmptyString(event.payload.missingReason, "M08 missingReason"),
        missingReasons: missingReasons(event.payload.missingReasons || event.payload.missingReason, "M08 missingReasons"),
        consumerResultRef: requireCurrentResultRef(event.payload, current, "M08"),
        truthClass: "candidate",
        replacesFact: false,
        evidenceRefs: refs
      };
      const output = makeModuleOutput(next, event, expected, normalizedPayload, occurredAt, "blocked", false, null);
      next.moduleOutputs.push(output);
      applyStage(next, expected.stageId, "blocked", output, occurredAt, false);
      next.evaluationResult = buildEvaluationResult(next, occurredAt);
      if (next.evaluationRun && next.evaluationResult) next.evaluationRun.evaluationStatus = next.evaluationResult.evaluationStatus;
      output.evaluationResultId = next.evaluationResult?.evaluationResultId || null;
      next.stages[expected.stageId].evidence.evaluationResultId = output.evaluationResultId;
      updateS005Stage(expected.stageId, "blocked", clone(next.stages[expected.stageId].evidence), clone(next.scenarioContext));
      current = next;
      return immutable(output);
    }

    function recordModuleEvent(event) {
      if (!event || typeof event !== "object" || Array.isArray(event)) throw new Error("module event must be an object");
      assertSameScenarioContext(event.scenarioContext, current.scenarioContext);
      const occurredAt = isoTimestamp(event.occurredAt, "occurredAt");
      const payload = event.payload && typeof event.payload === "object" && !Array.isArray(event.payload) ? clone(event.payload) : {};
      const refs = evidenceRefs(payload.evidenceRefs, `${event.moduleId || "module"}.evidenceRefs`);
      const eventMissingReasons = missingReasons(payload.missingReasons || payload.missingReason, `${event.moduleId || "module"}.missingReasons`);
      payload.evidenceRefs = refs;

      if (event.eventType === EVENT_TYPES.SERIES_INPUT_UNAVAILABLE) return recordUnavailable({ ...event, payload }, occurredAt, refs);

      const expected = EVENT_FLOW[current.cursor];
      if (!expected) throw new Error("all S005 actual module events have already been recorded");
      if (event.moduleId !== expected.moduleId || event.eventType !== expected.eventType) {
        throw new Error(`expected ${expected.moduleId} ${expected.eventType}; route, query, registration and completeAll events do not advance S005`);
      }
      if (![EVENT_TYPES.SOURCE_DELIVERED, EVENT_TYPES.SEMANTIC_DELIVERED].includes(expected.eventType) && !current.evaluationRun) {
        throw new Error("M01 must create the evaluation run before downstream module events");
      }
      if (payload.metricUpdates && expected.moduleId !== "M01") throw new Error(`${expected.moduleId} is a read-only evaluation consumer and cannot submit metricUpdates`);

      const validatedPayload = validateEventPayload(expected, payload, refs, occurredAt, current, history);
      const next = clone(current);
      if (expected.eventType === EVENT_TYPES.SOURCE_DELIVERED) {
        next.sourceDelivery = clone(validatedPayload);
      }
      if (expected.eventType === EVENT_TYPES.SEMANTIC_DELIVERED) {
        if (!next.sourceDelivery) throw new Error("M01 requires the verified M02 source delivery");
        next.evaluationRun = createEvaluationRun(next, next.sourceDelivery, occurredAt, formulaVersion, parameterVersion);
        next.evaluationRun.ontologyVersionId = validatedPayload.ontologyVersionId;
        next.evaluationRun.windFundType = validatedPayload.windFundType;
        next.evaluationRun.windFundTypeStatus = validatedPayload.windFundTypeStatus;
        next.evaluationRun.windFundTypeMissingReason = validatedPayload.windFundTypeMissingReason;
      }
      next.domains = applyMetricUpdates(next.domains, payload.metricUpdates, refs);
      const normalizedMetricUpdates = appliedMetricUpdates(next.domains, payload.metricUpdates);
      const normalizedPayload = {
        ...validatedPayload,
        missingReasons: eventMissingReasons,
        ...(normalizedMetricUpdates ? { metricUpdates: normalizedMetricUpdates } : {})
      };
      next.cursor += 1;

      if (event.moduleId === "M08") {
        next.modelingOutputs.push({
          outputRef: normalizedPayload.outputRef,
          resultKind: normalizedPayload.resultKind,
          resultStatus: normalizedPayload.resultStatus,
          truthClass: "candidate",
          replacesFact: false,
          fixtureId: normalizedPayload.fixtureId,
          inputClassification: normalizedPayload.inputClassification,
          containsSourceBusinessValues: false,
          factWriteAllowed: false,
          actionWriteAllowed: false,
          sideEffectsEmitted: 0,
          evidenceRefs: refs,
          inputMode: normalizedPayload.inputMode,
          objectiveId: normalizedPayload.objectiveId,
          objectiveRevisionId: normalizedPayload.objectiveRevisionId,
          bindingRevisionId: normalizedPayload.bindingRevisionId,
          releaseId: normalizedPayload.releaseId,
          modelVersionId: normalizedPayload.modelVersionId,
          objectRef: clone(normalizedPayload.objectRef),
          lensRef: clone(normalizedPayload.lensRef),
          seriesRef: clone(normalizedPayload.seriesRef),
          timeRange: clone(normalizedPayload.timeRange),
          dataVersionId: normalizedPayload.dataVersionId,
          ontologyVersionId: normalizedPayload.ontologyVersionId,
          bindingId: normalizedPayload.bindingId
        });
      }
      if (event.moduleId === "M06") {
        next.evaluationRun.status = "completed_with_partial_evaluation";
        next.evaluationRun.completedAt = occurredAt;
      }

      const output = makeModuleOutput(next, { ...event, payload }, expected, normalizedPayload, occurredAt, expected.stageStatus, true, null);
      next.moduleOutputs.push(output);
      applyStage(next, expected.stageId, expected.stageStatus, output, occurredAt, false);
      next.evaluationResult = buildEvaluationResult(next, occurredAt);
      if (next.evaluationRun && next.evaluationResult) next.evaluationRun.evaluationStatus = next.evaluationResult.evaluationStatus;
      output.evaluationResultId = next.evaluationResult?.evaluationResultId || null;
      next.stages[expected.stageId].evidence.evaluationResultId = output.evaluationResultId;
      updateS005Stage(expected.stageId, expected.stageStatus, clone(next.stages[expected.stageId].evidence), clone(next.scenarioContext));
      current = next;
      return immutable(output);
    }

    function findRunSnapshot(scenarioRunId) {
      if (current.scenarioContext.scenarioRunId === scenarioRunId) return currentSnapshot(current);
      const found = history.find((entry) => entry.scenarioContext.scenarioRunId === scenarioRunId);
      return found ? immutable(found) : null;
    }

    function resetForNewScenarioRun(nextScenarioContext) {
      const checked = adapter.assertScenarioContext(nextScenarioContext);
      if (checked.scenarioRunId === current.scenarioContext.scenarioRunId) throw new Error("new S005 scenarioRunId must differ from the current run");
      if (Date.parse(checked.formedAt) <= Date.parse(current.scenarioContext.formedAt)) throw new Error("new S005 formedAt must be later than the current run");
      const archived = currentSnapshot(current);
      history.push(clone(archived));
      const previousScenarioRunId = current.scenarioContext.scenarioRunId;
      current = createInitialCurrent(checked);
      return immutable({
        scope: "current S005 scenario run only",
        previousScenarioRunId,
        scenarioRunId: checked.scenarioRunId,
        progress: progressForStages(current.stages),
        evaluationRun: null,
        evaluationResult: null,
        preservedHistoricalRuns: history.length,
        externalSideEffects: 0
      });
    }

    function serialize() {
      return immutable({
        schemaVersion: SCHEMA_VERSION,
        formulaVersion,
        parameterVersion,
        current: clone(current),
        history: clone(history)
      });
    }

    return Object.freeze({
      recordModuleEvent,
      getState: () => currentSnapshot(current),
      getCurrentEvaluationRun: () => immutable(current.evaluationRun),
      getCurrentEvaluationResult: () => immutable(current.evaluationResult),
      getEvaluationRun: (scenarioRunId) => findRunSnapshot(scenarioRunId)?.evaluationRun || null,
      getEvaluationResult: (scenarioRunId) => findRunSnapshot(scenarioRunId)?.evaluationResult || null,
      getModuleOutputs: () => immutable(current.moduleOutputs),
      getHistory: () => immutable(history),
      resetForNewScenarioRun,
      startNewScenarioRun: resetForNewScenarioRun,
      serialize
    });
  }

  function eventTypeForOperation(operation) {
    return OPERATION_EVENT_TYPES[operation] || EVENT_TYPES[operation] || (Object.values(EVENT_TYPES).includes(operation) ? operation : null);
  }

  function normalizePureEvent(event) {
    if (!event || typeof event !== "object" || Array.isArray(event)) throw new Error("module event must be an object");
    const eventType = event.eventType || eventTypeForOperation(event.operation) || event.operation;
    return { ...clone(event), eventType };
  }

  function createEvaluationState(scenarioContext, options) {
    return clone(createEngine({ scenarioContext, ...(options || {}) }).serialize());
  }

  function applyModuleEvent(evaluationState, event) {
    let stageUpdate = null;
    const engine = createEngine({
      restoredState: evaluationState,
      updateS005Stage(stageId, status, evidence, scenarioContext) {
        stageUpdate = { stageId, status, evidence: clone(evidence), scenarioContext: clone(scenarioContext) };
      }
    });
    const moduleOutput = engine.recordModuleEvent(normalizePureEvent(event));
    return clone({ state: engine.serialize(), moduleOutput, stageUpdate });
  }

  function resetEvaluationState(previousState, nextScenarioContext) {
    const engine = createEngine({ restoredState: previousState });
    const receipt = engine.resetForNewScenarioRun(nextScenarioContext);
    return clone({ state: engine.serialize(), receipt });
  }

  function stateCurrent(evaluationState) {
    if (!evaluationState || evaluationState.schemaVersion !== SCHEMA_VERSION || !evaluationState.current) {
      throw new Error("valid S005 evaluation state is required");
    }
    return evaluationState.current;
  }

  function moduleProjection(evaluationState, moduleId) {
    const current = stateCurrent(evaluationState);
    nonEmptyString(moduleId, "moduleId");
    const stageIds = EVENT_FLOW.filter((step) => step.moduleId === moduleId).map((step) => step.stageId);
    return clone({
      schemaVersion: SCHEMA_VERSION,
      scenarioContext: current.scenarioContext,
      moduleId,
      evaluationRunId: current.evaluationRun?.evaluationRunId || null,
      evaluationResultId: current.evaluationResult?.evaluationResultId || null,
      sourceDelivery: current.sourceDelivery,
      progress: progressForStages(current.stages),
      stages: Object.fromEntries([...new Set(stageIds)].filter((stageId) => current.stages[stageId]).map((stageId) => [stageId, current.stages[stageId]])),
      outputs: current.moduleOutputs.filter((output) => output.moduleId === moduleId),
      evaluationResult: current.evaluationResult,
      expectedEvent: EVENT_FLOW[current.cursor] || null
    });
  }

  function dashboardProjection(evaluationState) {
    const current = stateCurrent(evaluationState);
    return clone({
      schemaVersion: SCHEMA_VERSION,
      scenarioContext: current.scenarioContext,
      evaluationRun: current.evaluationRun,
      evaluationResult: current.evaluationResult,
      sourceDelivery: current.sourceDelivery,
      statusBar: current.evaluationResult?.statusBar || null,
      domains: current.evaluationResult?.domains || null,
      stages: current.stages,
      progress: progressForStages(current.stages),
      moduleOutputRefs: current.moduleOutputs.map((output) => output.outputId),
      historyCount: Array.isArray(evaluationState.history) ? evaluationState.history.length : 0,
      expectedEvent: EVENT_FLOW[current.cursor] || null
    });
  }

  return Object.freeze({
    SCHEMA_VERSION,
    MODULE_OUTPUT_SCHEMA_VERSION,
    FORMULA_VERSION,
    PARAMETER_VERSION,
    EVENT_TYPES,
    OPERATIONS,
    OPERATION_EVENT_TYPES,
    eventTypeForOperation,
    EVENT_FLOW,
    SOURCE_AUDIT,
    METRIC_DEFINITIONS,
    createEngine,
    createEvaluationState,
    applyModuleEvent,
    resetEvaluationState,
    moduleProjection,
    dashboardProjection
  });
});
