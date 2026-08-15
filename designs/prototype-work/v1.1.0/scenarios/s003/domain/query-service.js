(function (root, factory) {
  "use strict";

  const foundation = typeof module === "object" && module.exports
    ? require("../../../foundation/ofw-scenario-foundation.js")
    : root && root.OFWScenarioFoundation;
  const api = factory(foundation);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.S003QueryService = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (foundation) {
  "use strict";

  const SERVICE_VERSION = "1.0.0";
  const QUERY_RESULT_SCHEMA_VERSION = "ofw.s003.m03.query-result.v1";
  const C035_SCHEMA_VERSION = "ofw.s003.c035.assessment-result.v1";
  const PUBLISHED_FACT_SCHEMA_VERSION = "ofw.s003.published-debt-risk-fact.v1";
  const RISK_TIER_IDS = Object.freeze(["GREEN", "YELLOW", "RED", "BLACK"]);

  const QUERY_IDS = Object.freeze({
    RISK_DISTRIBUTION: "S003-QRY-001",
    RED_BLACK_ENTERPRISES: "S003-QRY-002",
    ENTERPRISE_DETAIL: "S003-QRY-003",
    LOWEST_THREE: "S003-QRY-004",
    FACTOR_DEFAULTS: "S003-QRY-005",
    DISPOSITION_CANDIDATES: "S003-QRY-006"
  });

  const QUERY_DEFINITIONS = Object.freeze([
    Object.freeze({
      queryId: QUERY_IDS.RISK_DISTRIBUTION,
      question: "当前集团各风险等级有多少家企业？",
      resultShape: "risk-tier-distribution"
    }),
    Object.freeze({
      queryId: QUERY_IDS.RED_BLACK_ENTERPRISES,
      question: "哪些企业处于红灯或黑灯？",
      resultShape: "enterprise-list"
    }),
    Object.freeze({
      queryId: QUERY_IDS.ENTERPRISE_DETAIL,
      question: "指定企业本轮债务风险评估详情是什么？",
      resultShape: "enterprise-detail",
      requiresEnterpriseId: true
    }),
    Object.freeze({
      queryId: QUERY_IDS.LOWEST_THREE,
      question: "指定企业本轮评分最低的三项指标是什么？",
      resultShape: "lowest-three-indicators",
      requiresEnterpriseId: true
    }),
    Object.freeze({
      queryId: QUERY_IDS.FACTOR_DEFAULTS,
      question: "哪些企业因子采用了缺失套零或不适用语义？",
      resultShape: "factor-default-and-not-applicable"
    }),
    Object.freeze({
      queryId: QUERY_IDS.DISPOSITION_CANDIDATES,
      question: "当前有哪些待人工确认的风险处置候选？",
      resultShape: "disposition-candidate-list"
    })
  ]);

  const QUERY_BY_ID = Object.freeze(Object.fromEntries(
    QUERY_DEFINITIONS.map((definition) => [definition.queryId, definition])
  ));
  const QUERY_ALIASES = Object.freeze({
    "risk-distribution": QUERY_IDS.RISK_DISTRIBUTION,
    "red-black-enterprises": QUERY_IDS.RED_BLACK_ENTERPRISES,
    "enterprise-detail": QUERY_IDS.ENTERPRISE_DETAIL,
    "lowest-three": QUERY_IDS.LOWEST_THREE,
    "factor-defaults": QUERY_IDS.FACTOR_DEFAULTS,
    "disposition-candidates": QUERY_IDS.DISPOSITION_CANDIDATES
  });

  class S003QueryError extends Error {
    constructor(code, message, details) {
      super(message);
      this.name = "S003QueryError";
      this.code = code;
      this.details = details || null;
    }
  }

  function fail(code, message, details) {
    throw new S003QueryError(code, message, details);
  }

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function cloneJson(value, label) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      fail("S003_QUERY_INVALID_JSON", `${label || "查询来源"}必须可安全序列化为 JSON`, {
        cause: error && error.message
      });
    }
  }

  function deepFreeze(value, seen) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    const visited = seen || new Set();
    if (visited.has(value)) return value;
    visited.add(value);
    Object.values(value).forEach((child) => deepFreeze(child, visited));
    return Object.freeze(value);
  }

  function assertFoundation() {
    if (!foundation || typeof foundation.assertScenarioContext !== "function") {
      fail("S003_QUERY_FOUNDATION_UNAVAILABLE", "场景公共底座未加载，M03 已拒绝读取");
    }
    return foundation;
  }

  function assertQueryContext(value) {
    let context;
    try {
      context = assertFoundation().assertScenarioContext(value);
    } catch (error) {
      fail("S003_QUERY_INVALID_SCENARIO_CONTEXT", "M03 查询必须携带合法的场景三元身份", {
        causeCode: error && error.code,
        cause: error && error.message
      });
    }
    if (context.scenarioId !== "S003" || !String(context.scenarioVersion).startsWith("S003-v")) {
      fail("S003_QUERY_SCENARIO_MISMATCH", "M03 债务风险查询只接受 S003 场景身份", {
        scenarioId: context.scenarioId,
        scenarioVersion: context.scenarioVersion
      });
    }
    if (context.status === "closed") {
      fail("S003_QUERY_CONTEXT_CLOSED", "已关闭运行轮次不可继续发起查询");
    }
    return context;
  }

  function tripleFrom(context) {
    return {
      scenarioId: context.scenarioId,
      scenarioVersion: context.scenarioVersion,
      scenarioRunId: context.scenarioRunId
    };
  }

  function assertIdentityMatch(context, identity, path) {
    if (!isObject(identity)) {
      fail("S003_QUERY_MISSING_SCENARIO_IDENTITY", `${path}缺少场景三元身份`);
    }
    const expected = tripleFrom(context);
    const mismatches = Object.keys(expected).filter((field) => identity[field] !== expected[field]);
    if (mismatches.length) {
      fail("S003_QUERY_SCENARIO_MISMATCH", `${path}与当前查询运行轮次不一致`, {
        path,
        mismatches,
        expected,
        actual: {
          scenarioId: identity.scenarioId,
          scenarioVersion: identity.scenarioVersion,
          scenarioRunId: identity.scenarioRunId
        }
      });
    }
  }

  function publicationToken(value) {
    return String(value || "").trim().toUpperCase();
  }

  function assertPublishedSource(source, portfolio) {
    const explicitStatus = publicationToken(
      source.publicationStatus
      || source.lifecycleStatus
      || portfolio.publicationStatus
      || portfolio.lifecycleStatus
    );
    if (explicitStatus && explicitStatus !== "PUBLISHED") {
      fail("S003_QUERY_SOURCE_NOT_PUBLISHED", "M03 只能消费 Published 风险事实，Draft 或仅校验版本不可查询", {
        lifecycleStatus: explicitStatus
      });
    }
    const portfolioStatus = publicationToken(portfolio.status);
    if (portfolioStatus && !["SUCCEEDED", "PUBLISHED"].includes(portfolioStatus)) {
      fail("S003_QUERY_SOURCE_NOT_PUBLISHED", "风险评估组合尚未成功形成 Published 事实", {
        portfolioStatus
      });
    }
  }

  function normalizeSource(input, context) {
    if (!isObject(input)) fail("S003_QUERY_INVALID_SOURCE", "创建 M03 查询服务需要普通对象输入");
    const source = cloneJson(input, "M03 查询来源");
    const portfolio = isObject(source.portfolio)
      ? source.portfolio
      : isObject(source.source)
        ? source.source
        : source;
    assertPublishedSource(source, portfolio);

    const c035Container = isObject(source.c035Results)
      ? source.c035Results
      : isObject(source.c035ResultSet)
        ? source.c035ResultSet
        : portfolio;
    const factContainer = isObject(source.publishedFacts)
      ? source.publishedFacts
      : isObject(source.publishedFactSet)
        ? source.publishedFactSet
        : portfolio;
    const results = Array.isArray(source.c035Results)
      ? source.c035Results
      : Array.isArray(c035Container.results)
        ? c035Container.results
      : Array.isArray(portfolio.results)
        ? portfolio.results
        : [];
    const facts = Array.isArray(source.publishedFacts)
      ? source.publishedFacts
      : Array.isArray(factContainer.facts)
        ? factContainer.facts
      : Array.isArray(portfolio.publishedFacts)
        ? portfolio.publishedFacts
        : [];

    if (!results.length || !facts.length) {
      fail("S003_QUERY_SOURCE_EMPTY", "M03 查询必须同时获得 C035 结果和 Published 风险事实", {
        c035ResultCount: results.length,
        publishedFactCount: facts.length
      });
    }
    if (portfolio.scenarioIdentity) assertIdentityMatch(context, portfolio.scenarioIdentity, "portfolio.scenarioIdentity");
    if (c035Container !== portfolio && c035Container.scenarioIdentity) {
      assertIdentityMatch(context, c035Container.scenarioIdentity, "c035ResultSet.scenarioIdentity");
    }
    if (factContainer !== portfolio && factContainer.scenarioIdentity) {
      assertIdentityMatch(context, factContainer.scenarioIdentity, "publishedFactSet.scenarioIdentity");
    }
    const c035SetStatus = publicationToken(c035Container.status);
    if (c035SetStatus && !["SUCCEEDED", "PUBLISHED", "PUBLISHED-RESULTS"].includes(c035SetStatus)) {
      fail("S003_QUERY_SOURCE_NOT_PUBLISHED", "C035 结果集尚未形成可消费的 Published 版本", {
        status: c035Container.status
      });
    }
    const factSetStatus = publicationToken(factContainer.status);
    if (factSetStatus && !["SUCCEEDED", "PUBLISHED"].includes(factSetStatus)) {
      fail("S003_QUERY_SOURCE_NOT_PUBLISHED", "风险事实集尚未 Published", {
        status: factContainer.status
      });
    }

    const resultById = new Map();
    const resultByEnterpriseId = new Map();
    results.forEach((result, index) => {
      const path = `c035Results[${index}]`;
      if (!isObject(result) || result.schemaVersion !== C035_SCHEMA_VERSION || result.contractId !== "C035") {
        fail("S003_QUERY_INVALID_C035", `${path}不是合法 C035 评估结果`);
      }
      if (!result.resultId || resultById.has(result.resultId)) {
        fail("S003_QUERY_INVALID_C035", `${path}.resultId 必须非空且唯一`, {resultId: result.resultId || null});
      }
      if (publicationToken(result.status) !== "SUCCEEDED") {
        fail("S003_QUERY_INVALID_C035", `${path}尚未成功完成评估`, {status: result.status || null});
      }
      if (publicationToken(result.modelIdentity && result.modelIdentity.lifecycleStatus) !== "PUBLISHED") {
        fail("S003_QUERY_SOURCE_NOT_PUBLISHED", `${path}引用的模型不是 Published 版本`, {
          lifecycleStatus: result.modelIdentity && result.modelIdentity.lifecycleStatus
        });
      }
      assertIdentityMatch(context, result.scenarioIdentity, `${path}.scenarioIdentity`);
      const enterpriseId = String(result.enterprise && result.enterprise.enterpriseId || "").trim();
      if (!enterpriseId || resultByEnterpriseId.has(enterpriseId)) {
        fail("S003_QUERY_INVALID_C035", `${path}企业稳定 ID 必须非空且唯一`, {enterpriseId});
      }
      if (!Number.isFinite(result.finalScore) || result.finalScore < 0 || result.finalScore > 100) {
        fail("S003_QUERY_INVALID_C035", `${path}.finalScore 必须是 0—100 的有限数值`);
      }
      if (!result.riskTier || !RISK_TIER_IDS.includes(result.riskTier.tierId)) {
        fail("S003_QUERY_INVALID_C035", `${path}.riskTier 不是固定四档风险等级`);
      }
      for (const candidate of result.dispositionCandidates || []) {
        if (
          candidate.autoCreateActionRequest === true
          || candidate.autoCreateTodo === true
          || candidate.actionRequestId != null
          || candidate.todoId != null
        ) {
          fail("S003_QUERY_SIDE_EFFECT_SOURCE", `${path}混入了已创建 Action Request 或待办的状态`);
        }
      }
      resultById.set(result.resultId, result);
      resultByEnterpriseId.set(enterpriseId, result);
    });

    const factByResultId = new Map();
    facts.forEach((fact, index) => {
      const path = `publishedFacts[${index}]`;
      if (!isObject(fact) || fact.schemaVersion !== PUBLISHED_FACT_SCHEMA_VERSION || fact.predicate !== "debtRiskAssessment") {
        fail("S003_QUERY_INVALID_PUBLISHED_FACT", `${path}不是债务风险 Published 事实`);
      }
      assertIdentityMatch(context, fact.scenarioIdentity, `${path}.scenarioIdentity`);
      const result = resultById.get(fact.sourceResultId);
      if (!result) {
        fail("S003_QUERY_ORPHAN_PUBLISHED_FACT", `${path}无法关联到同轮次 C035 结果`, {
          sourceResultId: fact.sourceResultId || null
        });
      }
      if (factByResultId.has(fact.sourceResultId)) {
        fail("S003_QUERY_DUPLICATE_PUBLISHED_FACT", `${path}与同一 C035 结果重复绑定`);
      }
      const enterpriseId = result.enterprise.enterpriseId;
      if (fact.subjectId !== enterpriseId) {
        fail("S003_QUERY_FACT_MISMATCH", `${path}.subjectId 与 C035 企业不一致`);
      }
      const object = fact.object || {};
      if (
        object.finalScore !== result.finalScore
        || object.riskTierId !== result.riskTier.tierId
        || object.riskTierName !== result.riskTier.name
        || fact.sourceResultVersion !== result.resultVersion
      ) {
        fail("S003_QUERY_FACT_MISMATCH", `${path}与 C035 权威结果内容不一致`, {
          sourceResultId: fact.sourceResultId
        });
      }
      factByResultId.set(fact.sourceResultId, fact);
    });

    const missingFacts = results.filter((result) => !factByResultId.has(result.resultId));
    if (missingFacts.length) {
      fail("S003_QUERY_MISSING_PUBLISHED_FACT", "部分 C035 结果尚未形成 Published 风险事实", {
        resultIds: missingFacts.map((result) => result.resultId)
      });
    }

    return deepFreeze({
      results,
      facts,
      resultByEnterpriseId,
      sourceMeta: {
        c035ResultCount: results.length,
        publishedFactCount: facts.length,
        resultVersions: [...new Set(results.map((result) => result.resultVersion))].sort(),
        modelVersions: [...new Set(results.map((result) => result.modelIdentity.publishedVersion))].sort()
      }
    });
  }

  function enterpriseSummary(result) {
    return {
      enterpriseId: result.enterprise.enterpriseId,
      enterpriseName: result.enterprise.name,
      sector: result.enterprise.sector || null,
      category: result.enterprise.category || null,
      assessmentAt: result.assessmentAt,
      finalScore: result.finalScore,
      riskTier: cloneJson(result.riskTier),
      resultId: result.resultId,
      resultVersion: result.resultVersion
    };
  }

  function resolveEnterpriseId(parameters) {
    return String(parameters && (parameters.enterpriseId || parameters.subjectId) || "").trim();
  }

  function requireEnterprise(source, parameters) {
    const enterpriseId = resolveEnterpriseId(parameters);
    if (!enterpriseId) {
      fail("S003_QUERY_ENTERPRISE_REQUIRED", "该固定问题必须提供 enterpriseId");
    }
    const result = source.resultByEnterpriseId.get(enterpriseId);
    if (!result) {
      fail("S003_QUERY_ENTERPRISE_NOT_FOUND", "当前 Published 运行中不存在该企业", {enterpriseId});
    }
    return result;
  }

  function queryRiskDistribution(source) {
    const counts = Object.fromEntries(RISK_TIER_IDS.map((tierId) => [tierId, 0]));
    const names = {};
    source.results.forEach((result) => {
      counts[result.riskTier.tierId] += 1;
      names[result.riskTier.tierId] = result.riskTier.name;
    });
    const total = source.results.length;
    return {
      type: "risk-tier-distribution",
      total,
      averageFinalScore: total
        ? Math.round((source.results.reduce((sum, result) => sum + result.finalScore, 0) / total) * 100) / 100
        : null,
      counts,
      tiers: RISK_TIER_IDS.map((tierId) => ({
        tierId,
        name: names[tierId] || tierId,
        count: counts[tierId]
      }))
    };
  }

  function queryRedBlackEnterprises(source) {
    const priority = {BLACK: 0, RED: 1};
    const enterprises = source.results
      .filter((result) => ["RED", "BLACK"].includes(result.riskTier.tierId))
      .slice()
      .sort((left, right) => (
        priority[left.riskTier.tierId] - priority[right.riskTier.tierId]
        || left.finalScore - right.finalScore
        || left.enterprise.enterpriseId.localeCompare(right.enterprise.enterpriseId)
      ))
      .map(enterpriseSummary);
    return {type: "enterprise-list", count: enterprises.length, enterprises};
  }

  function queryEnterpriseDetail(source, parameters) {
    const result = requireEnterprise(source, parameters);
    return {
      type: "enterprise-detail",
      ...enterpriseSummary(result),
      rawScore: result.rawScore,
      factorSum: result.factorSum,
      compositeAdjustment: result.compositeAdjustment,
      modelIdentity: cloneJson(result.modelIdentity),
      dataIdentity: cloneJson(result.dataIdentity),
      indicators: cloneJson(result.indicatorResults || []),
      factors: cloneJson(result.factorResults || []),
      defaultSemantics: cloneJson(result.defaultSemantics || []),
      keyRisks: cloneJson(result.keyRisks || []),
      dispositionCandidates: cloneJson(result.dispositionCandidates || [])
    };
  }

  function queryLowestThree(source, parameters) {
    const result = requireEnterprise(source, parameters);
    const lowest = (result.keyRisks && result.keyRisks.length
      ? result.keyRisks
      : (result.indicatorResults || [])
        .filter((indicator) => indicator.status === "EVALUATED")
        .slice()
        .sort((left, right) => left.score - right.score || left.name.localeCompare(right.name, "zh-CN"))
        .slice(0, 3)
        .map((indicator) => ({
          indicatorId: indicator.indicatorId,
          name: indicator.name,
          score: indicator.score
        })))
      .slice(0, 3);
    return {
      type: "lowest-three-indicators",
      enterprise: enterpriseSummary(result),
      count: lowest.length,
      indicators: cloneJson(lowest),
      note: result.isUnderConstruction
        ? "在建企业基础分固定为60分，财务指标不参与加权，因此没有最低三项。"
        : null
    };
  }

  function queryFactorDefaults(source, parameters) {
    const enterpriseId = resolveEnterpriseId(parameters);
    const results = enterpriseId ? [requireEnterprise(source, {enterpriseId})] : source.results;
    const records = [];
    const counts = {DEFAULTED_ZERO: 0, NOT_APPLICABLE: 0};
    results.forEach((result) => {
      const factors = (result.factorResults || [])
        .filter((factor) => ["DEFAULTED_ZERO", "NOT_APPLICABLE"].includes(factor.state || factor.marker))
        .map((factor) => {
          const state = factor.state || factor.marker;
          counts[state] += 1;
          return {
            factorId: factor.factorId,
            name: factor.name,
            state,
            marker: factor.marker || state,
            coefficient: factor.coefficient,
            note: factor.note || null
          };
        });
      if (factors.length) records.push({enterprise: enterpriseSummary(result), factors});
    });
    return {
      type: "factor-default-and-not-applicable",
      enterpriseCount: records.length,
      counts,
      records
    };
  }

  function queryDispositionCandidates(source, parameters) {
    const enterpriseId = resolveEnterpriseId(parameters);
    const results = enterpriseId ? [requireEnterprise(source, {enterpriseId})] : source.results;
    const candidates = results.flatMap((result) => (result.dispositionCandidates || []).map((candidate) => ({
      enterprise: enterpriseSummary(result),
      candidateId: candidate.candidateId,
      actionTypeId: candidate.actionTypeId,
      status: candidate.status,
      trigger: cloneJson(candidate.trigger),
      idempotencyKey: candidate.idempotencyKey,
      requiresHumanConfirmation: candidate.requiresHumanConfirmation !== false,
      actionRequestId: null,
      todoId: null,
      autoCreateActionRequest: false,
      autoCreateTodo: false
    })));
    return {
      type: "disposition-candidate-list",
      count: candidates.length,
      candidates
    };
  }

  const QUERY_HANDLERS = Object.freeze({
    [QUERY_IDS.RISK_DISTRIBUTION]: queryRiskDistribution,
    [QUERY_IDS.RED_BLACK_ENTERPRISES]: queryRedBlackEnterprises,
    [QUERY_IDS.ENTERPRISE_DETAIL]: queryEnterpriseDetail,
    [QUERY_IDS.LOWEST_THREE]: queryLowestThree,
    [QUERY_IDS.FACTOR_DEFAULTS]: queryFactorDefaults,
    [QUERY_IDS.DISPOSITION_CANDIDATES]: queryDispositionCandidates
  });

  function canonicalQueryId(value) {
    const token = String(value || "").trim();
    return QUERY_BY_ID[token] ? token : QUERY_ALIASES[token] || null;
  }

  function createQueryService(input) {
    if (!isObject(input)) fail("S003_QUERY_INVALID_INPUT", "创建 M03 查询服务需要普通对象输入");
    const context = assertQueryContext(input.scenarioContext);
    const source = normalizeSource(input, context);

    function execute(queryIdValue, parameters) {
      const queryId = canonicalQueryId(queryIdValue);
      if (!queryId) fail("S003_QUERY_UNKNOWN", "不支持该问题；M03 一期只开放六个固定只读问题", {queryId: queryIdValue});
      const definition = QUERY_BY_ID[queryId];
      const result = QUERY_HANDLERS[queryId](source, parameters || {});
      return deepFreeze({
        schemaVersion: QUERY_RESULT_SCHEMA_VERSION,
        serviceVersion: SERVICE_VERSION,
        queryId,
        question: definition.question,
        resultShape: definition.resultShape,
        mode: "read-only-published-facts",
        readOnly: true,
        scenarioIdentity: tripleFrom(context),
        source: {
          contracts: ["C008", "T019", "C035"],
          ...cloneJson(source.sourceMeta)
        },
        result,
        sideEffects: {
          mutatesPublishedFacts: false,
          createsActionRequest: false,
          createsTodo: false,
          sendsNotification: false
        }
      });
    }

    return Object.freeze({
      mode: "read-only-published-facts",
      scenarioContext: context,
      definitions: QUERY_DEFINITIONS,
      execute
    });
  }

  return Object.freeze({
    SERVICE_VERSION,
    QUERY_RESULT_SCHEMA_VERSION,
    QUERY_IDS,
    QUERY_DEFINITIONS,
    S003QueryError,
    createQueryService
  });
});
