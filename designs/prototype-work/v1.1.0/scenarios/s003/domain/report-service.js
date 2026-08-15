(function (root, factory) {
  "use strict";

  const foundation = typeof module === "object" && module.exports
    ? require("../../../foundation/ofw-scenario-foundation.js")
    : root && root.OFWScenarioFoundation;
  const api = factory(foundation);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.S003ReportService = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (foundation) {
  "use strict";

  const SERVICE_VERSION = "1.0.0";
  const CONTENT_SCHEMA_VERSION = "ofw.s003.m06.enterprise-report-content.v1";
  const DEFAULT_DELIVERY_VERSION = "1.1.0";
  const C035_SCHEMA_VERSION = "ofw.s003.c035.assessment-result.v1";
  const FACT_SCHEMA_VERSION = "ofw.s003.published-debt-risk-fact.v1";

  class S003ReportError extends Error {
    constructor(code, message, details) {
      super(message);
      this.name = "S003ReportError";
      this.code = code;
      this.details = details || null;
    }
  }

  function fail(code, message, details) {
    throw new S003ReportError(code, message, details);
  }

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function cloneJson(value, label) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      fail("S003_REPORT_INVALID_JSON", (label || "报告来源") + "必须可安全序列化为 JSON", {
        cause: error && error.message
      });
    }
  }

  function deepFreeze(value, seen) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    const visited = seen || new Set();
    if (visited.has(value)) return value;
    visited.add(value);
    Object.values(value).forEach(function (child) {
      deepFreeze(child, visited);
    });
    return Object.freeze(value);
  }

  function assertFoundation() {
    if (!foundation || typeof foundation.assertScenarioContext !== "function") {
      fail("S003_REPORT_FOUNDATION_UNAVAILABLE", "场景公共底座未加载，M06 已拒绝生成报告");
    }
    return foundation;
  }

  function assertReportContext(value) {
    let context;
    try {
      context = assertFoundation().assertScenarioContext(value);
    } catch (error) {
      fail("S003_REPORT_INVALID_SCENARIO_CONTEXT", "M06 报告必须携带合法场景三元身份", {
        causeCode: error && error.code,
        cause: error && error.message
      });
    }
    if (context.scenarioId !== "S003" || !String(context.scenarioVersion).startsWith("S003-v")) {
      fail("S003_REPORT_SCENARIO_MISMATCH", "债务风险报告只接受 S003 场景运行身份", {
        scenarioId: context.scenarioId,
        scenarioVersion: context.scenarioVersion
      });
    }
    if (context.status === "closed") {
      fail("S003_REPORT_CONTEXT_CLOSED", "已关闭的场景运行不能重新生成正式报告");
    }
    return context;
  }

  function tripleFrom(value) {
    return {
      scenarioId: value.scenarioId,
      scenarioVersion: value.scenarioVersion,
      scenarioRunId: value.scenarioRunId
    };
  }

  function assertIdentityMatch(expected, actual, path) {
    if (!isObject(actual)) {
      fail("S003_REPORT_MISSING_SCENARIO_IDENTITY", path + "缺少场景三元身份");
    }
    const expectedTriple = tripleFrom(expected);
    const mismatches = Object.keys(expectedTriple).filter(function (field) {
      return expectedTriple[field] !== actual[field];
    });
    if (mismatches.length) {
      fail("S003_REPORT_SCENARIO_MISMATCH", path + "与报告运行轮次不一致", {
        path: path,
        mismatches: mismatches,
        expected: expectedTriple,
        actual: tripleFrom(actual)
      });
    }
  }

  function statusToken(value) {
    return String(value || "").trim().toUpperCase();
  }

  function normalizeSourceEvidence(value) {
    const source = isObject(value) ? cloneJson(value, "来源证据") : {};
    return {
      c035Results: source.c035Results || {ref: "resources/m01/c035-risk-results.v1.json", sha256: null},
      publishedFacts: source.publishedFacts || {ref: "resources/m01/published-risk-facts.v1.json", sha256: null},
      publishedPointer: source.publishedPointer || {ref: "resources/m01/published-pointer.v1.json", sha256: null},
      reportContract: source.reportContract || {ref: "resources/m06/report-contract.v1.json", sha256: null},
      decisionResults: source.decisionResults || null
    };
  }

  function assertPublishedSources(context, input) {
    const c035 = cloneJson(input.c035Results, "C035 结果集");
    const facts = cloneJson(input.publishedFacts, "Published 风险事实");
    const pointer = cloneJson(input.publishedPointer, "Published 模型指针");
    const contract = cloneJson(input.reportContract, "M06 报告合同");
    const decision = input.decisionResults ? cloneJson(input.decisionResults, "M04 决策结果") : null;

    if (!isObject(c035) || statusToken(c035.status) !== "PUBLISHED-RESULTS" || c035.immutable !== true) {
      fail("S003_REPORT_SOURCE_NOT_PUBLISHED", "M06 只能消费不可变的 Published C035 结果集");
    }
    if (!isObject(facts) || statusToken(facts.status) !== "PUBLISHED" || facts.immutable !== true) {
      fail("S003_REPORT_SOURCE_NOT_PUBLISHED", "M06 只能消费不可变的 Published 风险事实");
    }
    if (!isObject(pointer) || statusToken(pointer.status) !== "ACTIVE" || pointer.immutable !== true) {
      fail("S003_REPORT_MODEL_NOT_PUBLISHED", "M06 只能使用活动的 Published 模型指针");
    }
    if (!isObject(pointer.activeTarget) || statusToken(pointer.activeTarget.lifecycleStatus) !== "PUBLISHED") {
      fail("S003_REPORT_MODEL_NOT_PUBLISHED", "Published 指针未指向正式模型包");
    }
    if (!isObject(contract) || contract.moduleId !== "M06" || contract.deepLinkRequired !== true) {
      fail("S003_REPORT_INVALID_CONTRACT", "M06 报告合同缺失或未启用精确深链");
    }

    assertIdentityMatch(context, c035.scenarioIdentity, "c035Results.scenarioIdentity");
    assertIdentityMatch(context, facts.scenarioIdentity, "publishedFacts.scenarioIdentity");
    assertIdentityMatch(context, pointer.scenarioIdentity, "publishedPointer.scenarioIdentity");
    if (decision) assertIdentityMatch(context, decision.scenarioIdentity, "decisionResults.scenarioIdentity");

    if (!Array.isArray(c035.results) || c035.results.length !== 21 || c035.enterpriseCount !== 21) {
      fail("S003_REPORT_INCOMPLETE_C035", "正式企业报告要求完整的 21 家企业 C035 结果", {
        enterpriseCount: c035.enterpriseCount,
        resultCount: Array.isArray(c035.results) ? c035.results.length : null
      });
    }
    if (!Array.isArray(facts.facts) || facts.facts.length !== c035.results.length) {
      fail("S003_REPORT_INCOMPLETE_FACTS", "Published 风险事实数量与 C035 结果不一致");
    }

    const factByResultId = new Map();
    const factIndexByResultId = new Map();
    facts.facts.forEach(function (fact, index) {
      if (!isObject(fact) || fact.schemaVersion !== FACT_SCHEMA_VERSION || !fact.sourceResultId) {
        fail("S003_REPORT_INVALID_FACT", "publishedFacts.facts[" + index + "] 不是合法风险事实");
      }
      assertIdentityMatch(context, fact.scenarioIdentity, "publishedFacts.facts[" + index + "].scenarioIdentity");
      if (factByResultId.has(fact.sourceResultId)) {
        fail("S003_REPORT_DUPLICATE_FACT", "同一 C035 结果存在重复 Published 风险事实", {
          sourceResultId: fact.sourceResultId
        });
      }
      factByResultId.set(fact.sourceResultId, fact);
      factIndexByResultId.set(fact.sourceResultId, index);
    });

    const resultByEnterpriseId = new Map();
    const resultIndexByEnterpriseId = new Map();
    c035.results.forEach(function (result, index) {
      if (!isObject(result) || result.schemaVersion !== C035_SCHEMA_VERSION || result.contractId !== "C035") {
        fail("S003_REPORT_INVALID_C035", "c035Results.results[" + index + "] 不是合法 C035 结果");
      }
      assertIdentityMatch(context, result.scenarioIdentity, "c035Results.results[" + index + "].scenarioIdentity");
      const enterpriseId = result.enterprise && result.enterprise.enterpriseId;
      if (!enterpriseId || resultByEnterpriseId.has(enterpriseId)) {
        fail("S003_REPORT_DUPLICATE_ENTERPRISE", "C035 结果缺少或重复 enterpriseId", {
          enterpriseId: enterpriseId
        });
      }
      if (!Array.isArray(result.indicatorResults) || result.indicatorResults.length !== 15) {
        fail("S003_REPORT_INCOMPLETE_INDICATORS", enterpriseId + " 未包含完整 15 项指标");
      }
      if (!Array.isArray(result.factorResults) || result.factorResults.length !== 6) {
        fail("S003_REPORT_INCOMPLETE_FACTORS", enterpriseId + " 未包含完整 6 项调节因子");
      }
      const fact = factByResultId.get(result.resultId);
      if (!fact || fact.subjectId !== enterpriseId) {
        fail("S003_REPORT_FACT_RESULT_MISMATCH", enterpriseId + " 缺少与 C035 对应的 Published 风险事实");
      }
      const object = fact.object || {};
      if (object.finalScore !== result.finalScore
          || object.riskTierId !== (result.riskTier && result.riskTier.tierId)
          || object.rawScore !== result.rawScore
          || object.factorSum !== result.factorSum) {
        fail("S003_REPORT_FACT_RESULT_MISMATCH", enterpriseId + " 的 Published Fact 与 C035 评分不一致");
      }
      if (!result.modelIdentity
          || result.modelIdentity.packageVersion !== pointer.activeTarget.packageVersion
          || statusToken(result.modelIdentity.lifecycleStatus) !== "PUBLISHED") {
        fail("S003_REPORT_MODEL_RESULT_MISMATCH", enterpriseId + " 的模型身份与 Published 指针不一致");
      }
      resultByEnterpriseId.set(enterpriseId, result);
      resultIndexByEnterpriseId.set(enterpriseId, index);
    });

    return {
      c035: c035,
      facts: facts,
      pointer: pointer,
      contract: contract,
      decision: decision,
      factByResultId: factByResultId,
      factIndexByResultId: factIndexByResultId,
      resultByEnterpriseId: resultByEnterpriseId,
      resultIndexByEnterpriseId: resultIndexByEnterpriseId
    };
  }

  function reportIdFor(context, enterpriseId) {
    return "S003-RPT-" + context.scenarioRunId + "-" + enterpriseId;
  }

  function buildDeepLink(context, prototypeVersion, enterpriseId, reportId) {
    const parameters = {
      scenarioId: "S003",
      scenarioVersion: context.scenarioVersion,
      scenarioRunId: context.scenarioRunId,
      prototypeVersion: prototypeVersion,
      enterpriseId: enterpriseId,
      reportId: reportId
    };
    const query = Object.keys(parameters).map(function (key) {
      return encodeURIComponent(key) + "=" + encodeURIComponent(parameters[key]);
    }).join("&");
    return {
      href: "./?" + query + "#report/" + encodeURIComponent(enterpriseId),
      parameters: parameters,
      exactScenarioRunBinding: true,
      historicalViewReadOnly: true
    };
  }

  function riskTierRule(riskTier) {
    if (!riskTier) return "风险分档缺失";
    const lower = riskTier.minInclusive;
    const upper = riskTier.maxExclusive;
    if (upper === null || upper === undefined) {
      return "综合得分大于等于 " + lower + " 分";
    }
    return "综合得分大于等于 " + lower + " 分且小于 " + upper + " 分";
  }

  function conclusionFor(result) {
    const tier = result.riskTier && result.riskTier.tierId;
    const prefix = result.enterprise.name + "本轮调整后综合得分为 " + result.finalScore
      + " 分，风险等级为" + result.riskTier.name + "。";
    const guidance = {
      GREEN: "当前总体风险可控，建议纳入常态监测并持续关注低分指标与负向调节因子。",
      YELLOW: "存在需跟踪的风险信号，应由集团债务风险管理人员人工确认是否推动通用负责人待办。",
      RED: "已形成较高风险信号，应优先人工确认处置候选，并沿用决策中心通用 Action Request 入口推动负责人待办。",
      BLACK: "已形成重大风险信号，应立即人工确认处置候选，并沿用决策中心通用能力推动负责人待办。"
    };
    const construction = result.isUnderConstruction
      ? "该企业属于在建企业，基础分按已裁决规则固定为 60 分后叠加调节因子。"
      : "";
    return prefix + (guidance[tier] || "请复核 Published 模型分档。") + construction;
  }

  function mapDecisionState(result, decisionResults) {
    const confirmations = decisionResults && Array.isArray(decisionResults.confirmations)
      ? decisionResults.confirmations
      : [];
    const confirmationByCandidate = new Map();
    confirmations.forEach(function (confirmation) {
      const action = confirmation && confirmation.actionRequest;
      if (action && action.candidateId) confirmationByCandidate.set(action.candidateId, confirmation);
    });
    return (result.dispositionCandidates || []).map(function (candidate) {
      const confirmation = confirmationByCandidate.get(candidate.candidateId);
      const action = confirmation && confirmation.actionRequest;
      const todo = confirmation && confirmation.todo;
      return {
        candidateId: candidate.candidateId,
        actionTypeId: candidate.actionTypeId,
        trigger: candidate.trigger,
        requiresHumanConfirmation: !confirmation,
        status: confirmation ? "CONFIRMED_TO_OWNER_TODO" : candidate.status,
        actionRequestId: action ? action.actionRequestId : null,
        todoId: todo ? todo.todoId : null,
        owner: action ? action.owner : null,
        confirmedAt: action ? action.confirmedAt : null,
        approvalRequired: false,
        multiLevelApproval: false,
        notificationSent: false
      };
    });
  }

  function buildRuleExplanations(result, pointer) {
    const model = pointer.activeTarget.publishedSnapshot || {};
    return [
      {
        ruleId: "S003-RULE-COMPOSITE-SCORE",
        title: "综合评分公式",
        statement: model.assessment && model.assessment.formula
          ? model.assessment.formula
          : "round(clamp(rawScore * (1 + factorSum), 0, 100), 2)",
        applied: true
      },
      {
        ruleId: "S003-RULE-UNDER-CONSTRUCTION-60",
        title: "在建企业基础分",
        statement: "在建企业原始基础分固定为 60 分，仍叠加适用调节因子。",
        applied: Boolean(result.isUnderConstruction)
      },
      {
        ruleId: "S003-RULE-PROFIT-HISTORY-A",
        title: "盈利历史不足",
        statement: "盈利历史不足时按 A 档计 100 分，并标记 HISTORY_INSUFFICIENT_DEFAULT_A。",
        applied: result.indicatorResults.some(function (indicator) {
          return indicator.marker === "HISTORY_INSUFFICIENT_DEFAULT_A";
        })
      },
      {
        ruleId: "S003-RULE-DEFAULTED-ZERO",
        title: "适用因子缺失",
        statement: "适用但缺失的企业因子套用零系数档并标记 DEFAULTED_ZERO，不得阻塞已裁决的最小化评估。",
        applied: result.factorResults.some(function (factor) {
          return factor.state === "DEFAULTED_ZERO";
        })
      },
      {
        ruleId: "S003-RULE-NOT-APPLICABLE",
        title: "业务不适用",
        statement: "业务条件不适用时标记 NOT_APPLICABLE，不得与缺失套零混淆。",
        applied: result.factorResults.some(function (factor) {
          return factor.state === "NOT_APPLICABLE";
        })
      },
      {
        ruleId: "S003-RULE-RISK-TIER",
        title: "风险分档",
        statement: result.riskTier.name + "：" + riskTierRule(result.riskTier) + "。",
        applied: true
      }
    ];
  }

  function buildReportContent(result, sources, context, options) {
    const fact = sources.factByResultId.get(result.resultId);
    const reportId = reportIdFor(context, result.enterprise.enterpriseId);
    const prototypeVersion = options.prototypeVersion;
    const decisionState = mapDecisionState(result, sources.decision);
    const sourceEvidence = options.sourceEvidence;
    const resultIndex = sources.resultIndexByEnterpriseId.get(result.enterprise.enterpriseId);
    const factIndex = sources.factIndexByResultId.get(result.resultId);
    const keyIndicators = (result.lowestThree || []).map(function (indicator) {
      const detailIndex = result.indicatorResults.findIndex(function (detail) {
        return detail.name === indicator.name;
      });
      return {
        name: indicator.name,
        actualValue: indicator.actualValue,
        score: indicator.score,
        weightPercent: indicator.weightPercent,
        weightedScore: indicator.weightedScore,
        status: indicator.status,
        marker: indicator.marker || null,
        note: indicator.note || null,
        evidencePointer: "resources/m01/c035-risk-results.v1.json#/results/"
          + resultIndex + "/indicatorResults/" + detailIndex
      };
    });

    return {
      schemaVersion: CONTENT_SCHEMA_VERSION,
      moduleId: "M06",
      moduleOwner: "报告中心",
      businessOwner: "财务公司",
      reportId: reportId,
      reportVersion: "1.0.0",
      contentVersion: "1.0.0",
      artifactVersion: "html-print-v1",
      status: "published-report",
      immutable: true,
      generatedAt: options.generatedAt,
      scenarioIdentity: context,
      deliveryIdentity: {
        scenarioId: "S003",
        scenarioVersion: context.scenarioVersion,
        scenarioRunId: context.scenarioRunId,
        prototypeVersion: prototypeVersion
      },
      deepLink: buildDeepLink(
        context,
        prototypeVersion,
        result.enterprise.enterpriseId,
        reportId
      ),
      enterprise: cloneJson(result.enterprise, "企业身份"),
      assessment: {
        assessmentAt: result.assessmentAt,
        currency: result.currency,
        amountUnit: result.amountUnit,
        rawScore: result.rawScore,
        factorSum: result.factorSum,
        compositeAdjustment: result.compositeAdjustment,
        finalScore: result.finalScore,
        riskTier: cloneJson(result.riskTier, "风险等级"),
        isUnderConstruction: Boolean(result.isUnderConstruction)
      },
      conclusion: conclusionFor(result),
      keyIndicators: keyIndicators,
      indicatorDetails: cloneJson(result.indicatorResults, "指标明细"),
      adjustmentFactors: cloneJson(result.factorResults, "调节因子明细"),
      factorStateSummary: result.factorResults.reduce(function (summary, factor) {
        summary[factor.state] = (summary[factor.state] || 0) + 1;
        return summary;
      }, {APPLIED: 0, DEFAULTED_ZERO: 0, NOT_APPLICABLE: 0}),
      semanticMarkers: cloneJson(result.markers || [], "语义标记"),
      ruleExplanations: buildRuleExplanations(result, sources.pointer),
      disposition: {
        candidateCount: decisionState.length,
        candidates: decisionState,
        humanConfirmationRequired: decisionState.some(function (candidate) {
          return candidate.requiresHumanConfirmation;
        }),
        usesGenericDecisionCenter: true,
        dedicatedDispositionPage: false,
        multiLevelApproval: false,
        multiUserPermissions: false
      },
      evidenceReferences: [
        {
          evidenceType: "C035_RESULT",
          evidenceId: result.resultId,
          evidenceVersion: result.resultVersion,
          ref: sourceEvidence.c035Results.ref,
          sha256: sourceEvidence.c035Results.sha256,
          jsonPointer: "#/results/" + resultIndex
        },
        {
          evidenceType: "PUBLISHED_RISK_FACT",
          evidenceId: fact.factId,
          evidenceVersion: fact.sourceResultVersion,
          ref: sourceEvidence.publishedFacts.ref,
          sha256: sourceEvidence.publishedFacts.sha256,
          jsonPointer: "#/facts/" + factIndex
        },
        {
          evidenceType: "PUBLISHED_MODEL_POINTER",
          evidenceId: sources.pointer.pointerId,
          evidenceVersion: sources.pointer.pointerVersion,
          ref: sourceEvidence.publishedPointer.ref,
          sha256: sourceEvidence.publishedPointer.sha256,
          packageVersion: sources.pointer.activeTarget.packageVersion
        },
        {
          evidenceType: "FORMAL_DATA_ASSET",
          evidenceId: sources.c035.inputIdentity.dataAssetId,
          evidenceVersion: sources.c035.inputIdentity.dataAssetVersion,
          ref: "resources/m02/formal-candidate-data-asset.v1.json"
        },
        {
          evidenceType: "HUMAN_INPUT_SNAPSHOT",
          evidenceId: sources.c035.inputIdentity.humanInputSnapshotId,
          evidenceVersion: sources.c035.inputIdentity.humanInputSnapshotVersion,
          ref: "resources/m02/human-input-snapshot.v1.json"
        },
        {
          evidenceType: "QUALITY_RESULT",
          evidenceId: sources.c035.inputIdentity.qualityResultId,
          evidenceVersion: null,
          ref: "resources/m02/quality-result.v1.json"
        },
        {
          evidenceType: "REPORT_CONTRACT",
          evidenceId: sources.contract.contractId,
          evidenceVersion: sources.contract.contractVersion,
          ref: sourceEvidence.reportContract.ref,
          sha256: sourceEvidence.reportContract.sha256
        }
      ].concat(sourceEvidence.decisionResults && sources.decision ? [{
        evidenceType: "DECISION_RESULT",
        evidenceId: sources.decision.resultSetId,
        evidenceVersion: sources.decision.resultSetVersion,
        ref: sourceEvidence.decisionResults.ref,
        sha256: sourceEvidence.decisionResults.sha256
      }] : []),
      generationPolicy: {
        sourceIsPublished: true,
        clientSideScoreRecalculation: false,
        createsActionRequest: false,
        createsTodo: false,
        sendsNotification: false,
        dedicatedAgentRequired: false,
        sameIdentityAcrossFormats: true
      }
    };
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderRows(items, columns) {
    return items.map(function (item) {
      return "<tr>" + columns.map(function (column) {
        return "<td>" + escapeHtml(column(item)) + "</td>";
      }).join("") + "</tr>";
    }).join("");
  }

  function renderReportHtml(report) {
    if (!isObject(report) || report.schemaVersion !== CONTENT_SCHEMA_VERSION) {
      fail("S003_REPORT_INVALID_CONTENT", "仅可渲染由 M06 报告服务生成的正式内容");
    }
    const factorRows = renderRows(report.adjustmentFactors, [
      function (factor) { return factor.name; },
      function (factor) { return factor.inputValue === null ? "—" : factor.inputValue; },
      function (factor) { return factor.tierLabel || "—"; },
      function (factor) { return factor.coefficient; },
      function (factor) { return factor.state; }
    ]);
    const indicatorRows = renderRows(report.indicatorDetails, [
      function (indicator) { return indicator.name; },
      function (indicator) { return indicator.actualValue === null ? "—" : indicator.actualValue; },
      function (indicator) { return indicator.weightPercent + "%"; },
      function (indicator) { return indicator.score; },
      function (indicator) { return indicator.weightedScore; },
      function (indicator) { return indicator.marker || indicator.status; }
    ]);
    const ruleItems = report.ruleExplanations.map(function (rule) {
      return "<li><strong>" + escapeHtml(rule.title) + "</strong><span>"
        + escapeHtml(rule.statement) + "</span><em>"
        + (rule.applied ? "本轮适用" : "本轮未触发") + "</em></li>";
    }).join("");
    const evidenceItems = report.evidenceReferences.map(function (evidence) {
      return "<li><strong>" + escapeHtml(evidence.evidenceType) + "</strong><code>"
        + escapeHtml(evidence.evidenceId) + "</code><span>"
        + escapeHtml(evidence.ref) + "</span></li>";
    }).join("");
    return [
      "<!doctype html>",
      "<html lang=\"zh-CN\"><head><meta charset=\"utf-8\">",
      "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">",
      "<meta name=\"scenarioId\" content=\"" + escapeHtml(report.deliveryIdentity.scenarioId) + "\">",
      "<meta name=\"scenarioVersion\" content=\"" + escapeHtml(report.deliveryIdentity.scenarioVersion) + "\">",
      "<meta name=\"scenarioRunId\" content=\"" + escapeHtml(report.deliveryIdentity.scenarioRunId) + "\">",
      "<meta name=\"prototypeVersion\" content=\"" + escapeHtml(report.deliveryIdentity.prototypeVersion) + "\">",
      "<title>" + escapeHtml(report.enterprise.name) + " 企业债务风险诊断报告</title>",
      "<style>body{font:14px/1.55 -apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;color:#1d2939;margin:32px}header{border-bottom:2px solid #12375b;padding-bottom:18px}h1{font-size:24px;margin:4px 0}.score{font-size:40px;color:#12375b}.tier{font-weight:700}section{margin:24px 0}table{border-collapse:collapse;width:100%}th,td{border:1px solid #d7dde5;padding:7px;text-align:left}th{background:#f3f6f9}li{margin:6px 0}code{display:block;font-size:11px;overflow-wrap:anywhere}@media print{body{margin:12mm}a{display:none}}</style>",
      "</head><body>",
      "<header><small>智财问策 · S003 债务风险监测</small><h1>"
        + escapeHtml(report.enterprise.name) + "</h1><p>"
        + escapeHtml(report.enterprise.enterpriseId) + " · "
        + escapeHtml(report.assessment.assessmentAt) + " · "
        + escapeHtml(report.assessment.currency) + " / "
        + escapeHtml(report.assessment.amountUnit) + "</p></header>",
      "<section><h2>总体风险评分与等级</h2><div class=\"score\">"
        + escapeHtml(report.assessment.finalScore) + "</div><p class=\"tier\">"
        + escapeHtml(report.assessment.riskTier.name) + "</p><p>"
        + escapeHtml(report.conclusion) + "</p></section>",
      "<section><h2>调节因子明细</h2><table><thead><tr><th>因子</th><th>取值</th><th>档位</th><th>系数</th><th>状态</th></tr></thead><tbody>"
        + factorRows + "</tbody></table></section>",
      "<section><h2>财务指标评分明细</h2><table><thead><tr><th>指标</th><th>实际值</th><th>权重</th><th>得分</th><th>加权分</th><th>状态</th></tr></thead><tbody>"
        + indicatorRows + "</tbody></table></section>",
      "<section><h2>规则说明</h2><ul>" + ruleItems + "</ul></section>",
      "<section><h2>证据引用</h2><ul>" + evidenceItems + "</ul></section>",
      "<footer><p>reportId: " + escapeHtml(report.reportId) + "</p><p>scenarioRunId: "
        + escapeHtml(report.scenarioIdentity.scenarioRunId) + "</p><a href=\""
        + escapeHtml(report.deepLink.href) + "\">返回场景工作台</a></footer>",
      "</body></html>\n"
    ].join("");
  }

  function createReportService(input) {
    if (!isObject(input)) fail("S003_REPORT_INVALID_INPUT", "创建 M06 报告服务需要普通对象参数");
    const context = assertReportContext(input.scenarioContext);
    const prototypeVersion = String(input.prototypeVersion || input.deliveryVersion || DEFAULT_DELIVERY_VERSION);
    if (prototypeVersion !== DEFAULT_DELIVERY_VERSION) {
      fail("S003_REPORT_DELIVERY_VERSION_MISMATCH", "S003 CP06 报告交付版本必须为 1.1.0", {
        prototypeVersion: prototypeVersion
      });
    }
    const generatedAt = String(input.generatedAt || context.formedAt || "");
    if (!generatedAt) fail("S003_REPORT_MISSING_GENERATED_AT", "正式报告必须记录生成时间");
    const sources = assertPublishedSources(context, input);
    const options = {
      prototypeVersion: prototypeVersion,
      generatedAt: generatedAt,
      sourceEvidence: normalizeSourceEvidence(input.sourceEvidence)
    };
    const reportCache = new Map();

    function getReport(enterpriseId) {
      const id = String(enterpriseId || "");
      if (!sources.resultByEnterpriseId.has(id)) {
        fail("S003_REPORT_ENTERPRISE_NOT_FOUND", "当前 Published 运行中不存在企业 " + id);
      }
      if (!reportCache.has(id)) {
        reportCache.set(id, deepFreeze(buildReportContent(
          sources.resultByEnterpriseId.get(id),
          sources,
          context,
          options
        )));
      }
      return reportCache.get(id);
    }

    function listReports() {
      return deepFreeze(Array.from(sources.resultByEnterpriseId.keys()).sort().map(getReport));
    }

    return deepFreeze({
      serviceVersion: SERVICE_VERSION,
      moduleId: "M06",
      readOnly: true,
      scenarioIdentity: context,
      prototypeVersion: prototypeVersion,
      getReport: getReport,
      listReports: listReports,
      renderHtml: function (enterpriseId) {
        return renderReportHtml(getReport(enterpriseId));
      }
    });
  }

  return Object.freeze({
    SERVICE_VERSION: SERVICE_VERSION,
    CONTENT_SCHEMA_VERSION: CONTENT_SCHEMA_VERSION,
    DEFAULT_DELIVERY_VERSION: DEFAULT_DELIVERY_VERSION,
    S003ReportError: S003ReportError,
    createReportService: createReportService,
    renderReportHtml: renderReportHtml
  });
});
